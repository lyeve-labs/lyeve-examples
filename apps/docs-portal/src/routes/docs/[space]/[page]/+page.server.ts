import { error } from '@sveltejs/kit';
import { findSpace, outline, readSpacePages } from '$lib/server/docs';
import { buildTree, neighbors, pathTo } from '$lib/tree';
import { toBlocks } from '$lib/prose';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const space = await findSpace(params.space);
	if (!space) error(404, 'No such space');

	// One read serves the navigation and the article. A content read has no
	// field projection, so the rows that build the tree already carry every
	// body, and asking again for this one page would be a wasted round trip.
	const pages = await readSpacePages(space.id);
	const current = pages.find((page) => page.slug === params.page);
	if (!current) error(404, 'No such page');

	const tree = buildTree(outline(pages));

	// Previous and next follow the reading order of the tree, which is the
	// order field applied depth first. The engine cannot express that ordering:
	// it returns rows newest first and takes no sort parameter.
	const { prev, next } = neighbors(tree, current.slug);
	const trail = pathTo(tree, current.slug).slice(0, -1);

	return {
		space,
		tree,
		page: {
			title: current.title,
			slug: current.slug,
			blocks: toBlocks(current.body)
		},
		trail: trail.map((node) => ({ title: node.title, slug: node.slug })),
		prev: prev ? { title: prev.title, slug: prev.slug } : null,
		next: next ? { title: next.title, slug: next.slug } : null
	};
};
