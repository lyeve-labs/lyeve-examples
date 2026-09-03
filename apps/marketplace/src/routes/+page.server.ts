import { error } from '@sveltejs/kit';
import { loadCategories, loadProducts, loadSellers } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const wanted = url.searchParams.get('category');
	const [categories, sellers] = await Promise.all([loadCategories(), loadSellers()]);

	const selected = wanted ? categories.find((category) => category.slug === wanted) : undefined;
	if (wanted && !selected) error(404, 'No such category');

	// Filtering belongs to the engine: a browse page should not pull rows it is
	// never going to show. filters[] is exact equality against a stored column,
	// and a belongs_to relation stores its target under `<field>_id`, so the key
	// is category_id. Asking for filters[category] is a 400.
	//
	// Ordering does not belong to the engine, because the engine has none. The
	// page does that itself.
	const products = await loadProducts(selected ? { category_id: selected.id } : {});

	return { categories, sellers, products, selected: selected?.slug ?? null };
};
