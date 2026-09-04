import { listContent, related } from '$lib/lyeve';
import { lyeve, NOTICES } from '$lib/server/lyeve';
import { listByCursor } from '$lib/server/feed';
import type { PageServerLoad } from './$types';

interface Notice {
	title: string;
	slug: string;
	severity?: string;
	body?: string;
	effective_from?: string;
}

const PAGE_SIZE = 4;

export const load: PageServerLoad = async ({ url }) => {
	const cursor = url.searchParams.get('cursor') ?? '';

	// The two reads the same collection offers, side by side. The cursor route
	// honors a page of four. The offset route clamps the page to twenty-five
	// and hands back everything.
	const [page, clamped] = await Promise.all([
		listByCursor<Notice>(lyeve, NOTICES, { limit: PAGE_SIZE, cursor, populate: ['line'] }),
		listContent<Notice>(lyeve, NOTICES, { limit: PAGE_SIZE })
	]);

	return {
		pageSize: PAGE_SIZE,
		cursor,
		nextCursor: page.next_cursor,
		requestPath: `/api/v1/content/${NOTICES}/cursor?limit=${PAGE_SIZE}${
			cursor ? `&cursor=${cursor}` : ''
		}&populate=line`,
		notices: page.data.map((row) => ({
			id: row.id,
			title: row.data.title,
			slug: row.data.slug,
			severity: row.data.severity ?? 'info',
			body: row.data.body ?? '',
			effectiveFrom: row.data.effective_from ?? null,
			createdAt: row.created_at,
			line: related<{ title: string; mode?: string }>(row.data, 'line')?.title ?? 'Network wide'
		})),
		// What the offset route did with the same limit, so the clamp is visible
		// rather than described.
		offset: { asked: PAGE_SIZE, got: clamped.length }
	};
};
