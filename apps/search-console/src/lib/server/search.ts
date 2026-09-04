/**
 * Every route the search plugin serves, with the shapes it really returns.
 *
 * Four envelopes are in play and none of them is the content router's. A search
 * answers `{results, total, limit, offset, query}` with an optional `facets`.
 * The synonym list answers the engine's standard page, `{data, total_count,
 * limit, offset}`. Instant search answers `{results, query, took_ms}` with no
 * total at all. Reindex answers `{indexed, skipped, errors, message}`. A helper
 * per route is cheaper than remembering which.
 */
import { LyeveError } from '$lib/lyeve';
import { lyeve } from './lyeve';

/**
 * One hit.
 *
 * `body` is the document as it was written, not the row the content router
 * returns, so a relation appears under its own field name holding an id.
 * Writing `category` and reading `category` back is specific to search: the
 * public content route hands the same relation back as `category_id`.
 */
export interface SearchHit {
	entry_id: string;
	schema: string;
	tenant_id: string;
	slug: string;
	title: string;
	body: Record<string, unknown>;
	meta: Record<string, unknown>;
	status: string;
	published_at?: string;
	created_by: string;
	created_at: string;
	updated_at: string;
	/**
	 * The engine's own score. On Postgres this is ts_rank over a vector where
	 * the title is weighted A, the body B and the tags C, and those weights are
	 * compiled into a trigger. On MySQL and MSSQL search is a LIKE and this is
	 * 1.0 for every match. A browse with no query is 0.0 everywhere.
	 */
	rank: number;
	/** Present only when highlight was requested. Postgres only. */
	snippets?: Record<string, string>;
	tags?: string[];
}

export interface FacetValue {
	value: string;
	count: number;
}

export interface SearchResponse {
	results: SearchHit[];
	total: number;
	limit: number;
	offset: number;
	query: string;
	facets?: Record<string, FacetValue[]>;
}

export interface SearchQuery {
	q?: string;
	schema?: string;
	status?: string;
	tags?: string[];
	/** Only `schema`, `status` and `tags` produce buckets. Anything else is dropped. */
	facets?: string[];
	publishedAfter?: string;
	publishedBefore?: string;
	limit?: number;
	offset?: number;
	highlight?: boolean;
}

const EMPTY: SearchResponse = { results: [], total: 0, limit: 20, offset: 0, query: '' };

/**
 * GET /api/admin/search
 *
 * At least one of q, schema, status or tags is required. All four empty is a
 * 400 rather than a browse of everything. The limit defaults to 20 and is
 * clamped to 200, with no floor, so unlike the content route a page of five is
 * a page of five.
 *
 * Unknown parameters are ignored in silence. There is no fuzziness, no field
 * selector and no sort: on Postgres the order is rank then updated_at, and
 * without a query it is updated_at alone.
 */
export async function search(query: SearchQuery): Promise<SearchResponse> {
	const params = new URLSearchParams();
	if (query.q) params.set('q', query.q);
	if (query.schema) params.set('schema', query.schema);
	if (query.status) params.set('status', query.status);
	if (query.tags?.length) params.set('tags', query.tags.join(','));
	if (query.facets?.length) params.set('facets', query.facets.join(','));
	if (query.publishedAfter) params.set('published_after', query.publishedAfter);
	if (query.publishedBefore) params.set('published_before', query.publishedBefore);
	if (query.limit) params.set('limit', String(query.limit));
	if (query.offset) params.set('offset', String(query.offset));
	if (query.highlight) params.set('highlight', 'true');

	if (!query.q && !query.schema && !query.status && !query.tags?.length) {
		return { ...EMPTY, query: query.q ?? '' };
	}

	const res = await lyeve.request<SearchResponse>('admin', `/api/admin/search?${params.toString()}`);
	return res ?? { ...EMPTY, query: query.q ?? '' };
}

/**
 * POST /api/admin/search
 *
 * The same search with the criteria in a JSON body. Two differences matter.
 * The body is decoded strictly, so an unrecognized key is a 400 rather than
 * being ignored, which makes it the honest way to find out that a parameter
 * does not exist. And a malformed date is a decode error here while the query
 * string simply drops it.
 *
 * Used on the console's search tab so the two verbs can be compared side by
 * side. Everything else in this app uses GET.
 */
