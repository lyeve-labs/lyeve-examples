import { lyeve, STORIES } from './lyeve';

/**
 * The engine keeps two unrelated revision histories, and which one holds a
 * story depends entirely on which door wrote it.
 *
 *   sys_content_revisions   numbered `revision_num`, carries a change note and
 *                           the status at the time. Written by
 *                           POST and PUT /api/admin/content, read by
 *                           GET /api/admin/content/{id}/revisions.
 *   sys_revisions           keyed by a uuid, no note, no number. Written by
 *                           PUT /api/v1/content/{schema}/{id}, read by
 *                           GET /api/v1/content/{schema}/{id}/revisions.
 *
 * This app writes through the admin route, as every example here does, so the
 * numbered history is the real one and the public revisions route answers
 * `null` for every story. The restore route that goes with it,
 * PUT /api/v1/content/{schema}/{id}/revisions/{rev_id}/restore, has nothing to
 * restore from and is therefore unusable on this content.
 */

export interface Revision {
	id: string;
	entry_id: string;
	revision_num: number;
	title: string;
	body: Record<string, unknown>;
	status: 'draft' | 'published' | 'archived';
	change_note: string;
	created_by: string;
	created_at: string;
}

export interface RevisionDiff {
	from_rev: number;
	to_rev: number;
	entry_id: string;
	diff: string;
}

export interface AuditRecord {
	id: string;
	entry_id: string;
	action: string;
	revision_num: number;
	actor_id: string;
	created_at: string;
}

interface Paginated<T> {
	data: T[];
	total_count: number;
}

/** Newest revision first, which is the order the store returns. */
export async function listRevisions(id: string, limit = 50): Promise<Revision[]> {
	const res = await lyeve.request<Paginated<Revision>>(
		'admin',
		`/api/admin/content/${id}/revisions?limit=${limit}`
	);
	return Array.isArray(res.data) ? res.data : [];
}

export async function getRevision(id: string, revisionNum: number): Promise<Revision> {
	return lyeve.request<Revision>('admin', `/api/admin/content/${id}/revisions/${revisionNum}`);
}

/**
 * The plugin's own field-level diff between two revisions.
 *
 * It compares title, body, meta and status and returns one preformatted string,
 * not a structure, so it is rendered rather than parsed. Either revision
 * number missing is a 404.
 */
export async function diffRevisions(
	id: string,
	from: number,
	to: number
): Promise<RevisionDiff | null> {
	try {
		return await lyeve.request<RevisionDiff>(
			'admin',
			`/api/admin/content/${id}/diff?from=${from}&to=${to}`
		);
	} catch {
		return null;
	}
}

/**
 * The immutable audit trail.
 *
 * The audit insert shares the transaction with the content write, so there is
 * no content change here without a row: `created`, `updated`, `published`,
 * `rolled_back`, and the two the scheduler writes.
 */
export async function listAudit(id: string, limit = 25): Promise<AuditRecord[]> {
	const res = await lyeve.request<Paginated<AuditRecord>>(
		'admin',
		`/api/admin/content/${id}/audit?limit=${limit}`
	);
	return Array.isArray(res.data) ? res.data : [];
}

/**
 * Counts what the engine's own revision table holds for this story.
 *
 * This is here to be looked at rather than used: it returns zero for
 * everything this app writes, and the timeline says so on the page. A reader
 * who reaches for the public revisions route because it is the one the engine
 * documents alongside publish and unpublish should see the empty answer next to
 * the full one.
 */
export async function countEngineRevisions(id: string): Promise<number> {
	const rows = await lyeve.request<unknown>('api', `/api/v1/content/${STORIES}/${id}/revisions`);
	return Array.isArray(rows) ? rows.length : 0;
}
