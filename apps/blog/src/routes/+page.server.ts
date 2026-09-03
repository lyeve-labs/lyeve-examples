import { listContent, related } from '$lib/lyeve';
import { lyeve, POSTS } from '$lib/server/lyeve';
import type { PageServerLoad } from './$types';

interface Post {
	title: string;
	slug: string;
	excerpt?: string;
	cover_media_id?: string;
}

export const load: PageServerLoad = async () => {
	// populate resolves the relation ids into whole records in one round trip.
	// Without it each card would need a second request for its author.
	const rows = await listContent<Post>(lyeve, POSTS, { limit: 25, populate: ['author', 'category'] });

	return {
		posts: rows.map((row) => ({
			id: row.id,
			title: row.data.title,
			slug: row.data.slug,
			excerpt: row.data.excerpt ?? '',
			coverId: row.data.cover_media_id ?? null,
			publishedAt: row.created_at,
			author: related<{ title: string }>(row.data, 'author')?.title ?? 'Unattributed',
			category: related<{ title: string }>(row.data, 'category')?.title ?? null
		}))
	};
};
