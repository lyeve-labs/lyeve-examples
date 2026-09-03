import type { LyeveClient } from './client.ts';

export interface SearchHit {
	entry_id: string;
	schema: string;
	slug: string;
	title: string;
	body: Record<string, unknown>;
	status: string;
}

export interface SearchResponse {
	results: SearchHit[];
	total: number;
	limit: number;
	offset: number;
	query: string;
}

/**
 * Full-text search.
 *
 * The engine exposes this on the admin router only. There is no `/api/v1`
 * equivalent, so a public search box is necessarily proxied by the app.
 *
 * It reads `sys_content_entries`, which means it only ever sees content written
 * through `createContent`. Entries written to the public v1 endpoint are
 * invisible here forever, and the response is a perfectly ordinary `total: 0`.
 */
export async function search(
	client: LyeveClient,
	query: string,
	opts: { schema?: string; limit?: number; offset?: number } = {}
): Promise<SearchResponse> {
	const q = new URLSearchParams({ q: query });
	if (opts.schema) q.set('schema', opts.schema);
	if (opts.limit) q.set('limit', String(opts.limit));
	if (opts.offset) q.set('offset', String(opts.offset));

	const empty: SearchResponse = { results: [], total: 0, limit: 20, offset: 0, query };
	if (!query.trim()) return empty;

	const res = await client.request<SearchResponse>('admin', `/api/admin/search?${q.toString()}`);
	return res ?? empty;
}
