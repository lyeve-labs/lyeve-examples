import { searchPages } from '$lib/server/docs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, parent }) => {
	const query = url.searchParams.get('q') ?? '';
	const { spaces } = await parent();
	const { total, hits } = await searchPages(query, spaces);

	return { query, total, hits };
};
