import { error } from '@sveltejs/kit';
import { getContentBySlug, related } from '$lib/lyeve';
import { lyeve, POSTS } from '$lib/server/lyeve';
import type { PageServerLoad } from './$types';

interface Post {
	title: string;
	slug: string;
	body?: string;
	excerpt?: string;
	cover_media_id?: string;
}

export const load: PageServerLoad = async ({ params }) => {
	// There is no "get by slug" route on the engine, so this is a filtered list
	// of one. filters[] is exact equality, which is all a slug lookup needs.
	const row = await getContentBySlug<Post>(lyeve, POSTS, params.slug, {
		populate: ['author', 'category']
	});
	if (!row) error(404, 'No such post');

	return {
		post: {
			title: row.data.title,
			body: row.data.body ?? '',
			excerpt: row.data.excerpt ?? '',
			coverId: row.data.cover_media_id ?? null,
			publishedAt: row.created_at,
			author: related<{ title: string; bio?: string }>(row.data, 'author'),
			category: related<{ title: string }>(row.data, 'category')?.title ?? null
		}
	};
};
