import { listContent, getContent, getContentBySlug, related } from '$lib/lyeve';
import { lyeve, STORIES } from './lyeve';

/**
 * A story as the public read routes return it.
 *
 * `_status` is a system column, not a field this app declared. It exists
 * because `news_stories` was applied with `with_draft_publish: true`, and on
 * every dialect the read projection includes it.
 */
export interface StoryFields {
	title: string;
	slug: string;
	standfirst?: string;
	body?: string;
	dateline?: string;
	cover_media_id?: string;
	_status?: string;
}

/** A story as the admin content route returns it, which is a different record. */
export interface DeskEntry {
	id: string;
	schema: string;
	slug: string;
	title: string;
	body: Record<string, unknown>;
	status: 'draft' | 'published' | 'archived';
	published_at?: string;
	scheduled_publish_at?: string;
	scheduled_unpublish_at?: string;
	current_rev: number;
	created_at: string;
	updated_at: string;
}

interface Paginated<T> {
	data: T[];
	total_count: number;
	limit: number;
	offset: number;
}

/**
 * The three values the engine's own `SetStatus` accepts in `_status`.
 *
 * Only two of them are reachable over HTTP: the publish route writes
 * `published` and the unpublish route writes `draft`, and no route passes
 * `archived`. The third is read anyway, so that a row holding it cannot hide
 * from the drift check below.
 */
export const PUBLIC_STATUSES = ['published', 'draft', 'archived'] as const;
export type PublicStatus = (typeof PUBLIC_STATUSES)[number];

export interface FrontPageStory {
	id: string;
	title: string;
	slug: string;
	standfirst: string;
	dateline: string;
	coverId: string | null;
	filedAt: string;
	desk: string | null;
	reporter: string;
}

/**
 * The public front page.
 *
 * This is a plain `GET /api/v1/content/news_stories`, with no status parameter
 * of any kind. The schema carries `with_draft_publish`, so the engine appends
 * `(_status = 'published' OR _status IS NULL)` to the query itself. Anything
 * this returns is a story the engine considers published.
 */
export async function listPublishedStories(limit = 25): Promise<FrontPageStory[]> {
	const rows = await listContent<StoryFields>(lyeve, STORIES, {
		limit,
		populate: ['desk', 'reporter']
	});
	return rows.map(toFrontPageStory);
}

/**
 * One story for the public site.
 *
 * A slug lookup is a filtered list, and the draft filter above applies to it
 * too, so an unpublished story is a 404 here. That is the difference between
 * this and the desk preview: see `getStoryForPreview`.
 */
export async function getPublishedStory(slug: string) {
	const row = await getContentBySlug<StoryFields>(lyeve, STORIES, slug, {
		populate: ['desk', 'reporter']
	});
	if (!row) return null;
	return {
		...toFrontPageStory(row),
		body: row.data.body ?? '',
		reporterBio: related<{ bio?: string }>(row.data, 'reporter')?.bio ?? null
	};
}

/**
 * One story for the desk, read through the public route by id.
 *
 * The get-by-id route applies no draft filter: it selects on id and tenant and
 * nothing else. An unpublished story is therefore readable here while being
 * absent from every list, which is what makes an editor preview possible
 * without a second copy of the content, and is also worth knowing before
 * treating an id as a safe thing to hand out.
 */
export async function getStoryForPreview(id: string) {
	const row = await getContent<StoryFields>(lyeve, STORIES, id, {
		populate: ['desk', 'reporter']
	});
	if (!row) return null;
	return {
		...toFrontPageStory(row),
		body: row.data.body ?? '',
		publicStatus: row.data._status ?? null
	};
}

/**
 * The desk list, over every status.
 *
 * This is the admin content route, not the public one. It pages properly: a
 * caller-chosen limit up to 500 and a real `total_count`, neither of which the
 * public read route offers. It also reads `sys_content_entries`, so `status`
 * here is the desk's own status and has nothing to do with `_status`.
 */
export async function listDeskStories(
	status: string | null,
	limit = 50,
	offset = 0
): Promise<Paginated<DeskEntry>> {
	const q = new URLSearchParams({ schema: STORIES, limit: String(limit), offset: String(offset) });
	if (status) q.set('status', status);
	const res = await lyeve.request<Paginated<DeskEntry>>('admin', `/api/admin/content?${q}`);
	return { ...res, data: Array.isArray(res.data) ? res.data : [] };
}

export async function getDeskStory(id: string): Promise<DeskEntry | null> {
	try {
		return await lyeve.request<DeskEntry>('admin', `/api/admin/content/${id}`);
	} catch (err) {
		if (isNotFound(err)) return null;
		throw err;
	}
}

/**
 * Maps every story id to the `_status` the public read table holds for it.
 *
 * There is no way to ask the public route for rows of any status: the filter is
 * exact equality, so this asks once per value. Three requests is the honest
 * cost of reading a column the route is built to hide.
 */
export async function readPublicStatuses(): Promise<Map<string, PublicStatus>> {
	const pages = await Promise.all(
		PUBLIC_STATUSES.map((status) =>
			listContent<StoryFields>(lyeve, STORIES, { limit: 200, filters: { _status: status } }).then(
				(rows) => [status, rows] as const
			)
		)
	);
	const out = new Map<string, PublicStatus>();
	for (const [status, rows] of pages) {
		for (const row of rows) out.set(row.id, status);
	}
	return out;
}

/**
 * Reports which stories disagree with themselves.
 *
 * The desk status and the public status are two separate columns in two
 * separate tables, and no engine route writes both. Anything listed here was
 * moved on one side only.
 */
export function findStatusDrift(
	entries: DeskEntry[],
	publicStatuses: Map<string, PublicStatus>
): { entry: DeskEntry; publicStatus: PublicStatus | 'missing' }[] {
	return entries
		.map((entry) => ({ entry, publicStatus: publicStatuses.get(entry.id) ?? ('missing' as const) }))
		.filter(({ entry, publicStatus }) => publicStatus !== expectedPublicStatus(entry.status));
}

/**
 * What `_status` should hold for a given desk status if the two were aligned.
 *
 * An archived story maps to `draft` rather than `archived`, because `draft` is
 * the only value the unpublish route writes and it is what takes the story off
 * the public list. The desk keeps the distinction. The public table cannot.
 */
/**
 * The public status a desk status implies.
 *
 * Only two of the three desk states have a public equivalent, because the
 * engine offers publish and unpublish and nothing else. An archived story is
 * unpublished: archiving is a desk decision that must not leave the story
 * readable, so the return type is narrowed to what the routes accept rather
 * than carrying a third state no caller could act on.
 */
export function expectedPublicStatus(deskStatus: DeskEntry['status']): 'published' | 'draft' {
	return deskStatus === 'published' ? 'published' : 'draft';
}

function toFrontPageStory(row: {
	id: string;
	data: StoryFields;
	created_at: string;
}): FrontPageStory {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		standfirst: row.data.standfirst ?? '',
		dateline: row.data.dateline ?? '',
		coverId: row.data.cover_media_id ?? null,
		filedAt: row.created_at,
		desk: related<{ title: string }>(row.data, 'desk')?.title ?? null,
		reporter: related<{ title: string }>(row.data, 'reporter')?.title ?? 'Staff reporter'
	};
}

export function isNotFound(err: unknown): boolean {
	return !!err && typeof err === 'object' && (err as { status?: number }).status === 404;
}

/** Reads a field the desk stores inside the entry body. */
export function bodyField(body: Record<string, unknown>, key: string): string {
	const v = body[key];
	return typeof v === 'string' ? v : '';
}
