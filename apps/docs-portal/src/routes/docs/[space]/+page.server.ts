import { error } from '@sveltejs/kit';
import { findSpace, outline, readSpacePages } from '$lib/server/docs';
import { buildTree } from '$lib/tree';
import { excerpt } from '$lib/prose';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const space = await findSpace(params.space);
	if (!space) error(404, 'No such space');

	const pages = await readSpacePages(space.id);
	const bodies = new Map(pages.map((page) => [page.id, page.body]));
	const tree = buildTree(outline(pages));

	return {
		space,
		tree,
		sections: tree.map((node) => ({
			id: node.id,
			title: node.title,
			slug: node.slug,
			excerpt: excerpt(bodies.get(node.id) ?? '', 140),
			children: node.children.map((child) => ({
				id: child.id,
				title: child.title,
				slug: child.slug
			}))
		}))
	};
};
