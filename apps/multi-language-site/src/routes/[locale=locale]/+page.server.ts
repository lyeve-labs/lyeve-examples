import { currentLocale, fallbackChain } from '$lib/locales';
import { loadPages, loadSections, type SitePage } from '$lib/server/pages';
import { bulkExport } from '$lib/server/translations';
import { byEntry, localize, statusByLocale } from '$lib/server/localize';
import type { PageServerLoad } from './$types';

/**
 * The localized index.
 *
 * Three engine calls serve the whole page whatever it holds: the sections, the
 * pages, and one bulk-export carrying every translation for both. Resolving
 * each record through `/api/v1/localization/resolve` would be one call per
 * record plus one per section label, so the route the plugin advertises as its
 * public read path is the wrong tool for a list.
 *
 * No locale filter is sent even though bulk-export takes one, because the list
 * shows which languages each record exists in and that needs the whole matrix.
 */
export const load: PageServerLoad = async ({ params }) => {
	const locale = currentLocale(params.locale);
	const chain = fallbackChain(locale);

	const [sections, pages] = await Promise.all([loadSections(), loadPages()]);
	const translations = byEntry(
		await bulkExport([...sections.map((s) => s.id), ...pages.map((p) => p.id)])
	);

	const item = (p: SitePage) => ({
		id: p.id,
		slug: p.slug,
		sourceTitle: p.title,
		localized: localize(translations.get(p.id) ?? [], locale, {
			title: p.title,
			summary: p.summary,
			body: p.body
		}),
		available: statusByLocale(translations.get(p.id) ?? [])
	});

	const grouped = sections.map((section) => ({
		id: section.id,
		slug: section.slug,
		label: localize(translations.get(section.id) ?? [], locale, { title: section.title }),
		pages: pages.filter((p) => p.sectionId === section.id).map(item)
	}));

	// A page whose section relation is null still has to appear. Declaring the
	// relation required is not an option: the generator emits a second NOT NULL
	// column the write path never fills and every insert then fails, so an
	// unsectioned page is a shape the database will always accept.
	const orphans = pages.filter((p) => !sections.some((s) => s.id === p.sectionId)).map(item);

	return { locale, chain, sections: grouped, orphans };
};
