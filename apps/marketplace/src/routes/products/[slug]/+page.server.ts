import { error } from '@sveltejs/kit';
import { loadProductDetail } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const detail = await loadProductDetail(params.slug);
	if (!detail) error(404, 'No such product');
	return detail;
};
