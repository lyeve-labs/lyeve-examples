import { error } from '@sveltejs/kit';
import { loadProduct } from '$lib/server/storefront';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// One document, three root fields: the product, its reviews, and every
	// collection. The last of those is over-fetching, and it is what buys the
	// single round trip. See the note on ProductPage in queries.ts.
	const detail = await loadProduct(params.slug);
	if (!detail) error(404, 'No such product');
	return detail;
};
