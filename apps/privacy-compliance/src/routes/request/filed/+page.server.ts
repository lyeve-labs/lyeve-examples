import { RESPONSE_DAYS } from '$lib/desk';
import type { PageServerLoad } from './$types';

/**
 * The receipt.
 *
 * It reads nothing back from the engine. Echoing the filed record would mean
 * looking it up by a reference that arrives in a query string, which turns the
 * receipt into a way to read other people's requests.
 */
export const load: PageServerLoad = async ({ url }) => {
	const ref = url.searchParams.get('ref') ?? '';
	return {
		reference: /^privacy-request-[a-z-]+-[0-9a-f]{8}$/.test(ref) ? ref : '',
		responseDays: RESPONSE_DAYS
	};
};
