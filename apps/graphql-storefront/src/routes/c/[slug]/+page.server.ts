import { error } from '@sveltejs/kit';
import { loadCollection } from '$lib/server/storefront';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// One document, two root fields: the collection and its products. Over REST
	// this is necessarily two requests, because filtering products by their
	// collection needs the collection's id and the id needs the slug lookup.
	const view = await loadCollection(params.slug);
	if (!view) error(404, 'No such collection');
	return view;
};
