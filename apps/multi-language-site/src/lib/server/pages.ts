import { listContent, getContentBySlug, relationId, type ContentEntry } from '$lib/lyeve';
import { lyeve, PAGES, SECTIONS } from './lyeve';

/**
 * The untranslated half of the site.
 *
 * Content entries hold the source record: the slug, the navigation position,
 * the section a page belongs to, and the English text the site was written in.
 * The engine localizes title, body and meta and nothing else, so everything
 * structural is read from here and only the prose comes from the localization
 * plugin.
 */

interface SectionData {
	title: string;
	slug: string;
	position?: number;
}

interface PageData {
	title: string;
	slug: string;
	summary?: string;
	body?: string;
	position?: number;
}

export interface SiteSection {
	id: string;
	title: string;
	slug: string;
	position: number;
}

export interface SitePage {
	id: string;
	title: string;
	slug: string;
	summary: string;
	body: string;
	position: number;
	sectionId: string | null;
}

/** A page and a section are both content entries, and both carry translations. */
export interface SiteEntry {
	id: string;
	kind: 'page' | 'section';
	title: string;
	slug: string;
	summary: string;
	body: string;
}

export async function loadSections(): Promise<SiteSection[]> {
	const rows = await listContent<SectionData>(lyeve, SECTIONS, { limit: 200 });
	return rows.map(toSection).sort(byPosition);
}

export async function loadPages(): Promise<SitePage[]> {
	const rows = await listContent<PageData>(lyeve, PAGES, { limit: 200 });
	return rows.map(toPage).sort(byPosition);
}

export async function findPage(slug: string): Promise<SitePage | null> {
	const row = await getContentBySlug<PageData>(lyeve, PAGES, slug);
	return row ? toPage(row) : null;
}

/**
 * Finds a page or a section by slug, for the translation editor.
 *
 * Pages are tried first. The two content types are separate tables, so a slug
 * that exists in both would be ambiguous, and this site does not have one.
 */
export async function findEntryBySlug(slug: string): Promise<SiteEntry | null> {
	const page = await getContentBySlug<PageData>(lyeve, PAGES, slug);
	if (page) {
		const p = toPage(page);
		return { id: p.id, kind: 'page', title: p.title, slug: p.slug, summary: p.summary, body: p.body };
	}

	const section = await getContentBySlug<SectionData>(lyeve, SECTIONS, slug);
	if (section) {
		const s = toSection(section);
		return { id: s.id, kind: 'section', title: s.title, slug: s.slug, summary: '', body: '' };
	}
	return null;
}

function toSection(row: ContentEntry<SectionData>): SiteSection {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		position: Number(row.data.position ?? 0)
	};
}

function toPage(row: ContentEntry<PageData>): SitePage {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		summary: row.data.summary ?? '',
		body: row.data.body ?? '',
		position: Number(row.data.position ?? 0),
		// A relation is written as `section` and read back as `section_id`, with
		// a permanently null `section` key alongside it unless the request
		// populated the relation. relationId reads whichever is there.
		sectionId: relationId(row.data, 'section')
	};
}

/**
 * The engine takes no sort parameter and always answers created_at DESC, so a
 * navigation order has to be a field the site sorts on itself.
 */
function byPosition(a: { position: number; title: string }, b: { position: number; title: string }) {
	return a.position - b.position || a.title.localeCompare(b.title);
}
