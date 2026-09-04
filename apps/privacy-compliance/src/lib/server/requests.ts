/**
 * The desk's own records: requests, officers and the action trail.
 *
 * These are ordinary content types. The engine has no data-subject-request
 * resource, and the DSAR routes are stateless: they act and answer, and keep
 * nothing an operator could open tomorrow. The register is the app's job.
 *
 * The action trail is here for a second reason. The engine does audit every
 * DSAR call, but the audit route masks the identifier on the way out (see
 * `audit.ts`), so the engine's trail can prove that an export happened and
 * cannot say who it was about. This trail carries the digest instead, which is
 * the same reference the engine writes to its logs.
 */
import {
	createContent,
	getContentBySlug,
	listContent,
	relationId,
	related,
	type ContentEntry
} from '$lib/lyeve';
import { lyeve, ACTIONS, OFFICERS, REQUESTS } from './lyeve';
import {
	RESPONSE_DAYS,
	isRequestState,
	isRequestType,
	type ActionKind,
	type RequestState,
	type RequestType
} from '$lib/desk';

/** The engine clamps a page to 25..200 rows, so 200 is the largest useful ask. */
const PAGE = 200;

interface OfficerFields {
	title: string;
	slug: string;
	email?: string;
	remit?: string;
}

interface RequestFields {
	title: string;
	slug: string;
	subject_name?: string;
	subject_email?: string;
	subject_account_id?: string;
	request_type?: string;
	request_state?: string;
	details?: string;
	received_at?: string;
	due_at?: string;
	resolution_note?: string;
}

interface ActionFields {
	title: string;
	slug: string;
	action_kind?: string;
	outcome?: string;
	subject_digest?: string;
	identifier_kind?: string;
	rows_affected?: number;
	record_count?: number;
	sections?: string;
	notes?: string;
	ran_at?: string;
}

export interface Officer {
	id: string;
	slug: string;
	name: string;
	email: string;
	remit: string;
}

export interface PrivacyRequest {
	id: string;
	slug: string;
	title: string;
	subjectName: string;
	subjectEmail: string;
	subjectAccountId: string;
	type: RequestType;
	state: RequestState;
	details: string;
	receivedAt: string;
	dueAt: string;
	resolutionNote: string;
	handlerId: string | null;
	handlerName: string | null;
}

export interface DeskAction {
	id: string;
	slug: string;
	title: string;
	kind: string;
	outcome: string;
	subjectDigest: string;
	identifierKind: string;
	rowsAffected: number;
	recordCount: number;
	sections: string;
	notes: string;
	ranAt: string;
	requestId: string | null;
}

/**
 * Reads every row a filter matches, a page at a time.
 *
 * A list response is a bare array with no total and no has_more, so the end of
 * the data is a short page and nothing else. Every count this desk shows is
 * therefore a full read.
 */
async function readAll<T>(
	schema: string,
	filters?: Record<string, string>,
	populate?: string[]
): Promise<ContentEntry<T>[]> {
	const rows: ContentEntry<T>[] = [];
	for (let offset = 0; ; offset += PAGE) {
		const page = await listContent<T>(lyeve, schema, { limit: PAGE, offset, filters, populate });
		rows.push(...page);
		if (page.length < PAGE) return rows;
	}
}