export async function searchByBody(query: SearchQuery): Promise<SearchResponse> {
	const body: Record<string, unknown> = {};
	if (query.q) body.q = query.q;
	if (query.schema) body.schema = query.schema;
	if (query.status) body.status = query.status;
	if (query.tags?.length) body.tags = query.tags;
	if (query.facets?.length) body.facets = query.facets;
	if (query.publishedAfter) body.published_after = query.publishedAfter;
	if (query.publishedBefore) body.published_before = query.publishedBefore;
	if (query.limit) body.limit = query.limit;
	if (query.offset) body.offset = query.offset;
	if (query.highlight) body.highlight = true;

	const res = await lyeve.request<SearchResponse>('admin', '/api/admin/search', {
		method: 'POST',
		body: JSON.stringify(body)
	});
	return res ?? { ...EMPTY, query: query.q ?? '' };
}

export interface InstantHit {
	entry_id: string;
	title: string;
	slug: string;
	schema: string;
}

export interface InstantResponse {
	results: InstantHit[];
	query: string;
	took_ms: number;
}

/**
 * GET /api/admin/search/instant
 *
 * Not a small full-text search. It is `LOWER(title) LIKE LOWER(q || '%')`, so
 * it matches a prefix of the title and nothing else: no body, no keywords, no
 * stemming, and no match on a word in the middle of the title. It also returns
 * published entries only, orders by updated_at rather than by relevance, and
 * has no total. The limit defaults to 10 and is capped at 50.
 */
export async function instant(q: string, schema?: string, limit = 10): Promise<InstantResponse> {
	if (!q.trim()) return { results: [], query: q, took_ms: 0 };
	const params = new URLSearchParams({ q, limit: String(limit) });
	if (schema) params.set('schema', schema);
	const res = await lyeve.request<InstantResponse>(
		'admin',
		`/api/admin/search/instant?${params.toString()}`
	);
	return res ?? { results: [], query: q, took_ms: 0 };
}

export interface SynonymGroup {
	id: string;
	tenant_id: string;
	name: string;
	base_term: string;
	synonyms: string[];
	created_at: string;
	updated_at: string;
}

interface Page<T> {
	data: T[];
	total_count: number;
	limit: number;
	offset: number;
}

/** GET /api/admin/search/synonyms. Ordered by base term. Limit defaults to 50, caps at 500. */
export async function listSynonyms(): Promise<SynonymGroup[]> {
	const page = await lyeve.request<Page<SynonymGroup>>(
		'admin',
		'/api/admin/search/synonyms?limit=200'
	);
	return page?.data ?? [];
}

/**
 * POST /api/admin/search/synonyms
 *
 * base_term and at least one synonym are required. The base term is unique per
 * tenant, and a second group claiming it is refused with a 409 that names no
 * field, so the caller has to know what the conflict was about.
 */
