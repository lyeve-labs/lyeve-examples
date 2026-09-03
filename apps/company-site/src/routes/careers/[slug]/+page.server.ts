import { error } from '@sveltejs/kit';
import { opening } from '$lib/server/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// The engine has no get-by-slug route, so this is a filtered list of one.
	// The hiring manager is populated in the same request. Without that the
	// relation reads back as hiring_manager_id and the page would need a second
	// round trip to turn the id into a name.
	const role = await opening(params.slug);
	if (!role) error(404, 'No such role');

	return { role };
};
