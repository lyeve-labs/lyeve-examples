import { listPublishedStories } from '$lib/server/stories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const stories = await listPublishedStories(25);

	return {
		stories,
		// Named on the page, because "only published stories" is a claim worth
		// being able to check.
		readPath: 'GET /api/v1/content/news_stories?populate=desk,reporter',
		appliedFilter: "(_status = 'published' OR _status IS NULL), added by the engine"
	};
};
