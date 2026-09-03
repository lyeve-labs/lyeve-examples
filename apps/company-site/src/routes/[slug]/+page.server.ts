import { error } from '@sveltejs/kit';
import { page } from '$lib/server/site';
import type { PageServerLoad } from './$types';

/**
 * Serves any site_pages entry that does not have a hand-written route.
 *
 * Marketing pages come and go without a deploy: writing one in the admin UI
 * publishes it here. Home and about are the exceptions, because they render
 * more than their own body.
 */
export const load: PageServerLoad = async ({ params }) => {
	const entry = await page(params.slug);
	if (!entry) error(404, 'No such page');

	return { page: entry };
};
