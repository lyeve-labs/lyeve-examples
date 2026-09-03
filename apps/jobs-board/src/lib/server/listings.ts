import {
	listContent, related, relationId, type ContentEntry, type SearchHit
} from '$lib/lyeve';
import { lyeve, COMPANIES } from './lyeve';
import { employmentLabel, formatSalary, toNumber } from '$lib/jobs';

/**
 * Declared as type aliases rather than interfaces on purpose: only an alias
 * gets an implicit index signature, and without one TypeScript refuses to hand
 * the row to `related`, which takes a plain record.
 */
export type ListingData = {
	title: string;
	slug: string;
	summary?: string;
	body?: string;
	location?: string;
	employment_type?: string;
	salary_min?: number | string;
	salary_max?: number | string;
};

export type CompanyData = {
	title: string;
	slug: string;
	bio?: string;
	website?: string;
};

export interface JobCard {
	id: string;
	title: string;
	slug: string;
	company: string;
	location: string;
	employmentType: string;
	employmentLabel: string;
	salary: string;
	salaryTop: number;
	summary: string;
}

/**
 * Every company, keyed by the id a listing's relation stores.
 *
 * Only the search path needs this. A `/api/v1` read can ask the engine to
 * populate the relation, but search returns the entry body exactly as it was
 * written, and in that body a relation is a bare id.
 */
export async function companyIndex(): Promise<Map<string, CompanyData>> {
	const rows = await listContent<CompanyData>(lyeve, COMPANIES, { limit: 200 });
	return new Map(rows.map((row) => [row.id, row.data]));
}

export function cardFromRow(row: ContentEntry<ListingData>): JobCard {
	const company = related<CompanyData>(row.data, 'company');
	return card(row.id, row.data, company?.title ?? 'Company withheld');
}

export function cardFromHit(hit: SearchHit, companies: Map<string, CompanyData>): JobCard {
	const data = hit.body as unknown as ListingData;
	const id = companyIdOf(hit.body);
	const company = id ? companies.get(id) : null;
	const withHeader = { ...data, title: hit.title, slug: hit.slug };
	return card(hit.entry_id, withHeader, company?.title ?? 'Company withheld');
}

function card(id: string, data: ListingData, company: string): JobCard {
	return {
		id,
		title: data.title ?? 'Untitled role',
		slug: data.slug ?? '',
		company,
		location: data.location ?? 'Location not stated',
		employmentType: data.employment_type ?? '',
		employmentLabel: employmentLabel(data.employment_type),
		salary: formatSalary(data.salary_min, data.salary_max),
		salaryTop: toNumber(data.salary_max) ?? toNumber(data.salary_min) ?? 0,
		summary: data.summary ?? ''
	};
}

/**
 * A relation is written under its own name and read back as `<name>_id`, so the
 * two sides of the product hand it over differently: relationId covers the read
 * shape, and the fallback covers a search hit, which replays the write shape.
 */
function companyIdOf(data: Record<string, unknown>): string | null {
	const id = relationId(data, 'company');
	if (id) return id;
	return typeof data.company === 'string' && data.company ? data.company : null;
}
