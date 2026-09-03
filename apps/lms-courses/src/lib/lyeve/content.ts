import type { LyeveClient } from './client.ts';

export interface ContentEntry<T = Record<string, unknown>> {
	id: string;
	schema_name: string;
	data: T;
	created_at: string;
	updated_at: string;
}

export interface ListOptions {
	/**
	 * The engine clamps this to 25..200, so a smaller page is served by asking
	 * for the floor and slicing. Passing `limit: 3` to the engine returns 25.
	 */
	limit?: number;
	offset?: number;
	/** Exact equality only. The engine supports no operators, ranges or LIKE. */
	filters?: Record<string, string | number | boolean>;
	/** Field names to inflate from an id into the full related object. */
	populate?: string[];
	/** Inflate every relation to this depth instead of naming fields. */
	depth?: number;
}

const ENGINE_MIN_LIMIT = 25;
const ENGINE_MAX_LIMIT = 200;

export function buildContentQuery(opts: ListOptions = {}): string {
	const q = new URLSearchParams();
	const want = opts.limit ?? ENGINE_MIN_LIMIT;
	q.set('limit', String(Math.min(Math.max(want, ENGINE_MIN_LIMIT), ENGINE_MAX_LIMIT)));
	if (opts.offset) q.set('offset', String(opts.offset));
	for (const [k, v] of Object.entries(opts.filters ?? {})) q.set(`filters[${k}]`, String(v));
	if (opts.populate?.length) q.set('populate', opts.populate.join(','));
	if (opts.depth) q.set('depth', String(opts.depth));
	return q.toString();
}

/**
 * Lists entries newest-first. The engine has no sort parameter and always
 * orders by created_at DESC, so any other ordering is applied here.
 */
export async function listContent<T = Record<string, unknown>>(
	client: LyeveClient,
	schema: string,
	opts: ListOptions = {}
): Promise<ContentEntry<T>[]> {
	const rows = await client.request<ContentEntry<T>[]>(
		'api',
		`/api/v1/content/${schema}?${buildContentQuery(opts)}`
	);
	const list = Array.isArray(rows) ? rows : [];
	return opts.limit && opts.limit < ENGINE_MIN_LIMIT ? list.slice(0, opts.limit) : list;
}

export async function getContent<T = Record<string, unknown>>(
	client: LyeveClient,
	schema: string,
	id: string,
	opts: Pick<ListOptions, 'populate' | 'depth'> = {}
): Promise<ContentEntry<T> | null> {
	const q = new URLSearchParams();
	if (opts.populate?.length) q.set('populate', opts.populate.join(','));
	if (opts.depth) q.set('depth', String(opts.depth));
	try {
		return await client.request<ContentEntry<T>>(
			'api',
			`/api/v1/content/${schema}/${id}?${q.toString()}`
		);
	} catch (err) {
		if (err && typeof err === 'object' && (err as { status?: number }).status === 404) return null;
		throw err;
	}
}

/** Convenience for the common "look it up by its slug" page. */
export async function getContentBySlug<T = Record<string, unknown>>(
	client: LyeveClient,
	schema: string,
	slug: string,
	opts: Pick<ListOptions, 'populate' | 'depth'> = {}
): Promise<ContentEntry<T> | null> {
	const [row] = await listContent<T>(client, schema, { ...opts, filters: { slug }, limit: 25 });
	return row ?? null;
}

export interface CreateOptions {
	schema: string;
	slug: string;
	title: string;
	/** Every schema field goes here, `title` included, because `body` is validated against the schema. */
	body: Record<string, unknown>;
	status?: 'draft' | 'published' | 'archived';
}

/**
 * Writes through the admin router, which is the only path that produces content
 * the whole product can see.
 *
 * The public v1 write endpoint writes straight to the generated table and
 * bypasses `sys_content_entries`, so anything created that way is invisible to
 * search and to the admin UI, permanently and without an error.
 */
export async function createContent(client: LyeveClient, opts: CreateOptions): Promise<{ id: string }> {
	return client.request<{ id: string }>('admin', '/api/admin/content', {
		method: 'POST',
		body: JSON.stringify({
			schema: opts.schema,
			slug: opts.slug,
			title: opts.title,
			// The handler requires `title` at the top level and again inside the
			// body, because the body is validated against the schema's own fields.
			body: { title: opts.title, ...opts.body },
			status: opts.status ?? 'published'
		})
	});
}

/**
 * Reads the id a relation actually stores.
 *
 * A relation named `author` is written as `author` and read back as
 * `author_id`. The `author` key is also present and always null unless the
 * request populated it.
 */
export function relationId(data: object, field: string): string | null {
	const row = data as Record<string, unknown>;
	const id = row[`${field}_id`];
	if (typeof id === 'string' && id) return id;
	const inflated = row[field];
	if (inflated && typeof inflated === 'object' && 'id' in inflated) {
		return String((inflated as { id: unknown }).id);
	}
	return null;
}

/** Reads a populated relation, or null when the request did not populate it. */
export function related<T = Record<string, unknown>>(data: object, field: string): T | null {
	const v = (data as Record<string, unknown>)[field];
	return v && typeof v === 'object' ? (v as T) : null;
}
