import { fail } from '@sveltejs/kit';
import { LOCALES } from '$lib/locales';
import { loadPages, loadSections } from '$lib/server/pages';
import { bulkExport, engineLocales, updateTranslation } from '$lib/server/translations';
import type { TranslationStatus } from '$lib/server/translations';
import { byEntry, statusByLocale } from '$lib/server/localize';
import { describeFailure } from '$lib/server/errors';
import type { Actions, PageServerLoad } from './$types';

const STATUSES: TranslationStatus[] = ['draft', 'translated', 'outdated'];

function isStatus(value: string): value is TranslationStatus {
	return (STATUSES as string[]).includes(value);
}

/**
 * Translation status across every record and every locale.
 *
 * One bulk-export with no locale filter is the whole matrix, which is the only
 * affordable way to build this view: there is no route that reports coverage,
 * and asking per entry and locale would be one request per cell.
 */
export const load: PageServerLoad = async () => {
	const [sections, pages] = await Promise.all([loadSections(), loadPages()]);
	const entries = [
		...sections.map((s) => ({ id: s.id, kind: 'section' as const, title: s.title, slug: s.slug })),
		...pages.map((p) => ({ id: p.id, kind: 'page' as const, title: p.title, slug: p.slug }))
	];

	// The second call is the engine's own idea of which locales exist, shown
	// beside the site's list. It is a DISTINCT over the translation rows of the
	// whole tenant, so it lags a locale nobody has translated into and includes
	// locales belonging to another application on the same engine.
	const [rowsFromEngine, engine] = await Promise.all([
		bulkExport(entries.map((e) => e.id)),
		engineLocales()
	]);
	const grouped = byEntry(rowsFromEngine);

	const rows = entries.map((entry) => {
		const translations = grouped.get(entry.id) ?? [];
		const status = statusByLocale(translations);
		return {
			...entry,
			cells: LOCALES.map((locale) => ({
				locale: locale.code,
				status: status[locale.code] ?? null,
				updatedAt: translations.find((t) => t.locale === locale.code)?.updated_at ?? null
			}))
		};
	});

	const coverage = LOCALES.map((locale) => ({
		locale: locale.code,
		translated: rows.filter(
			(r) => r.cells.find((c) => c.locale === locale.code)?.status === 'translated'
		).length,
		total: rows.length
	}));

	return {
		rows,
		coverage,
		siteLocales: LOCALES,
		engineLocales: engine
	};
};

export const actions: Actions = {
	/**
	 * Moves one translation between states.
	 *
	 * PUT merges rather than replaces, so sending the status alone is enough and
	 * the title and body are left as they were. A locale with no row answers 404
	 * here, which is an editing state rather than a fault.
	 */
	mark: async ({ request }) => {
		const form = await request.formData();
		const entryId = String(form.get('entryId') ?? '');
		const locale = String(form.get('locale') ?? '');
		const status = String(form.get('status') ?? '');

		if (!entryId || !locale) return fail(400, { message: 'Pick a record and a locale.' });
		if (!isStatus(status)) return fail(400, { message: `${status} is not a translation status.` });

		try {
			await updateTranslation(entryId, locale, { translation_status: status });
		} catch (err) {
			const { status: code, message } = describeFailure(err);
			return fail(code, { message });
		}

		return { message: `${locale} marked ${status}.` };
	}
};
