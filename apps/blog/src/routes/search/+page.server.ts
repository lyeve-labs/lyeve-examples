import { search } from '$lib/lyeve';
import { lyeve, POSTS } from '$lib/server/lyeve';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q') ?? '';

	// Search lives on the admin router only. There is no public equivalent, so
	// so this page is the reason the app proxies rather than letting the browser
	// call the engine directly.
	const results = await search(lyeve, query, { schema: POSTS, limit: 20 });

	return {
		query,
		total: results.total,
		hits: results.results.map((hit) => ({
			id: hit.entry_id,
			title: hit.title,
			slug: hit.slug,
			excerpt: typeof hit.body?.excerpt === 'string' ? hit.body.excerpt : ''
		}))
	};
};