export async function createSynonym(input: {
	name: string;
	base_term: string;
	synonyms: string[];
}): Promise<SynonymGroup> {
	return lyeve.request<SynonymGroup>('admin', '/api/admin/search/synonyms', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

/** PUT /api/admin/search/synonyms/{id}. Replaces the group's fields. */
export async function updateSynonym(
	id: string,
	input: { name: string; base_term: string; synonyms: string[] }
): Promise<SynonymGroup> {
	return lyeve.request<SynonymGroup>('admin', `/api/admin/search/synonyms/${id}`, {
		method: 'PUT',
		body: JSON.stringify(input)
	});
}

/** DELETE /api/admin/search/synonyms/{id}. 204 on success, 404 when it is gone. */
export async function deleteSynonym(id: string): Promise<void> {
	await lyeve.request<void>('admin', `/api/admin/search/synonyms/${id}`, { method: 'DELETE' });
}

export interface BoostRule {
	field: string;
	value?: string;
	boost: number;
}

export interface RankingConfig {
	id: string;
	tenant_id: string;
	schema_name: string;
	title_weight: number;
	body_weight: number;
	tag_weight: number;
	boost_rules: BoostRule[];
	created_at: string;
	updated_at: string;
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * GET /api/admin/search/ranking?schema=
 *
 * Answers 200 whether or not a row exists. When none does it returns the
 * defaults with a nil id and zero timestamps, so a 200 here is not evidence
 * that anything is stored. `stored` reports which of the two happened.
 *
 * The schema defaults to the string `*` rather than to every schema, and `*` is
 * an ordinary key rather than a wildcard: a config stored under `*` is not
 * consulted for a query against a named schema by anything in the engine.
 */
export async function getRanking(
	schema?: string
): Promise<RankingConfig & { stored: boolean }> {
	const params = schema ? `?schema=${encodeURIComponent(schema)}` : '';
	const config = await lyeve.request<RankingConfig>(
		'admin',
		`/api/admin/search/ranking${params}`
	);
	return { ...config, stored: config.id !== NIL_UUID };
}

/**
 * PUT /api/admin/search/ranking
 *
 * Upserts on (tenant, schema_name). The response carries the stored id, which
 * is the id of the existing row on an update rather than a freshly minted one.
 */
export async function putRanking(input: {
	schema_name: string;
	title_weight: number;
	body_weight: number;
	tag_weight: number;
	boost_rules: BoostRule[];
}): Promise<RankingConfig> {
	return lyeve.request<RankingConfig>('admin', '/api/admin/search/ranking', {
		method: 'PUT',
		body: JSON.stringify(input)
	});
}

/** DELETE /api/admin/search/ranking/{id}. Restores the defaults by removing the row. */
export async function deleteRanking(id: string): Promise<void> {
	await lyeve.request<void>('admin', `/api/admin/search/ranking/${id}`, { method: 'DELETE' });
}

export interface ReindexResult {
	indexed: number;
	skipped: number;
	errors: number;
	message: string;
}

/**
 * POST /api/admin/search/reindex
 *
 * super_admin only, and synchronous: the request does not return until the
 * whole pass is done. It streams every entry in sys_content_entries in batches
 * of five hundred keys, and for a row whose stored index already matches its
 * content it writes nothing and counts it as indexed anyway. So on a corpus
 * that is already current this is a full read and no writes, and `indexed` is
 * the number of rows examined rather than the number rewritten.
 *
 * It is not scoped to this app. A super_admin with no tenant header resolves to
 * the implicit default tenant, which the handler maps to the whole corpus, so
 * this rebuilds every example's content on the shared engine.
 */
export async function reindex(): Promise<ReindexResult> {
	return lyeve.request<ReindexResult>('admin', '/api/admin/search/reindex', {
		method: 'POST',
		body: JSON.stringify({})
	});
}

export interface TopQuery {
	query_text: string;
	count: number;
}

export interface AnalyticsSummary {
	total_searches: number;
	unique_queries: number;
	avg_result_count: number;
	avg_duration_ms: number;
	top_queries: TopQuery[];
	zero_result_pct: number;
}

/**
 * GET /api/admin/search/analytics?since=
 *
 * Defaults to the last thirty days. Six aggregates and the twenty most frequent
 * queries. Note what is absent: clicks. The click endpoint writes
 * `clicked_entry_id` on an analytics row and no read route ever returns it, so
 * a click-through rate cannot be computed from this API.
 */
export async function analytics(since?: Date): Promise<AnalyticsSummary> {
	const params = since ? `?since=${since.toISOString()}` : '';
	return lyeve.request<AnalyticsSummary>('admin', `/api/admin/search/analytics${params}`);
}

/**
 * POST /api/admin/search/analytics/log
 *
 * Nothing in the engine calls this. Searching does not record a search: the
 * handler runs the query and answers, and the analytics tables stay empty
 * unless the caller posts here itself. An application that never does has an
 * analytics summary of zeroes forever, and no part of the product says so.
 *
 * Answers 202 and swallows a store failure, so a caller cannot tell whether the
 * row was written. Best effort by design, which is the right trade for a
 * telemetry write on a request path.
 */
export async function logSearch(event: {
	query_text: string;
	result_count: number;
	duration_ms: number;
	session_id: string;
	filters?: string;
}): Promise<void> {
	await lyeve.request<void>('admin', '/api/admin/search/analytics/log', {
		method: 'POST',
		body: JSON.stringify(event)
	});
}

/**
 * POST /api/admin/search/analytics/click
 *
 * Attaches the clicked entry to the most recent logged search with the same
 * query text and session id that has no click yet. So the query text has to
 * match the logged text exactly, the session id has to be the same, and only
 * the first click on a search is recorded.
 */
export async function logClick(event: {
	entry_id: string;
	query_text: string;
	session_id: string;
}): Promise<void> {
	await lyeve.request<void>('admin', '/api/admin/search/analytics/click', {
		method: 'POST',
		body: JSON.stringify(event)
	});
}

/** Turns an engine failure into one sentence a page can show. */
export function describe(err: unknown, fallback: string): string {
	if (!(err instanceof LyeveError)) return fallback;
	if (err.status === 409) return 'A synonym group already claims that base term.';
	if (err.status === 403) return 'Refused: that route needs a super_admin token.';
	if (err.status === 404) return 'That record is no longer there.';
	return err.fieldErrors[0]?.message || err.message || fallback;
}

/** A read that is decoration rather than substance: a failure leaves a gap. */
export async function safely<T>(read: Promise<T>): Promise<T | null> {
	try {
		return await read;
	} catch {
		return null;
	}
}
