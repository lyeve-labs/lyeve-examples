import { listContent, relationId, search, type ContentEntry } from '$lib/lyeve';
import { lyeve, PAGES, SPACES } from './lyeve';
import type { DocPage } from '$lib/tree';
import { excerpt } from '$lib/prose';

/** The engine clamps a list request into 25..200, so this is the widest page. */
const ENGINE_MAX_LIMIT = 200;

/** An offset loop needs its own bound: a response that never comes back short
 *  would page forever. No space here is anywhere near this. */
const MAX_ROWS = 5000;

export interface DocSpace {
	id: string;
	title: string;
	slug: string;
	summary: string;
	order: number;
}

export interface DocPageContent extends DocPage {
	body: string;
}

export interface DocHit {
	id: string;
	title: string;
	slug: string;
	spaceSlug: string | null;
	spaceTitle: string | null;
	excerpt: string;
}

// Declared as type aliases rather than interfaces so they stay assignable to
// the Record<string, unknown> that relationId takes.
type SpaceFields = {
	title: string;
	slug: string;
	summary?: string;
	order_index?: number | string;
};

type PageFields = {
	title: string;
	slug: string;
	body?: string;
	order_index?: number | string;
};

export async function listSpaces(): Promise<DocSpace[]> {
	const rows = await readAll<SpaceFields>(SPACES);
	return rows.map(toSpace).sort(byOrder);
}

export async function findSpace(slug: string): Promise<DocSpace | null> {
	// The engine has no get-by-slug route, so a slug lookup is a list filtered
	// down to one row. filters[] is exact equality, which is all a slug needs.
	const rows = await listContent<SpaceFields>(lyeve, SPACES, { filters: { slug }, limit: 25 });
	const row = rows.find((entry) => entry.data.slug === slug);
	return row ? toSpace(row) : null;
}

/**
 * Every page of one space, flat and in whatever order the engine returned.
 *
 * Bodies come back whether or not the caller wants them: there is no field
 * projection on a content read. The page view takes advantage of that and
 * builds its navigation tree and renders its body from this one response.
 */
export async function readSpacePages(spaceId: string): Promise<DocPageContent[]> {
	const rows = await readAll<PageFields>(PAGES, { space_id: spaceId });
	return rows.map((row) => ({
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		order: toOrder(row.data.order_index),
		// A belongs_to relation is written under its own name and read back
		// under <field>_id. relationId reads whichever one is present.
		parentId: relationId(row.data, 'parent'),
		body: row.data.body ?? ''
	}));
}

/**
 * The tree-shaped view of a set of pages, without the bodies.
 *
 * Everything a load returns is serialized into the page, and navigation
 * renders titles only, so the bodies stop here.
 */
export function outline(pages: DocPageContent[]): DocPage[] {
	return pages.map(({ body, ...page }) => page);
}

/**
 * Page counts per space.
 *
 * A list response is a bare array with no total, so counting rows means
 * reading them. For a catalog this size that is one request.
 */
export async function countPagesBySpace(): Promise<Record<string, number>> {
	const rows = await readAll<PageFields>(PAGES);
	const counts: Record<string, number> = {};
	for (const row of rows) {
		const spaceId = relationId(row.data, 'space');
		if (spaceId) counts[spaceId] = (counts[spaceId] ?? 0) + 1;
	}
	return counts;
}

/**
 * Full text search over the pages, scoped to one content type.
 *
 * Search is an admin route with no public equivalent, which is the reason the
 * portal proxies the query instead of letting the browser reach the engine.
 * The route filters by content type, status and tags, so scoping a search to
 * one space is not something it can express: the space is resolved per hit.
 */
export async function searchPages(
	query: string,
	spaces: DocSpace[]
): Promise<{ total: number; hits: DocHit[] }> {
	if (!query.trim()) return { total: 0, hits: [] };

	const response = await search(lyeve, query, { schema: PAGES, limit: 20 });
	const spaceById = new Map(spaces.map((space) => [space.id, space]));

	return {
		total: response.total,
		hits: response.results.map((hit) => {
			// The index stores the body exactly as it was written, so the
			// relation is under `space` here and under `space_id` on a read.
			const spaceId = typeof hit.body?.space === 'string' ? hit.body.space : '';
			const space = spaceById.get(spaceId) ?? null;
			const body = typeof hit.body?.body === 'string' ? hit.body.body : '';
			return {
				id: hit.entry_id,
				title: hit.title,
				slug: hit.slug,
				spaceSlug: space?.slug ?? null,
				spaceTitle: space?.title ?? null,
				excerpt: excerpt(body)
			};
		})
	};
}

/**
 * Reads every row of a type, one engine page at a time.
 *
 * A list is capped at 200 rows and reports no total, so the only way to know a
 * page was the last one is to see it come back short.
 */
async function readAll<T>(
	schema: string,
	filters: Record<string, string> = {}
): Promise<ContentEntry<T>[]> {
	const all: ContentEntry<T>[] = [];
	for (let offset = 0; offset < MAX_ROWS; offset += ENGINE_MAX_LIMIT) {
		const rows = await listContent<T>(lyeve, schema, { limit: ENGINE_MAX_LIMIT, offset, filters });
		all.push(...rows);
		if (rows.length < ENGINE_MAX_LIMIT) break;
	}
	return all;
}

function toSpace(row: ContentEntry<SpaceFields>): DocSpace {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		summary: row.data.summary ?? '',
		order: toOrder(row.data.order_index)
	};
}

function byOrder(a: { order: number; title: string }, b: { order: number; title: string }): number {
	return a.order - b.order || a.title.localeCompare(b.title);
}

/**
 * A number field is a NUMERIC column. PostgreSQL hands it back as a JSON
 * number, other drivers as a string, so both shapes are accepted here rather
 * than in every caller.
 */
function toOrder(value: number | string | undefined): number {
	const n = typeof value === 'string' ? Number(value) : value;
	return typeof n === 'number' && Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}
