import { LyeveError } from '$lib/lyeve';
import { lyeve } from './lyeve';

/**
 * The localization plugin's HTTP surface, typed.
 *
 * There is no SDK for it, so these are hand-written calls. The plugin splits
 * across both routers: the translation CRUD is on the admin router and only
 * `resolve` is on the public one, so every wrapper here names which base it
 * talks to and the app never has to remember.
 */

export type TranslationStatus = 'draft' | 'translated' | 'outdated';

/**
 * The engine localizes three things and stores two of them as opaque JSON:
 * `title` is a column, `body` and `meta` are whatever the caller wrote. The
 * shape below is this app's choice, not the engine's.
 */
export interface TranslationBody {
	summary?: string;
	text?: string;
}

export interface TranslationMeta {
	description?: string;
}

export interface Translation {
	id: string;
	entry_id: string;
	locale: string;
	title: string;
	body: TranslationBody;
	meta: TranslationMeta;
	translation_status: TranslationStatus;
	created_at: string;
	updated_at: string;
}

export interface Resolved {
	entry: { id: string; schema: string; slug: string; status: string };
	requested_locale: string;
	resolved_locale: string;
	fallback_chain: string[];
	translation_status: TranslationStatus;
	title: string;
	body: TranslationBody;
	meta: TranslationMeta;
}

export interface TranslationInput {
	locale: string;
	title: string;
	body: TranslationBody;
	meta: TranslationMeta;
	translation_status: TranslationStatus;
}

/** The plugin's own locale report. Discovered from rows, not configured. */
export interface EngineLocales {
	default_locale: string;
	enabled_locales: string[];
}

/** `entry_ids` is validated `min=1 max=200`, so a longer set is sent in pieces. */
const BULK_EXPORT_MAX_IDS = 200;

/**
 * Resolves one entry through the engine's fallback chain.
 *
 * This is the plugin's public read path and the only route that reports which
 * locale the text came from. It never 404s on a missing translation: an entry
 * with no rows at all answers 200 with `resolved_locale` set to the default
 * locale, an empty `title` and `body: {}`. An empty title is therefore the only
 * signal that nothing was found, which is why the caller decides what to render.
 */
export async function resolve(entryId: string, locale: string): Promise<Resolved> {
	const q = new URLSearchParams({ entry_id: entryId, locale });
	return lyeve.request<Resolved>('api', `/api/v1/localization/resolve?${q.toString()}`);
}

/**
 * Every translation of one entry.
 *
 * Paginated, and with a different envelope and a different default page size
 * from the content list: `{data, total_count, limit, offset}` with a default
 * limit of 50, against the content route's bare array and floor of 25.
 */
export async function listTranslations(entryId: string): Promise<Translation[]> {
	const res = await lyeve.request<{ data: Translation[]; total_count: number }>(
		'admin',
		`/api/admin/content/${entryId}/translations?limit=100`
	);
	return Array.isArray(res?.data) ? res.data : [];
}

export async function getTranslation(
	entryId: string,
	locale: string
): Promise<Translation | null> {
	try {
		return await lyeve.request<Translation>(
			'admin',
			`/api/admin/content/${entryId}/translations/${encodeURIComponent(locale)}`
		);
	} catch (err) {
		if (err instanceof LyeveError && err.status === 404) return null;
		throw err;
	}
}

/** 201 on success, 409 when the locale already has a row. */
export async function createTranslation(
	entryId: string,
	input: TranslationInput
): Promise<Translation> {
	return lyeve.request<Translation>('admin', `/api/admin/content/${entryId}/translations`, {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

/**
 * Updates one translation.
 *
 * The handler reads the row and merges, so an omitted field keeps its value and
 * an empty string is indistinguishable from an omission. A title cannot be
 * blanked this way. Deleting the row is the only way to clear one.
 */
export async function updateTranslation(
	entryId: string,
	locale: string,
	patch: Partial<Omit<TranslationInput, 'locale'>>
): Promise<Translation> {
	return lyeve.request<Translation>(
		'admin',
		`/api/admin/content/${entryId}/translations/${encodeURIComponent(locale)}`,
		{ method: 'PUT', body: JSON.stringify(patch) }
	);
}

export async function deleteTranslation(entryId: string, locale: string): Promise<void> {
	await lyeve.request<void>(
		'admin',
		`/api/admin/content/${entryId}/translations/${encodeURIComponent(locale)}`,
		{ method: 'DELETE' }
	);
}

/**
 * Every translation of many entries, in one request per 200 entries.
 *
 * `resolve` answers for a single entry, so a page listing twenty records in one
 * locale would be twenty calls plus one for each nav label. This is the read
 * that makes a localized index affordable, and the app applies the fallback
 * chain itself over what comes back.
 */
export async function bulkExport(entryIds: string[], locales?: string[]): Promise<Translation[]> {
	const ids = [...new Set(entryIds)].filter((id) => id !== '');
	if (ids.length === 0) return [];

	const out: Translation[] = [];
	for (let i = 0; i < ids.length; i += BULK_EXPORT_MAX_IDS) {
		const res = await lyeve.request<{ localizations: Translation[]; count: number }>(
			'admin',
			'/api/admin/translations/bulk-export',
			{
				method: 'POST',
				body: JSON.stringify({
					entry_ids: ids.slice(i, i + BULK_EXPORT_MAX_IDS),
					...(locales?.length ? { locales } : {})
				})
			}
		);
		if (Array.isArray(res?.localizations)) out.push(...res.localizations);
	}
	return out;
}

/**
 * Locales the engine believes exist.
 *
 * Shown in the translation view next to the site's own list, because the two
 * disagree by design: this one is `SELECT DISTINCT locale` across the tenant,
 * so it omits a locale nobody has translated into yet and includes locales that
 * belong to a different application sharing the engine.
 */
export async function engineLocales(): Promise<EngineLocales> {
	return lyeve.request<EngineLocales>('admin', '/api/admin/localization/locales');
}

/**
 * Writes one translation, whichever verb the row needs.
 *
 * The plugin has no upsert on a single locale: POST answers 409 when the row
 * exists and PUT answers 404 when it does not, so the caller has to know. The
 * editor knows from the page it rendered, and the retry below covers the case
 * where another editor created or deleted the row in between. Bulk-import is
 * the real upsert, but it takes an array and reports only a count, which is the
 * wrong shape for one form.
 */
export async function saveTranslation(
	entryId: string,
	input: TranslationInput,
	exists: boolean
): Promise<void> {
	const write = (asUpdate: boolean) =>
		asUpdate
			? updateTranslation(entryId, input.locale, {
					title: input.title,
					body: input.body,
					meta: input.meta,
					translation_status: input.translation_status
				})
			: createTranslation(entryId, input);

	try {
		await write(exists);
	} catch (err) {
		if (err instanceof LyeveError && (err.status === 404 || err.status === 409)) {
			await write(!exists);
			return;
		}
		throw err;
	}
}
