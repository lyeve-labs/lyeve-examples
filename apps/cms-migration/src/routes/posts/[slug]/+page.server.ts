import { error } from '@sveltejs/kit';
import { getContentBySlug, related } from '$lib/lyeve';
import { lyeve, POSTS } from '$lib/server/lyeve';
import type { PageServerLoad } from './$types';

interface Post {
	title: string;
	slug: string;
	legacy_id?: string;
	standfirst?: string;
	body_html?: string;
	section?: string;
	published_at?: string;
}

export const load: PageServerLoad = async ({ params }) => {
	// There is no get-by-slug route, so this is a filtered list of one. Populate
	// inflates the byline in the same request rather than costing a second one.
	const row = await getContentBySlug<Post>(lyeve, POSTS, params.slug, { populate: ['author'] });
	if (!row) error(404, 'Not found');

	const author = related<{ title: string; role?: string; bio?: string; legacy_id?: string }>(
		row.data,
		'author'
	);

	return {
		post: {
			title: row.data.title,
			legacyId: row.data.legacy_id ?? null,
			standfirst: row.data.standfirst ?? '',
			bodyHtml: row.data.body_html ?? '',
			section: row.data.section ?? null,
			publishedAt: row.data.published_at ?? null,
			importedAt: row.created_at
		},
		author: author
			? { name: author.title, role: author.role ?? null, bio: author.bio ?? null }
			: null
	};
};
