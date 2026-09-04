/**
 * The upstream half of the live board.
 *
 * `GET /api/v1/content/{schema}/stream` needs the same bearer token as every
 * other engine route, so the browser cannot open it. This module opens it from
 * the server, decodes it, and hands back events already in the board's shape.
 */
import { relationId } from '$lib/lyeve';
import { isIncidentState, isSeverity, type Incident, type IncidentUpdate } from '$lib/board';
import { INCIDENTS, UPDATES, lyeve } from './lyeve';

export type EventAction = 'create' | 'update' | 'delete';

export type BoardEvent =
	| { kind: 'incident'; action: EventAction; incident: Incident }
	| { kind: 'update'; action: EventAction; update: IncidentUpdate }
	| { kind: 'unmapped'; schema: string; action: EventAction };

export interface UpstreamHandle {
	/** Tears the upstream connection down, which is what unregisters the engine's hooks. */
	close(): Promise<void>;
}

/**
 * The engine's SSE envelope: `data: {"event","schema","data"}`, preceded by a
 * `: connected to <schema> stream` comment. There is no `id:` field and no
 * `retry:`, so there is nothing to replay from.
 */
interface EngineEnvelope {
	event?: string;
	schema?: string;
	data?: unknown;
}

/**
 * Opens one schema's stream and pumps it until it is closed or it ends.
 *
 * The engine registers its hooks per request and unregisters them when the
 * request context is done, so an abandoned connection is a leaked subscription
 * and a leaked goroutine on the engine. `close()` cancels the body, which
 * destroys the socket, which is what ends that request.
 */
export async function watchSchema(
	schema: string,
	onEvent: (event: BoardEvent) => void,
	onEnd: (reason: string) => void
): Promise<UpstreamHandle> {
	const upstream = await openStream(schema);
	if (!upstream.ok || !upstream.body) {
		await upstream.body?.cancel();
		throw new Error(`stream for ${schema} answered ${upstream.status}`);
	}

	const reader = upstream.body.getReader();
	let closed = false;

	const pump = async () => {
		const decoder = new TextDecoder();
		let buffer = '';
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });

				// SSE frames are separated by a blank line. A chunk boundary can
				// land anywhere, so anything after the last separator stays in
				// the buffer until the rest of it arrives.
				let split = buffer.indexOf('\n\n');
				while (split !== -1) {
					const frame = buffer.slice(0, split);
					buffer = buffer.slice(split + 2);
					const mapped = mapFrame(schema, frame);
					if (mapped) onEvent(mapped);
					split = buffer.indexOf('\n\n');
				}
			}
			if (!closed) onEnd(`${schema} stream ended`);
		} catch (err) {
			if (!closed) onEnd(err instanceof Error ? err.message : `${schema} stream failed`);
		}
	};

	void pump();

	return {
		async close() {
			closed = true;
			try {
				await reader.cancel();
			} catch {
				// Already gone. Nothing to release.
			}
		}
	};
}

/**
 * Opens the raw stream, re-authenticating once if the cached token is dead.
 *
 * `raw()` streams a response through untouched, which also means it does not
 * do the client's 401 retry. A token the engine has stopped accepting, after a
 * restart or a rotated key, would otherwise fail every reconnect for the life
 * of this process. One ordinary request is enough to make the client notice and
 * log in again.
 */
async function openStream(schema: string): Promise<Response> {
	const path = `/api/v1/content/${schema}/stream`;
	const first = await lyeve.raw('api', path);
	if (first.status !== 401) return first;

	await first.body?.cancel();
	await lyeve.request('api', '/api/v1/schemas');
	return lyeve.raw('api', path);
}

/** Opens every watched schema, and unwinds the ones that succeeded if one fails. */
export async function watchAll(
	schemas: readonly string[],
	onEvent: (event: BoardEvent) => void,
	onEnd: (reason: string) => void
): Promise<UpstreamHandle> {
	const open: UpstreamHandle[] = [];
	try {
		for (const schema of schemas) open.push(await watchSchema(schema, onEvent, onEnd));
	} catch (err) {
		await Promise.all(open.map((h) => h.close()));
		throw err;
	}
	return {
		async close() {
			await Promise.all(open.map((h) => h.close()));
		}
	};
}

