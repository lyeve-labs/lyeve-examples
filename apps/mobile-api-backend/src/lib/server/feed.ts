import type { ContentEntry, LyeveClient } from '$lib/lyeve';

/**
 * The cursor-paged content route, which the shared client does not wrap.
 *
 * It is the read a phone wants and it behaves nothing like the offset list
 * beside it. Three differences decide whether it is usable:
 *
 *   - `limit` is honored from 1 to 1000. The offset list clamps to 25, so
 *     asking it for four rows returns twenty-five.
 *   - Rows come back ordered by id, which is a random UUID. Not created_at,
 *     not updated_at. A feed that has to be newest-first cannot use this route
 *     for the ordering, only for the paging.
 *   - The response is an envelope, `{data, next_cursor}`, while the offset list
 *     is a bare array.
 *
 * `next_cursor` is set only when the page came back full, so a collection whose
 * size is an exact multiple of the limit serves one final empty page before it
 * stops. Following the cursor until it is empty is correct. Treating a full
 * page as proof there is more is not.
 */
export interface CursorPage<T> {
	data: ContentEntry<T>[];
	next_cursor: string;
}

export async function listByCursor<T = Record<string, unknown>>(
	client: LyeveClient,
	schema: string,
	opts: { limit?: number; cursor?: string; populate?: string[] } = {}
): Promise<CursorPage<T>> {
	const q = new URLSearchParams();
	q.set('limit', String(opts.limit ?? 20));
	if (opts.cursor) q.set('cursor', opts.cursor);
	if (opts.populate?.length) q.set('populate', opts.populate.join(','));

	const page = await client.request<CursorPage<T>>(
		'api',
		`/api/v1/content/${schema}/cursor?${q.toString()}`
	);
	return { data: page?.data ?? [], next_cursor: page?.next_cursor ?? '' };
}
