import {
	listContent,
	getContentBySlug,
	related,
	relationId,
	type ContentEntry
} from '$lib/lyeve';
import { lyeve, PAGES, TEAM, OPENINGS } from './lyeve';

export interface PageFields {
	title: string;
	slug: string;
	section?: string;
	summary?: string;
	body?: string;
	hero_media_id?: string;
}

export interface TeamFields {
	title: string;
	slug: string;
	role?: string;
	location?: string;
	bio?: string;
	photo_media_id?: string;
	sort_order?: number | string;
}

export interface OpeningFields {
	title: string;
	slug: string;
	location?: string;
	department?: string;
	employment_type?: string;
	summary?: string;
	body?: string;
	sort_order?: number | string;
}

export interface Page {
	title: string;
	slug: string;
	section: string;
	summary: string;
	body: string;
	heroId: string | null;
	updatedAt: string;
}

export interface TeamMember {
	id: string;
	name: string;
	slug: string;
	role: string;
	location: string;
	bio: string;
	photoId: string | null;
	order: number;
}

export interface Opening {
	id: string;
	title: string;
	slug: string;
	location: string;
	department: string;
	employmentType: string;
	summary: string;
	body: string;
	order: number;
	updatedAt: string;
	/** True when a manager is on the record, whether or not this read inflated it. */
	hiringManagerAssigned: boolean;
	hiringManager: { name: string; role: string } | null;
}

/**
 * A number field arrives as a JSON number on PostgreSQL and can arrive as a
 * string on the other dialects, because each builds the row's JSON a different
 * way. Coercing once here keeps every caller's sort honest.
 */
function order(value: number | string | undefined): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function toPage(row: ContentEntry<PageFields>): Page {
	return {
		title: row.data.title,
		slug: row.data.slug,
		section: row.data.section ?? '',
		summary: row.data.summary ?? '',
		body: row.data.body ?? '',
		heroId: row.data.hero_media_id ?? null,
		updatedAt: row.updated_at
	};
}

function toMember(row: ContentEntry<TeamFields>): TeamMember {
	return {
		id: row.id,
		name: row.data.title,
		slug: row.data.slug,
		role: row.data.role ?? '',
		location: row.data.location ?? '',
		bio: row.data.bio ?? '',
		photoId: row.data.photo_media_id ?? null,
		order: order(row.data.sort_order)
	};
}

function toOpening(row: ContentEntry<OpeningFields>): Opening {
	// The two halves of a relation. relationId reads hiring_manager_id, which is
	// there whether or not the request populated. Related reads the inflated
	// record, which is only there when it did. Reading row.data.hiring_manager
	// directly gives null on an unpopulated read and looks like an unassigned
	// role.
	const managerId = relationId(row.data, 'hiring_manager');
	const manager = related<{ title: string; role?: string }>(row.data, 'hiring_manager');
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		location: row.data.location ?? '',
		department: row.data.department ?? '',
		employmentType: row.data.employment_type ?? '',
		summary: row.data.summary ?? '',
		body: row.data.body ?? '',
		order: order(row.data.sort_order),
		updatedAt: row.updated_at,
		hiringManagerAssigned: managerId !== null,
		hiringManager: manager ? { name: manager.title, role: manager.role ?? '' } : null
	};
}

export async function page(slug: string): Promise<Page | null> {
	const row = await getContentBySlug<PageFields>(lyeve, PAGES, slug);
	return row ? toPage(row) : null;
}

export async function pages(): Promise<Page[]> {
	const rows = await listContent<PageFields>(lyeve, PAGES, { limit: 200 });
	return rows.map(toPage);
}

/** Pages grouped into one part of the site, used for the footer column. */
export async function pagesInSection(section: string): Promise<Page[]> {
	const rows = await listContent<PageFields>(lyeve, PAGES, { limit: 200, filters: { section } });
	return rows.map(toPage).sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * The engine returns rows created_at DESC and takes no sort parameter, so the
 * running order the site wants is carried in a field and applied here.
 */
export async function team(): Promise<TeamMember[]> {
	const rows = await listContent<TeamFields>(lyeve, TEAM, { limit: 200 });
	return rows.map(toMember).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function openings(department?: string): Promise<Opening[]> {
	const rows = await listContent<OpeningFields>(lyeve, OPENINGS, {
		limit: 200,
		populate: ['hiring_manager'],
		...(department ? { filters: { department } } : {})
	});
	return rows.map(toOpening).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export async function opening(slug: string): Promise<Opening | null> {
	const row = await getContentBySlug<OpeningFields>(lyeve, OPENINGS, slug, {
		populate: ['hiring_manager']
	});
	return row ? toOpening(row) : null;
}
