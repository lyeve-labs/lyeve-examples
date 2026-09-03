import { listContent, search } from '$lib/lyeve';
import { lyeve, LISTINGS } from '$lib/server/lyeve';
import {
	cardFromHit, cardFromRow, companyIndex, type JobCard, type ListingData
} from '$lib/server/listings';
import { isEmploymentType } from '$lib/jobs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim();
	const typeParam = url.searchParams.get('type') ?? '';
	const type = isEmploymentType(typeParam) ? typeParam : '';
	const sort = url.searchParams.get('sort') === 'salary' ? 'salary' : 'newest';

	let jobs = query ? await searchJobs(query) : await browseJobs(type);

	// Search takes a schema and a query and nothing else, so the employment
	// filter that the engine applies on a browse has to be applied here.
	if (query && type) jobs = jobs.filter((job) => job.employmentType === type);

	// The engine has no sort parameter. Rows arrive created_at DESC, which is
	// the newest-first order, and any other order is the app's job.
	if (sort === 'salary') jobs = [...jobs].sort((a, b) => b.salaryTop - a.salaryTop);

	return { jobs, query, type, sort };
};

async function browseJobs(type: string): Promise<JobCard[]> {
	// populate turns each company id into the whole company record in one round
	// trip. Without it every card would need a second request for its employer.
	const rows = await listContent<ListingData>(lyeve, LISTINGS, {
		limit: 200,
		populate: ['company'],
		filters: type ? { employment_type: type } : undefined
	});
	return rows.map(cardFromRow);
}

async function searchJobs(query: string): Promise<JobCard[]> {
	// Search is an admin route. There is no public equivalent, which is the
	// reason this page renders on the server rather than in the browser.
	const found = await search(lyeve, query, { schema: LISTINGS, limit: 50 });
	if (found.results.length === 0) return [];

	const companies = await companyIndex();
	return found.results
		.filter((hit) => hit.status !== 'archived')
		.map((hit) => cardFromHit(hit, companies));
}
