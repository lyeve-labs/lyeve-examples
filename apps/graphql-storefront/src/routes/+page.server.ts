import { loadCollectionIndex } from '$lib/server/storefront';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { collections: await loadCollectionIndex() };
};
