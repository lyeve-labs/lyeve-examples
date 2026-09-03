import { error } from '@sveltejs/kit';
import { page, team } from '$lib/server/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [about, people] = await Promise.all([page('about'), team()]);
	if (!about) error(404, 'The about page has not been provisioned yet');

	return { about, team: people };
};
