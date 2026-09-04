/**
 * The locales this site publishes.
 *
 * The engine has no register of locales. `GET /api/admin/localization/locales`
 * reports `SELECT DISTINCT locale` over the translation rows that happen to
 * exist, and its `PUT` is a no-op that answers a fixed message, so a locale
 * with no rows yet is unknown to the engine and a locale another application
 * translated into shows up as one of ours. The list a site navigates by has to
 * live in the site.
 */
export interface Locale {
	code: string;
	label: string;
	/** Language tag for the `lang` attribute and `hreflang`. */
	tag: string;
}

export const DEFAULT_LOCALE = 'en';

export const LOCALES: Locale[] = [
	{ code: 'en', label: 'English', tag: 'en' },
	{ code: 'de', label: 'Deutsch', tag: 'de' },
	{ code: 'fr', label: 'Français', tag: 'fr' },
	{ code: 'fr-CA', label: 'Français (Canada)', tag: 'fr-CA' }
];

export function isLocale(code: string): boolean {
	return LOCALES.some((l) => l.code === code);
}

/** The locale a route is in, given its `locale` param. Falls back to the default. */
export function currentLocale(param: string | undefined): string {
	return param && isLocale(param) ? param : DEFAULT_LOCALE;
}

export function localeLabel(code: string): string {
	return LOCALES.find((l) => l.code === code)?.label ?? code;
}

export function localeTag(code: string): string {
	return LOCALES.find((l) => l.code === code)?.tag ?? code;
}

/**
 * The order the engine tries locales in, reimplemented here.
 *
 * `/api/v1/localization/resolve` walks this same chain server-side and reports
 * it back as `fallback_chain`, but the site needs it before the request: to
 * pick a title for a list of twenty pages without twenty resolve calls, and to
 * say in the page which locale the text on screen is actually in.
 *
 * It matches the plugin for every locale this site declares, including the
 * parts that look arbitrary: only the first region separator is stripped, the
 * base language is skipped when it is already the default, and the chain always
 * ends at the default locale. "fr-CA" gives fr-CA, fr, en. "de" gives de, en.
 * "en" gives en alone. A code starting with the separator is the one difference:
 * the plugin would put an empty locale in the chain and this skips it.
 */
export function fallbackChain(locale: string, defaultLocale = DEFAULT_LOCALE): string[] {
	if (locale === defaultLocale) return [defaultLocale];

	const chain = [locale];
	const cut = locale.search(/[-_]/);
	if (cut > 0) {
		const base = locale.slice(0, cut);
		if (base !== defaultLocale) chain.push(base);
	}
	if (chain[chain.length - 1] !== defaultLocale) chain.push(defaultLocale);
	return chain;
}

/** True when a path is under a locale, which is where a switcher makes sense. */
export function isLocalizedPath(pathname: string): boolean {
	const [first] = pathname.split('/').filter((s) => s !== '');
	return first !== undefined && isLocale(first);
}

/**
 * Swaps the locale segment of a path, keeping the rest of it.
 *
 * The locale switcher has to land on the same page in another language, and the
 * slug is the same string in every locale because the engine localizes title,
 * body and meta and nothing else.
 */
export function switchLocale(pathname: string, locale: string): string {
	const segments = pathname.split('/').filter((s) => s !== '');
	if (segments.length > 0 && isLocale(segments[0])) {
		segments[0] = locale;
		return '/' + segments.join('/');
	}
	return `/${locale}`;
}
