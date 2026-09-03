import { error } from '@sveltejs/kit';
import { loadProducts, loadSeller } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const seller = await loadSeller(params.slug);
	if (!seller) error(404, 'No such seller');

	// The same exact-equality filter the category chips use, on the other
	// relation. The engine stores a belongs_to under `<field>_id`, so a seller's
	// products are the rows whose seller_id is this row's id.
	const products = await loadProducts({ seller_id: seller.id });

	return { seller, products };
};
