import { listSpaces } from '$lib/server/docs';
import type { LayoutServerLoad } from './$types';

// The header navigation is the space list, so it loads once here and every
// page reuses it through `await parent()` instead of reading it again.
export const load: LayoutServerLoad = async () => {
	return { spaces: await listSpaces() };
};
