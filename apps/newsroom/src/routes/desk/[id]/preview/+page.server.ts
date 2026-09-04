import { error } from '@sveltejs/kit';
import { getStoryForPreview } from '$lib/server/stories';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// This is the same public read route the site uses, addressed by id instead
	// of by slug. The list route narrows to published rows. The get-by-id route
	// selects on id and tenant and nothing else, so an unpublished story comes
	// back in full. That asymmetry is what makes an editor preview possible
	// without a second store, and it is also the reason a story id is not a safe
	// thing to hand to someone who should only see the published site.
	const story = await getStoryForPreview(params.id);
	if (!story) error(404, 'No such story');

	return { story };
};
