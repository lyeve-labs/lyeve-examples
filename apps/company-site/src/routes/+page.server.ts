import { page, openings } from '$lib/server/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Two independent reads, so they go out together rather than in series.
	const [home, roles] = await Promise.all([page('home'), openings()]);

	return {
		home,
		// The teaser shows the first three in the site's own running order. The
		// engine has no sort parameter and no way to ask for three rows, so both
		// happen here.
		featuredRoles: roles.slice(0, 3),
		openRoleCount: roles.length
	};
};
