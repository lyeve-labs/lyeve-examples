import { findReaderById } from '$lib/server/members';
import type { LayoutServerLoad } from './$types';

/**
 * Resolves the signed-in reader once for the whole tree. Pages that gate on it
 * take it from `await parent()` rather than fetching it a second time.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const reader = locals.readerId ? await findReaderById(locals.readerId) : null;
	return { reader };
};