export async function loadOfficers(): Promise<Officer[]> {
	const rows = await readAll<OfficerFields>(OFFICERS);
	return rows.map(toOfficer).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadRequests(): Promise<PrivacyRequest[]> {
	// populate resolves the handler relation into the whole officer record in
	// one round trip. Without it every row needs a second request for a name.
	const rows = await readAll<RequestFields>(REQUESTS, undefined, ['handler']);
	return rows.map(toRequest).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export async function loadRequest(slug: string): Promise<PrivacyRequest | null> {
	const row = await getContentBySlug<RequestFields>(lyeve, REQUESTS, slug, {
		populate: ['handler']
	});
	return row ? toRequest(row) : null;
}

/**
 * Loads the actions filed against one request.
 *
 * A relation is filtered by its foreign key, so this is `filters[request_id]`.
 * `filters[request]` is a 400, and because the engine does not join there is no
 * way to ask for the actions belonging to a request named by its slug: the slug
 * has to be resolved to an id first, which is the read above.
 */
export async function loadActions(requestId: string): Promise<DeskAction[]> {
	const rows = await readAll<ActionFields>(ACTIONS, { request_id: requestId });
	return rows.map(toAction).sort((a, b) => Date.parse(b.ranAt) - Date.parse(a.ranAt));
}

export async function loadRecentActions(limit: number): Promise<DeskAction[]> {
	const rows = await listContent<ActionFields>(lyeve, ACTIONS, { limit: 25 });
	return rows
		.map(toAction)
		.sort((a, b) => Date.parse(b.ranAt) - Date.parse(a.ranAt))
		.slice(0, limit);
}

export interface NewRequest {
	subjectName: string;
	subjectEmail: string;
	subjectAccountId: string;
	type: RequestType;
	details: string;
}

/**
 * Files a request. This records and does nothing else.
 *
 * The public form reaches this, and the identifier it captures is not sent to
 * any DSAR route here. A request is a thing a human reads, verifies the
 * identity behind, and then acts on from the officer view. Wiring the form
 * straight to the erase route would make an unauthenticated text box into a
 * delete button for other people's records.
 */
export async function createRequest(input: NewRequest): Promise<string> {
	const receivedAt = new Date();
	const dueAt = new Date(receivedAt.getTime() + RESPONSE_DAYS * 86_400_000);
	const slug = uniqueSlug(`request-${input.type}`);

	await createContent(lyeve, {
		schema: REQUESTS,
		slug,
		title: `${labelFor(input.type)} from ${input.subjectName || 'an unnamed subject'}`,
		body: {
			slug,
			subject_name: input.subjectName,
			subject_email: input.subjectEmail,
			subject_account_id: input.subjectAccountId,
			request_type: input.type,
			request_state: 'received',
			details: input.details,
			// A datetime field is a TIMESTAMPTZ, and RFC 3339 is what it takes.
			received_at: receivedAt.toISOString(),
			due_at: dueAt.toISOString()
		}
	});
	return slug;
}

/**
 * Rewrites a request.
 *
 * `PUT /api/admin/content/{id}` merges at the top level and replaces `body`
 * wholesale, so the whole field set goes back on every edit. Sending one field
 * alone would erase the subject and the details.
 */
async function writeRequest(req: PrivacyRequest, changes: Partial<PrivacyRequest>, note: string) {
	const next = { ...req, ...changes };
	const body: Record<string, unknown> = {
		title: next.title,
		slug: next.slug,
		subject_name: next.subjectName,
		subject_email: next.subjectEmail,
		subject_account_id: next.subjectAccountId,
		request_type: next.type,
		request_state: next.state,
		details: next.details,
		received_at: next.receivedAt,
		due_at: next.dueAt,
		resolution_note: next.resolutionNote
	};
	// Relations are written under the field name and read back as
	// `<field>_id`. Omitting it on an edit that replaces the body would drop
	// the assignment, so it is always sent when there is one.
	if (next.handlerId) body.handler = next.handlerId;

	await lyeve.request('admin', `/api/admin/content/${req.id}`, {
		method: 'PUT',
		body: JSON.stringify({
			title: next.title,
			slug: next.slug,
			body,
			change_note: note
		})
	});
}

export async function setRequestState(
	req: PrivacyRequest,
	state: RequestState,
	resolutionNote?: string
): Promise<void> {
	await writeRequest(
		req,
		{ state, resolutionNote: resolutionNote ?? req.resolutionNote },
		`state changed to ${state}`
	);
}

/**
 * Blanks the subject on a request after their data has been erased.
 *
 * Without this the desk becomes the last place the erased address survives. A
 * register of erasure requests is exactly where a subject would least expect to
 * still be named, and the engine erasing its own tables does nothing about a
 * row this app wrote.
 *
 * The digest stays, and so does the resolution note. That is what lets the desk
 * show a regulator which request a given erasure answered without holding the
 * identifier to prove it.
 */
export async function redactRequestSubject(
	req: PrivacyRequest,
	digest: string,
	note: string
): Promise<void> {
	await writeRequest(
		req,
		{
			title: `${labelFor(req.type)} (erased subject ${digest})`,
			subjectName: '',
			subjectEmail: '',
			subjectAccountId: '',
			state: 'completed',
			resolutionNote: note
		},
		'subject redacted after erasure'
	);
}

export async function assignHandler(req: PrivacyRequest, officerId: string): Promise<void> {
	await writeRequest(req, { handlerId: officerId }, 'handler assigned');
}

export interface NewAction {
	requestId: string;
	requestSlug: string;
	kind: ActionKind;
	outcome: string;
	subjectDigest: string;
	identifierKind: string;
	rowsAffected?: number;
	recordCount?: number;
	sections?: string;
	notes?: string;
}

/**
 * Files what the desk did.
 *
 * The subject identifier is not stored. The digest is the engine's own
 * `subject_ref` recipe, so an entry here can be lined up with the engine's log
 * lines for the same run, and a register of erasures does not become the one
 * place the erased address survives.
 */
export async function fileAction(input: NewAction): Promise<void> {
	const slug = uniqueSlug(`action-${input.kind}`);
	await createContent(lyeve, {
		schema: ACTIONS,
		slug,
		title: `${input.kind} on ${input.requestSlug}: ${input.outcome}`,
		body: {
			slug,
			action_kind: input.kind,
			outcome: input.outcome,
			subject_digest: input.subjectDigest,
			identifier_kind: input.identifierKind,
			rows_affected: input.rowsAffected ?? 0,
			record_count: input.recordCount ?? 0,
			sections: input.sections ?? '',
			notes: input.notes ?? '',
			ran_at: new Date().toISOString(),
			request: input.requestId
		}
	});
}

/**
 * The identifier a request names, and where it came from.
 *
 * A request carries an address, an account id, or both. The account id is
 * preferred when present: it is unique across every tenant, where an address is only
 * unique among accounts and can name different people in different tenants.
 */
export function requestIdentifier(req: PrivacyRequest): { raw: string; source: string } {
	if (req.subjectAccountId) return { raw: req.subjectAccountId, source: 'account id' };
	if (req.subjectEmail) return { raw: req.subjectEmail, source: 'email address' };
	return { raw: '', source: 'nothing on the record' };
}

function toOfficer(row: ContentEntry<OfficerFields>): Officer {
	const d = row.data;
	return {
		id: row.id,
		slug: d.slug,
		name: d.title,
		email: d.email ?? '',
		remit: d.remit ?? ''
	};
}

function toRequest(row: ContentEntry<RequestFields>): PrivacyRequest {
	const d = row.data;
	const handler = related<{ title: string }>(d, 'handler');
	return {
		id: row.id,
		slug: d.slug,
		title: d.title,
		subjectName: d.subject_name ?? '',
		subjectEmail: d.subject_email ?? '',
		subjectAccountId: d.subject_account_id ?? '',
		type: isRequestType(d.request_type ?? '') ? (d.request_type as RequestType) : 'access',
		state: isRequestState(d.request_state ?? '') ? (d.request_state as RequestState) : 'received',
		details: d.details ?? '',
		receivedAt: d.received_at ?? row.created_at,
		dueAt: d.due_at ?? row.created_at,
		resolutionNote: d.resolution_note ?? '',
		// relationId reads the id whether or not the request populated the
		// relation: an unpopulated belongs_to arrives under `handler_id`, and
		// the bare `handler` key on the same row is always null.
		handlerId: relationId(d, 'handler'),
		handlerName: handler?.title ?? null
	};
}

function toAction(row: ContentEntry<ActionFields>): DeskAction {
	const d = row.data;
	return {
		id: row.id,
		slug: d.slug,
		title: d.title,
		kind: d.action_kind ?? 'note',
		outcome: d.outcome ?? '',
		subjectDigest: d.subject_digest ?? '',
		identifierKind: d.identifier_kind ?? '',
		rowsAffected: Number(d.rows_affected ?? 0),
		recordCount: Number(d.record_count ?? 0),
		sections: d.sections ?? '',
		notes: d.notes ?? '',
		ranAt: d.ran_at ?? row.created_at,
		requestId: relationId(d, 'request')
	};
}

function labelFor(type: RequestType): string {
	return type.charAt(0).toUpperCase() + type.slice(1) + ' request';
}

/**
 * Slugs are unique per tenant across every content type rather than per type,
 * and every example in this repo shares one engine and one tenant. The prefix
 * keeps this desk clear of the other apps and the suffix keeps two requests
 * filed in the same second apart.
 */
function uniqueSlug(base: string): string {
	return `privacy-${base}-${crypto.randomUUID().slice(0, 8)}`;
}
