import { countPagesBySpace } from '$lib/server/docs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const [{ spaces }, counts] = await Promise.all([parent(), countPagesBySpace()]);

	return {
		overview: spaces.map((space) => ({ ...space, pageCount: counts[space.id] ?? 0 }))
	};
};
