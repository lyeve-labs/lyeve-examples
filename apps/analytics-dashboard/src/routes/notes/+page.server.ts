import { fail } from '@sveltejs/kit';
import { listNotes, recordNote, NOTE_KINDS } from '$lib/server/notes';
import { requestTrend } from '$lib/server/telemetry';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [notes, trend] = await Promise.all([listNotes(50).catch(() => null), requestTrend()]);

	return {
		// A null distinguishes "the content type is missing" from "there are no
		// notes yet", which is the same distinction the telemetry panels make.
		provisioned: notes !== null,
		notes: notes ?? [],
		kinds: NOTE_KINDS,
		// The timeline the notes annotate, so a reader can see the spike a note
		// is about on the same screen as the note.
		trend: trend.value.map((point) => ({ hour: point.hour, value: point.request_count })),
		trendProvenance: trend.provenance
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const posted = await request.formData();
		const title = String(posted.get('title') ?? '');
		const kind = String(posted.get('kind') ?? 'observation');
		const body = String(posted.get('body') ?? '');

		const result = await recordNote({ title, kind, body });
		if (!result.ok) {
			return fail(422, { ok: false, message: result.message, values: { title, kind, body } });
		}

		// The successful form comes back empty except for the kind, which an
		// operator recording a run of related notes would otherwise re-pick.
		return { ok: true, message: result.message, values: { title: '', kind, body: '' } };
	}
};
