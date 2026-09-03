import { pagesInSection } from '$lib/server/site';
import type { LayoutServerLoad } from './$types';

/**
 * The footer column is content, not markup, so it is loaded once for every page
 * rather than restated in each route. filters[section] is the engine's only
 * server-side narrowing: exact equality on one column, no operators.
 */
export const load: LayoutServerLoad = async () => {
	const resources = await pagesInSection('resources');

	return {
		footerLinks: resources.map((p) => ({ slug: p.slug, title: p.title }))
	};
};
