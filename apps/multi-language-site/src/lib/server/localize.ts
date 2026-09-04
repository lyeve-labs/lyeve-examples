import { DEFAULT_LOCALE, fallbackChain } from '$lib/locales';
import type { Translation, TranslationStatus } from './translations';

/**
 * Where the fallback decision is made.
 *
 * The engine walks the chain and reports where it stopped, but it stops at
 * nothing useful when an entry has no translations at all: `resolve` answers
 * 200 with the default locale, an empty title and `body: {}`. A site cannot
 * publish that, so the last step of the chain belongs to the application. Here
 * it is the source record on the content entry, marked `source` so the page can
 * say so rather than passing an English page off as a German one.
 */

/** `source` means the text on screen came from the content entry, untranslated. */
export type RenderStatus = TranslationStatus | 'source';

export interface Localized {
	requested: string;
	/** The locales tried, in order, ending at the default. */
	chain: string[];
	/** The locale the text on screen is actually in. */
	locale: string;
	/** True when the text came from the content entry instead of a translation. */
	fromSource: boolean;
	status: RenderStatus;
	title: string;
	summary: string;
	text: string;
	description: string;
}

export interface SourceRecord {
	title: string;
	summary?: string;
	body?: string;
}

/** The first translation in the chain, or null when the chain runs out. */
export function pickTranslation(rows: Translation[], chain: string[]): Translation | null {
	for (const locale of chain) {
		const hit = rows.find((r) => r.locale === locale && r.title.trim() !== '');
		if (hit) return hit;
	}
	return null;
}

/**
 * Applies the chain to one entry's translations, falling back to the source
 * record. `rows` may hold translations for several entries. Pass only the ones
 * belonging to this entry.
 */
export function localize(
	rows: Translation[],
	requested: string,
	source: SourceRecord
): Localized {
	const chain = fallbackChain(requested);
	const hit = pickTranslation(rows, chain);

	if (!hit) {
		return {
			requested,
			chain,
			// The source record is written in the default locale, so that is the
			// language of the text even though no translation row produced it.
			locale: DEFAULT_LOCALE,
			fromSource: true,
			status: 'source',
			title: source.title,
			summary: source.summary ?? '',
			text: source.body ?? '',
			description: source.summary ?? ''
		};
	}

	return {
		requested,
		chain,
		locale: hit.locale,
		fromSource: false,
		status: hit.translation_status,
		title: hit.title,
		summary: hit.body?.summary ?? '',
		text: hit.body?.text ?? '',
		description: hit.meta?.description ?? hit.body?.summary ?? ''
	};
}

/** Groups a bulk-export response by entry, so one request serves a whole page. */
export function byEntry(rows: Translation[]): Map<string, Translation[]> {
	const grouped = new Map<string, Translation[]>();
	for (const row of rows) {
		const list = grouped.get(row.entry_id);
		if (list) list.push(row);
		else grouped.set(row.entry_id, [row]);
	}
	return grouped;
}

/**
 * Status per locale for one entry, for the availability badges.
 *
 * Partial, because a locale with no row has to read back as undefined rather
 * than as a status the caller then has to distrust.
 */
export function statusByLocale(rows: Translation[]): Partial<Record<string, TranslationStatus>> {
	const out: Partial<Record<string, TranslationStatus>> = {};
	for (const row of rows) out[row.locale] = row.translation_status;
	return out;
}
