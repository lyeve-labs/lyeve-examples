import { error } from '@sveltejs/kit';
import { currentLocale } from '$lib/locales';
import { findPage, loadSections } from '$lib/server/pages';
import { bulkExport, resolve } from '$lib/server/translations';
import { byEntry, localize, statusByLocale } from '$lib/server/localize';
import type { PageServerLoad } from './$types';

/**
 * One page in one locale.
 *
 * Both resolutions run: the engine's, through the public resolve route, and the
 * site's own over the rows bulk-export returns. They agree on which locale wins
 * (the chain is the same algorithm) and disagree on what to do when the chain
 * runs out, which is the whole point of showing them side by side. The engine
 * answers 200 with an empty title. The site falls back to the content entry and
 * says so on the page.
 */
export const load: PageServerLoad = async ({ params }) => {
	const locale = currentLocale(params.locale);

	// No get-by-slug route exists, so this is filters[slug]= narrowed to one row.
	const page = await findPage(params.slug);
	if (!page) error(404, 'No such page');

	const sections = await loadSections();
	const section = sections.find((s) => s.id === page.sectionId) ?? null;

	const ids = section ? [page.id, section.id] : [page.id];
	const [engine, rows] = await Promise.all([resolve(page.id, locale), bulkExport(ids)]);
	const grouped = byEntry(rows);
	const pageRows = grouped.get(page.id) ?? [];

	return {
		locale,
		slug: page.slug,
		sourceTitle: page.title,
		localized: localize(pageRows, locale, {
			title: page.title,
			summary: page.summary,
			body: page.body
		}),
		available: statusByLocale(pageRows),
		section: section && {
			slug: section.slug,
			label: localize(grouped.get(section.id) ?? [], locale, { title: section.title })
		},
		// What the plugin itself decided, reported as it came back. `title` is
		// empty when the chain found nothing at all.
		engine: {
			requestedLocale: engine.requested_locale,
			resolvedLocale: engine.resolved_locale,
			chain: engine.fallback_chain,
			status: engine.translation_status,
			foundTranslation: engine.title.trim() !== '',
			entryStatus: engine.entry.status
		}
	};
};
