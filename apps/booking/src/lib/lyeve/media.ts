import type { LyeveClient } from './client.ts';

export interface MediaRecord {
	id: string;
	key: string;
	filename: string;
	content_type: string;
	size: number;
	tags?: string[];
}

/** Upload returns a JSON array even for a single file. */
export async function uploadMedia(
	client: LyeveClient,
	file: File | Blob,
	filename: string
): Promise<MediaRecord> {
	const form = new FormData();
	form.append('file', file, filename);
	const rows = await client.request<MediaRecord[]>('admin', '/api/admin/media', {
		method: 'POST',
		body: form
	});
	const record = Array.isArray(rows) ? rows[0] : (rows as unknown as MediaRecord);
	if (!record) throw new Error('upload returned no media record');
	return record;
}

/**
 * Lists media.
 *
 * The upload route answers a bare array and this one answers an envelope, so a
 * single shape cannot be assumed across the two. Treating this response as an
 * array returned nothing at all, silently, for every caller.
 */
export async function listMedia(
	client: LyeveClient,
	opts: { limit?: number; offset?: number; folder?: string } = {}
): Promise<{ items: MediaRecord[]; total: number }> {
	const q = new URLSearchParams();
	// The route defaults to 50 and clamps to 500.
	if (opts.limit) q.set('limit', String(Math.min(opts.limit, 500)));
	if (opts.offset) q.set('offset', String(opts.offset));
	if (opts.folder) q.set('folder', opts.folder);

	const res = await client.request<{ data?: MediaRecord[]; total_count?: number } | MediaRecord[]>(
		'admin',
		`/api/admin/media${q.size ? `?${q}` : ''}`
	);
	if (Array.isArray(res)) return { items: res, total: res.length };
	return { items: res?.data ?? [], total: res?.total_count ?? 0 };
}

/**
 * Streams the bytes for a media record.
 *
 * The engine's download route requires a bearer token, so pointing a browser
 * `<img src>` straight at it yields a 401 and a broken image. Each app serves
 * media from its own route and calls this from the server.
 */
export async function mediaBytes(client: LyeveClient, id: string): Promise<Response> {
	return client.raw('admin', `/api/admin/media/${id}/download`);
}
