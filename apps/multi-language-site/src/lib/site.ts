/** Site-wide strings. Not content: nothing here is translated by the engine. */
export const SITE = {
	name: 'Kestrel Press Museum',
	tagline: 'A working museum of movable type, presses and the trades around them.'
};

/** The chrome is labeled per locale in code, because chrome is not content. */
export const CHROME: Record<string, { home: string; translations: string; sourceRecord: string }> = {
	en: { home: 'Home', translations: 'Translations', sourceRecord: 'Source record' },
	de: { home: 'Start', translations: 'Übersetzungen', sourceRecord: 'Quelldatensatz' },
	fr: { home: 'Accueil', translations: 'Traductions', sourceRecord: 'Fiche source' },
	'fr-CA': { home: 'Accueil', translations: 'Traductions', sourceRecord: 'Fiche source' }
};

export function chrome(locale: string) {
	return CHROME[locale] ?? CHROME.en;
}
