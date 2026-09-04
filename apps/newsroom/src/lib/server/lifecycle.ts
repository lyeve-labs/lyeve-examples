import { lyeve, STORIES } from './lyeve';
import { expectedPublicStatus, getDeskStory, type DeskEntry } from './stories';
import { getRevision } from './revisions';

/**
 * A story's status is two columns in two tables, and no engine route writes
 * both.
 *
 *   sys_content_entries.status   the desk status. Drives the admin list, the
 *                                admin UI and search. Written by
 *                                PUT /api/admin/content/{id}.
 *   _news_stories._status        the public status. Drives the filter the
 *                                public read routes apply. Written only by
 *                                PUT /api/v1/content/{schema}/{id}/publish
 *                                and .../unpublish.
 *
 * The admin write mirrors the entry into the public table, but the mirror
 * carries the title, the slug and the body fields and nothing else, so it never
 * touches `_status`. A story created as a draft therefore lands in the public
 * table with `_status` at its column default, which is `'published'`, and shows
 * up on the front page while the desk calls it a draft.
 *
 * Every transition in this file writes both sides, in that order, which is the
 * only way to keep the two agreeing.
 */

export interface StoryDraft {
	title: string;
	slug: string;
	standfirst: string;
	body: string;
	dateline: string;
	desk?: string;
	reporter?: string;
	cover_media_id?: string;
}

/**
 * Rewrites a story and files a revision.
 *
 * The update replaces `body` wholesale rather than merging it, so a partial
 * body silently drops the fields it omits and the whole field set goes on every
 * save. An unset relation is sent as null rather than left out, because
 * JSON.stringify drops an undefined value and a key the engine never sees
 * leaves its column exactly as it was: dropping `desk` does not clear the desk,
 * it keeps it.
 */
export async function saveStory(
	id: string,
	fields: StoryDraft,
	changeNote: string
): Promise<DeskEntry> {
	return lyeve.request<DeskEntry>('admin', `/api/admin/content/${id}`, {
		method: 'PUT',
		body: JSON.stringify({
			schema: STORIES,
			slug: fields.slug,
			title: fields.title,
			body: {
				title: fields.title,
				slug: fields.slug,
				standfirst: fields.standfirst,
				body: fields.body,
				dateline: fields.dateline,
				desk: fields.desk ?? null,
				reporter: fields.reporter ?? null,
				cover_media_id: fields.cover_media_id ?? null
			},
			change_note: changeNote
		})
	});
}

/** Moves the desk status and then the public status, in that order. */
export async function publishStory(id: string, changeNote = 'published'): Promise<void> {
	await setDeskStatus(id, 'published', changeNote);
	await setPublicStatus(id, 'published');
}

export async function unpublishStory(
	id: string,
	changeNote = 'pulled back to draft'
): Promise<void> {
	await setDeskStatus(id, 'draft', changeNote);
	await setPublicStatus(id, 'draft');
}

/**
 * Archives a story.
 *
 * The desk keeps `archived`. The public table gets `draft`, because that is the
 * only value the unpublish route writes and it is what takes the story off the
 * public list.
 */
export async function archiveStory(id: string, changeNote = 'archived'): Promise<void> {
	await setDeskStatus(id, 'archived', changeNote);
	await setPublicStatus(id, 'draft');
}

/**
 * Sets the desk status.
 *
 * Only admin and super_admin may send `published` or `archived`. An editor gets
 * a 403 and is expected to go through review instead. This app authenticates as
 * a super_admin, so the restriction is invisible here and worth stating rather
 * than discovering.
 */
async function setDeskStatus(
	id: string,
	status: DeskEntry['status'],
	changeNote: string
): Promise<void> {
	await lyeve.request('admin', `/api/admin/content/${id}`, {
		method: 'PUT',
		body: JSON.stringify({ status, change_note: changeNote })
	});
}

/** Sets the public status. Answers 204, and 404 when the mirror row is absent. */
async function setPublicStatus(id: string, status: 'published' | 'draft'): Promise<void> {
	const route = status === 'published' ? 'publish' : 'unpublish';
	await lyeve.request('api', `/api/v1/content/${STORIES}/${id}/${route}`, { method: 'PUT' });
}

/** Puts the public status back in step with the desk status, and nothing else. */
export async function alignPublicStatus(entry: DeskEntry): Promise<void> {
	await setPublicStatus(entry.id, expectedPublicStatus(entry.status));
}

/**
 * Restores a story to an earlier revision.
 *
 * The content plugin has a route for this, `POST /api/admin/content/{id}/rollback`,
 * and it does the right thing to the entry and to the revision history: it
 * writes the old content back and files it as a new revision rather than
 * deleting anything. It does not mirror, though, so the public read table keeps
 * the superseded body and the site goes on serving the text the editor just
 * reverted.
 *
 * Sending the old revision's payload through the ordinary update route gets the
 * same new-revision behavior and does mirror, so that is what this does. The
 * change note names the revision it came from.
 */
export async function restoreRevision(id: string, revisionNum: number): Promise<DeskEntry> {
	const [rev, current] = await Promise.all([getRevision(id, revisionNum), getDeskStory(id)]);
	if (!current) throw new Error(`story ${id} is gone`);

	// A restore brings back the copy, not the address. The slug is left at its
	// current value in the body as well as at the top level, because the body's
	// slug is what the mirror writes into the public table and a stale one there
	// would move the story's public URL back without moving the desk's.
	return lyeve.request<DeskEntry>('admin', `/api/admin/content/${id}`, {
		method: 'PUT',
		body: JSON.stringify({
			schema: STORIES,
			slug: current.slug,
			title: rev.title,
			body: { ...rev.body, slug: current.slug },
			change_note: `restored revision ${revisionNum}`
		})
	});
}

/**
 * Sets an embargo.
 *
 * `scheduled_publish_at` must be in the future or the route answers 400. A
 * background worker in the content plugin polls every thirty seconds and, when
 * the time passes, moves the desk status to `published`. It goes through the
 * ordinary update path, so it re-mirrors the body, but it cannot write
 * `_status` any more than a hand-made update can. An embargo that fires leaves
 * the desk saying published and the public table saying draft, and the desk's
 * reconcile action is what closes the gap.
 */
export async function setEmbargo(id: string, publishAt: string): Promise<void> {
	await lyeve.request('admin', `/api/admin/content/${id}/entry-schedule`, {
		method: 'PUT',
		body: JSON.stringify({ scheduled_publish_at: publishAt, timezone: 'UTC' })
	});
}

export async function clearEmbargo(id: string): Promise<void> {
	await lyeve.request('admin', `/api/admin/content/${id}/entry-schedule`, { method: 'DELETE' });
}
