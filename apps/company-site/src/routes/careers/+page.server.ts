import { openings } from '$lib/server/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const department = url.searchParams.get('department') ?? '';

	// The unfiltered set is what the department chips are built from, so it is
	// always read. The second read exists to use the engine's filter rather than
	// narrowing the same rows in memory: filters[col] is exact equality on one
	// column and it is the only server-side narrowing the engine offers, so a
	// corpus large enough to matter has to go through it.
	const all = await openings();
	const departments = [...new Set(all.map((r) => r.department).filter(Boolean))].sort();
	const roles = department ? await openings(department) : all;

	return { roles, departments, department };
};
