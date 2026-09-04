/**
 * Operator annotations, the only content type this app owns.
 *
 * A telemetry panel says what happened but never why. A note pins a human
 * explanation to a moment, so the spike at 14:00 stops being a mystery the next
 * person has to re-investigate.
 */
import { createContent, listContent, LyeveError, type ContentEntry } from '$lib/lyeve';
import { lyeve, NOTES } from './lyeve';

/** The kinds an operator picks from. The engine stores the field as free text. */
export const NOTE_KINDS = ['incident', 'deploy', 'load test', 'maintenance', 'observation'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

interface NoteFields {
	title: string;
	slug: string;
	body?: string;
	kind?: string;
}

export interface Note {
	id: string;
	title: string;
	slug: string;
	body: string;
	kind: string;
	recordedAt: string;
}

function toNote(row: ContentEntry<NoteFields>): Note {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		body: row.data.body ?? '',
		kind: row.data.kind ?? 'observation',
		recordedAt: row.created_at
	};
}

/**
 * Lists notes newest first.
 *
 * The engine has no sort parameter and always returns created_at DESC, which is
 * the order a timeline wants, so nothing is re-sorted here.
 */
export async function listNotes(limit = 50): Promise<Note[]> {
	const rows = await listContent<NoteFields>(lyeve, NOTES, { limit });
	return rows.map(toNote);
}

export interface RecordResult {
	ok: boolean;
	message: string;
}

/**
 * Writes one note through the admin router.
 *
 * The slug is namespaced with a timestamp because sys_content_entries is
 * UNIQUE (slug, tenant_id) with no schema in the index, so a bare word like
 * "outage" would collide with every other example app sharing this engine, and
 * the refusal is a 409 that names no field.
 */
export async function recordNote(input: { title: string; kind: string; body: string }): Promise<RecordResult> {
	const title = input.title.trim();
	if (!title) return { ok: false, message: 'A note needs a title.' };

	const stem =
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'note';
	const slug = `metrics-note-${Date.now().toString(36)}-${stem}`;

	try {
		await createContent(lyeve, {
			schema: NOTES,
			slug,
			title,
			body: { slug, kind: input.kind, body: input.body.trim() }
		});
		return { ok: true, message: 'Note recorded.' };
	} catch (err) {
		if (err instanceof LyeveError) {
			if (err.status === 404) {
				return { ok: false, message: 'The metrics_notes content type is missing. Run pnpm run setup in this app.' };
			}
			if (err.fieldErrors.length > 0) {
				return { ok: false, message: err.fieldErrors.map((e) => `${e.field}: ${e.message}`).join('; ') };
			}
			return { ok: false, message: `The engine refused the note (${err.status}).` };
		}
		return { ok: false, message: 'The engine could not be reached.' };
	}
}
