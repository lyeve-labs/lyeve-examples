import { error, fail } from '@sveltejs/kit';
import { DEFAULT_LOCALE, LOCALES } from '$lib/locales';
import { findEntryBySlug } from '$lib/server/pages';
import {
	deleteTranslation,
	listTranslations,
	saveTranslation,
	type TranslationStatus
} from '$lib/server/translations';
import { describeFailure } from '$lib/server/errors';
import type { Actions, PageServerLoad } from './$types';

const STATUSES: TranslationStatus[] = ['draft', 'translated', 'outdated'];

function isStatus(value: string): value is TranslationStatus {
	return (STATUSES as string[]).includes(value);
}

/** What the editor sends back on a failed save, so the typing is not lost. */
interface Draft {
	title: string;
	summary: string;
	text: string;
	description: string;
	status: string;
}

/**
 * The editor for one record, all locales at once.
 *
 * `listTranslations` is used rather than bulk-export because this view is about
 * a single entry and the per-entry route reports `total_count`, which is worth
 * seeing next to the content list's bare array.
 */
export const load: PageServerLoad = async ({ params }) => {
	const entry = await findEntryBySlug(params.slug);
	if (!entry) error(404, 'No such record');

	const rows = await listTranslations(entry.id);

	return {
		entry,
		locales: LOCALES.map((locale) => {
			const row = rows.find((r) => r.locale === locale.code) ?? null;
			return {
				code: locale.code,
				label: locale.label,
				isDefault: locale.code === DEFAULT_LOCALE,
				exists: row !== null,
				status: row?.translation_status ?? null,
				title: row?.title ?? '',
				summary: row?.body?.summary ?? '',
				text: row?.body?.text ?? '',
				description: row?.meta?.description ?? '',
				updatedAt: row?.updated_at ?? null
			};
		}),
		totalRows: rows.length
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const entryId = String(form.get('entryId') ?? '');
		const locale = String(form.get('locale') ?? '');
		const exists = form.get('exists') === 'true';

		const draft: Draft = {
			title: String(form.get('title') ?? '').trim(),
			summary: String(form.get('summary') ?? '').trim(),
			text: String(form.get('text') ?? ''),
			description: String(form.get('description') ?? '').trim(),
			status: String(form.get('status') ?? 'draft')
		};

		if (!entryId || !locale) {
			return fail(400, { locale, message: 'Missing record or locale.', values: draft });
		}
		if (!isStatus(draft.status)) {
			return fail(400, { locale, message: 'Unknown translation status.', values: draft });
		}

		// The create route rejects an empty title with a 400, and the update route
		// silently ignores one because it merges only non-empty fields. Requiring
		// it here means a blank title behaves the same way on both paths instead
		// of failing on one and quietly doing nothing on the other.
		if (draft.title === '') {
			return fail(400, { locale, message: 'A translation needs a title.', values: draft });
		}

		try {
			await saveTranslation(
				entryId,
				{
					locale,
					title: draft.title,
					body: { summary: draft.summary, text: draft.text },
					meta: { description: draft.description },
					translation_status: draft.status
				},
				exists
			);
		} catch (err) {
			const { status, message } = describeFailure(err);
			return fail(status, { locale, message, values: draft });
		}

		return { locale, message: `Saved ${locale}.`, values: null };
	},

	/**
	 * Deletes one locale's translation.
	 *
	 * This is also the only way to clear a title, because the update route merges
	 * and treats an empty string as an omission.
	 */
	remove: async ({ request }) => {
		const form = await request.formData();
		const entryId = String(form.get('entryId') ?? '');
		const locale = String(form.get('locale') ?? '');

		if (!entryId || !locale) {
			return fail(400, { locale, message: 'Missing record or locale.', values: null });
		}

		try {
			await deleteTranslation(entryId, locale);
		} catch (err) {
			const { status, message } = describeFailure(err);
			return fail(status, { locale, message, values: null });
		}

		return { locale, message: `Deleted ${locale}.`, values: null };
	}
};
