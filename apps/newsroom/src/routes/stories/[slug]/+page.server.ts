import { error } from '@sveltejs/kit';
import { getPublishedStory } from '$lib/server/stories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// A slug lookup is a filtered list, and the engine's draft filter applies to
	// a filtered list exactly as it does to an unfiltered one. An unpublished
	// story is a 404 here even though it is readable by id, which is the whole
	// difference between this page and the desk preview.
	const story = await getPublishedStory(params.slug);
	if (!story) error(404, 'No such story');

	return { story };
};