function mapFrame(schema: string, frame: string): BoardEvent | null {
	const line = frame
		.split('\n')
		.find((l) => l.startsWith('data:'));
	// A frame with no data line is the connect comment or a keepalive.
	if (!line) return null;

	let envelope: EngineEnvelope;
	try {
		envelope = JSON.parse(line.slice(5).trim()) as EngineEnvelope;
	} catch {
		return null;
	}

	const action = actionOf(envelope.event);
	if (!action) return null;

	const fields = fieldsOf(envelope.data);
	const id = typeof fields.id === 'string' ? fields.id : '';
	if (!id) return { kind: 'unmapped', schema, action };

	// Only the admin write path's payload carries the entry timestamps. The
	// public path publishes the generated row, which has none, so the moment
	// the event was read stands in for it until the next resync.
	const at = entryTime(envelope.data) || new Date().toISOString();

	if (schema === INCIDENTS) return { kind: 'incident', action, incident: toIncident(id, fields, at) };
	if (schema === UPDATES) return { kind: 'update', action, update: toUpdate(id, fields, at) };
	return { kind: 'unmapped', schema, action };
}

function actionOf(event: string | undefined): EventAction | null {
	if (event === 'after_create') return 'create';
	if (event === 'after_update') return 'update';
	if (event === 'after_delete') return 'delete';
	return null;
}

/**
 * The envelope of a `sys_content_entries` row, whose keys sit alongside the
 * schema's own fields in a stream payload from the admin write path.
 */
const ENTRY_ENVELOPE = new Set([
	'id',
	'schema',
	'tenant_id',
	'body',
	'meta',
	'status',
	'published_at',
	'scheduled_publish_at',
	'scheduled_unpublish_at',
	'timezone',
	'created_by',
	'updated_by',
	'current_rev',
	'created_at',
	'updated_at'
]);

/**
 * Flattens a stream payload, whichever write path produced it.
 *
 * The two write paths publish different shapes on the same stream, verified
 * against a live engine. `POST /api/admin/content` publishes the whole
 * `sys_content_entries` row, so the schema's own fields are nested under
 * `body`. `POST /api/v1/content/{schema}` publishes the generated table row, so
 * they are at the top level and the entry envelope is absent. Merging the
 * nested object over the top-level one reads both, and it is also why no field
 * on this board is named `status`: that key belongs to the envelope, and a
 * field of the same name would be shadowed by a draft/published value on every
 * admin write.
 */
function fieldsOf(data: unknown): Record<string, unknown> {
	if (!data || typeof data !== 'object') return {};
	const row = data as Record<string, unknown>;
	const nested = row.body && typeof row.body === 'object' ? (row.body as Record<string, unknown>) : {};
	const flat = Object.fromEntries(
		Object.entries(row).filter(([key]) => !ENTRY_ENVELOPE.has(key))
	);
	return { ...flat, ...nested, id: row.id };
}

function entryTime(data: unknown): string {
	if (!data || typeof data !== 'object') return '';
	const created = (data as Record<string, unknown>).created_at;
	return typeof created === 'string' ? created : '';
}

function toIncident(id: string, fields: Record<string, unknown>, at: string): Incident {
	return {
		id,
		slug: str(fields.slug),
		title: str(fields.title) || 'Untitled incident',
		summary: str(fields.summary),
		severity: isSeverity(fields.severity) ? fields.severity : 'minor',
		state: isIncidentState(fields.state) ? fields.state : 'investigating',
		serviceId: writtenRelationId(fields, 'service'),
		openedAt: str(fields.opened_at) || at,
		resolvedAt: str(fields.resolved_at) || null
	};
}

function toUpdate(id: string, fields: Record<string, unknown>, at: string): IncidentUpdate {
	return {
		id,
		incidentId: writtenRelationId(fields, 'incident'),
		state: isIncidentState(fields.state) ? fields.state : 'investigating',
		summary: str(fields.summary),
		postedAt: str(fields.posted_at) || at
	};
}

/**
 * Reads a relation out of a write payload.
 *
 * `relationId` from the shared client is written for read payloads, where a
 * relation arrives as `<field>_id` or as a populated object. A stream payload
 * from the admin write path is the JSON body the writer sent, so the relation
 * is a bare id string under the field's own name and neither of those two cases
 * matches. This tries the client's reader first and falls back to the written
 * form.
 */
function writtenRelationId(fields: Record<string, unknown>, field: string): string | null {
	const fromRead = relationId(fields, field);
	if (fromRead) return fromRead;
	const written = fields[field];
	return typeof written === 'string' && written ? written : null;
}

function str(v: unknown): string {
	return typeof v === 'string' ? v : '';
}
