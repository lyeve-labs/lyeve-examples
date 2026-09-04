/**
 * Creates the site's content types, seeds the source records, and imports the
 * translations.
 *
 * Safe to run more than once. Applying an existing schema is an upsert, a
 * record is created only when its slug is not already there, and translations
 * are imported only for records that have none at all, so a translation edited
 * through the app survives a re-run.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent, type LyeveClient
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const SECTIONS = 'i18n_sections';
const PAGES = 'i18n_pages';

type Status = 'draft' | 'translated' | 'outdated';

interface Translation {
	locale: string;
	title: string;
	summary?: string;
	text?: string;
	description?: string;
	status: Status;
}

interface Seed {
	slug: string;
	title: string;
	summary?: string;
	body?: string;
	position: number;
	/** Locales other than the default. The default locale row is derived below. */
	translations: Translation[];
	/**
	 * When true, no translation row is written at all, not even the default
	 * locale. The site then falls back to the content entry, which is the only
	 * way to see what the engine does when its chain runs out.
	 */
	sourceOnly?: boolean;
}

interface PageSeed extends Seed {
	section: string;
}

const sections: Seed[] = [
	{
		slug: 'visit',
		title: 'Visit',
		position: 1,
		translations: [
			{ locale: 'de', title: 'Besuch', status: 'translated' },
			{ locale: 'fr', title: 'Visite', status: 'translated' }
		]
	},
	{
		slug: 'collections',
		title: 'Collections',
		position: 2,
		translations: [
			{ locale: 'de', title: 'Sammlungen', status: 'translated' },
			{ locale: 'fr', title: 'Collections', status: 'translated' }
		]
	},
	{
		// No German label, so the German pages under this heading show a section
		// title in English and say which language it is in.
		slug: 'about-the-museum',
		title: 'About',
		position: 3,
		translations: [{ locale: 'fr', title: 'À propos', status: 'translated' }]
	}
];

const pages: PageSeed[] = [
	{
		slug: 'opening-hours',
		section: 'visit',
		position: 1,
		title: 'Opening hours',
		summary: 'Open Wednesday to Sunday, with free entry on the first Wednesday of every month.',
		body: [
			'The museum is open Wednesday to Sunday from 10.00 to 17.00. The last entry is at 16.15, which leaves time to walk the press hall before the machines are shut down for the evening.',
			'We close on Mondays and Tuesdays so the workshop can run its own projects, and on 24 and 25 December.',
			'Entry is free on the first Wednesday of every month. That is also the busiest day of the month, so if you are hoping for a quiet look at the composing room, come on a Thursday.'
		].join('\n\n'),
		translations: [
			{
				locale: 'de',
				title: 'Öffnungszeiten',
				summary:
					'Mittwoch bis Sonntag geöffnet, am ersten Mittwoch im Monat ist der Eintritt frei.',
				text: [
					'Das Museum ist von Mittwoch bis Sonntag zwischen 10.00 und 17.00 Uhr geöffnet. Letzter Einlass ist um 16.15 Uhr, damit noch Zeit für einen Gang durch die Maschinenhalle bleibt, bevor die Pressen für den Abend abgestellt werden.',
					'Montags und dienstags bleibt das Haus geschlossen, weil die Werkstatt dann an eigenen Projekten arbeitet. Am 24. und 25. Dezember ist ebenfalls geschlossen.',
					'Am ersten Mittwoch im Monat ist der Eintritt frei. Das ist zugleich der Tag mit dem größten Andrang: wer den Setzsaal in Ruhe sehen möchte, kommt besser an einem Donnerstag.'
				].join('\n\n'),
				description: 'Öffnungszeiten, letzter Einlass und der freie Mittwoch im Monat.',
				status: 'translated'
			},
			{
				locale: 'fr',
				title: "Horaires d'ouverture",
				summary: 'Ouvert du mercredi au dimanche, entrée libre le premier mercredi du mois.',
				text: [
					"Le musée est ouvert du mercredi au dimanche, de 10h00 à 17h00. La dernière entrée se fait à 16h15, ce qui laisse le temps de traverser la halle des presses avant l'arrêt des machines.",
					"Nous fermons le lundi et le mardi, car l'atelier travaille alors à ses propres projets, ainsi que les 24 et 25 décembre.",
					"L'entrée est libre le premier mercredi du mois. C'est aussi le jour le plus fréquenté: pour voir l'atelier de composition au calme, venez plutôt un jeudi."
				].join('\n\n'),
				description: 'Horaires, dernière entrée et le mercredi gratuit du mois.',
				status: 'translated'
			}
		]
	},
	{
		slug: 'getting-here',
		section: 'visit',
		position: 2,
		title: 'Getting here',
		summary: 'Ten minutes on foot from the central station, or the number 4 tram to Papiermühle.',
		body: [
			'The museum sits behind the old paper mill on Sennweg. From the central station it is a ten minute walk along the canal; from the north side of town, take the number 4 tram to Papiermühle and follow the chimney.',
			'There is no car park of our own. The two public garages on Sennweg are five minutes away and are usually empty on a weekday.',
			'Deliveries and coach drop-offs use the yard gate, which is the one with the cast iron press bolted beside it.'
		].join('\n\n'),
		translations: [
			{
				locale: 'de',
				title: 'Anfahrt',
				summary: 'Zehn Minuten zu Fuß vom Hauptbahnhof oder mit der Tram 4 bis Papiermühle.',
				text: [
					'Das Museum liegt hinter der alten Papiermühle am Sennweg. Vom Hauptbahnhof sind es zehn Minuten zu Fuß entlang des Kanals; aus dem Norden der Stadt fährt die Tram 4 bis Papiermühle, von dort weist der Schornstein den Weg.',
					'Einen eigenen Parkplatz gibt es nicht. Die beiden öffentlichen Parkhäuser am Sennweg sind fünf Minuten entfernt und an Wochentagen meist leer.',
					'Lieferungen und Reisebusse nutzen das Hoftor, erkennbar an der eisernen Presse daneben.'
				].join('\n\n'),
				description: 'Anfahrt zu Fuß, mit der Tram und mit dem Reisebus.',
				status: 'translated'
			},
			{
				// Left unfinished on purpose: two paragraphs of three, no meta
				// description, and marked draft. The page says so when it renders.
				locale: 'fr',
				title: 'Comment nous rejoindre',
				summary: "Dix minutes à pied de la gare centrale, ou le tram 4 jusqu'à Papiermühle.",
				text: [
					"Le musée se trouve derrière l'ancienne papeterie du Sennweg. Depuis la gare centrale, comptez dix minutes à pied le long du canal; depuis le nord de la ville, prenez le tram 4 jusqu'à Papiermühle et suivez la cheminée.",
					"Nous n'avons pas de parking. Les deux garages publics du Sennweg sont à cinq minutes et restent presque vides en semaine."
				].join('\n\n'),
				status: 'draft'
			}
		]
	},
	{
		slug: 'tickets-and-prices',
		section: 'visit',
		position: 3,
		title: 'Tickets and prices',
		summary:
			'Twelve euro for adults, free under eighteen, and a workshop ticket that includes the sheet you print.',
		body: [
			'A day ticket is twelve euro for adults and eight concessions. Under eighteens go free, and so does anyone accompanying a school group.',
			'The workshop ticket is twenty euro and includes two hours at a press with a compositor, plus the sheet you print. Those run on Saturday mornings and sell out about a fortnight ahead.',
			'We take cards at the door. The shop takes cash as well, mostly because the till is a 1954 model and we like using it.'
		].join('\n\n'),
		translations: [
			{
				// No French version at all, so a French reader gets English with a
				// notice rather than an empty page.
				locale: 'de',
				title: 'Tickets und Preise',
				summary:
					'Zwölf Euro für Erwachsene, unter achtzehn frei, dazu ein Werkstattticket mit eigenem Druck.',
				text: [
					'Die Tageskarte kostet zwölf Euro, ermäßigt acht. Unter achtzehn ist der Eintritt frei, ebenso für Begleitpersonen von Schulklassen.',
					'Das Werkstattticket kostet zwanzig Euro und umfasst zwei Stunden an einer Presse mit einem Schriftsetzer sowie den Bogen, den Sie selbst drucken. Die Termine liegen am Samstagmorgen und sind rund zwei Wochen im Voraus ausverkauft.',
					'An der Kasse werden Karten akzeptiert, im Laden auch Bargeld, vor allem weil die Registrierkasse von 1954 stammt und wir sie gern benutzen.'
				].join('\n\n'),
				description: 'Eintrittspreise, Ermäßigungen und das Werkstattticket am Samstag.',
				status: 'translated'
			}
		]
	},
	{
		slug: 'the-type-collection',
		section: 'collections',
		position: 1,
		title: 'The type collection',
		summary:
			'Around four hundred cases of foundry type, from a sixteenth century Garamond cutting to the last German foundry orders.',
		body: [
			'The collection holds about four hundred cases of metal type. The oldest is a Garamond cutting from the sixteenth century, kept in a single case that leaves the building only for conservation.',
			'Most of the collection is working type, which means it is set, printed and washed rather than displayed. A case that is never used goes to pieces more slowly and teaches nobody anything.',
			'The catalog is organized by foundry rather than by style, which surprises visitors who came looking for a shelf of sans serifs.'
		].join('\n\n'),
		translations: [
			{
				// No German version, which is the other half of the fallback
				// demonstration: German falls straight through to English here.
				locale: 'fr',
				title: 'La collection de caractères',
				summary:
					"Environ quatre cents casses de caractères de fonderie, d'un Garamond du seizième siècle aux dernières commandes allemandes.",
				text: [
					"La collection compte environ quatre cents casses de caractères en plomb. La plus ancienne est une taille de Garamond du seizième siècle, conservée dans une casse qui ne quitte le bâtiment que pour restauration.",
					"L'essentiel de la collection est du matériel de travail: il est composé, imprimé et lavé plutôt qu'exposé. Une casse qui ne sert jamais s'abîme plus lentement et n'apprend rien à personne.",
					'Le catalog est classé par fonderie et non par style, ce qui surprend les visiteurs venus chercher une étagère de linéales.'
				].join('\n\n'),
				description:
					'Des caractères de fonderie du seizième siècle à nos jours, classés par fonderie.',
				status: 'translated'
			}
		]
	},
	{
		slug: 'printing-workshops',
		section: 'collections',
		position: 2,
		title: 'Printing workshops',
		summary: 'Two hours at a hand press, with a compositor, ending in a sheet you set yourself.',
		body: [
			'Workshops run on Saturday mornings and take six people. You set a short text by hand, lock it into a forme, and print it on an 1893 Albion.',
			'Nobody leaves with a clean sheet on the first pull. Getting the ink right takes three or four attempts, and that is the part of the morning people remember.',
			'The workshop is included in the workshop ticket and cannot be booked separately, because the presses need setting up either way.'
		].join('\n\n'),
		translations: [
			{
				// Marked outdated: the German text is missing the third paragraph
				// the English source gained later.
				locale: 'de',
				title: 'Druckwerkstätten',
				summary:
					'Zwei Stunden an der Handpresse, mit einem Schriftsetzer, am Ende steht ein selbst gesetzter Bogen.',
				text: [
					'Die Werkstätten finden am Samstagmorgen statt und nehmen sechs Personen auf. Sie setzen einen kurzen Text von Hand, schließen ihn in eine Form und drucken ihn auf einer Albion von 1893.',
					'Beim ersten Abzug gelingt niemandem ein sauberer Bogen. Die richtige Farbgebung braucht drei oder vier Versuche, und genau daran erinnern sich die Gäste später.'
				].join('\n\n'),
				description: 'Handpressenkurse am Samstag, zwei Stunden an der Presse.',
				status: 'outdated'
			},
			{
				locale: 'fr',
				title: "Ateliers d'impression",
				summary: 'Deux heures à la presse à bras, avec un compositeur, et une feuille composée de vos mains.',
				text: [
					"Les ateliers ont lieu le samedi matin et accueillent six personnes. Vous composez un texte court à la main, le serrez dans une forme et l'imprimez sur une Albion de 1893.",
					"Personne n'obtient une feuille propre au premier tirage. Le bon encrage demande trois ou quatre essais, et c'est ce moment que les visiteurs retiennent.",
					"L'atelier est compris dans le billet atelier et ne se réserve pas séparément, car les presses doivent de toute façon être préparées."
				].join('\n\n'),
				description: "Ateliers de presse à bras le samedi, deux heures à la presse.",
				status: 'translated'
			}
		]
	},
	{
		slug: 'our-history',
		section: 'about-the-museum',
		position: 1,
		title: 'Our history',
		summary: "A jobbing printer's shop that never quite closed, and the sixty years since.",
		body: [
			"The building was a jobbing printer's shop from 1897 until 1963, when the last owner died and his daughter locked the door rather than sell the presses.",
			'It reopened as a museum in 1971, with the same machines in the same places, which is why the press hall is laid out for work rather than for visitors.',
			'The chimney is a survivor of the paper mill next door and has nothing to do with printing at all. People ask about it more often than they ask about the type.'
		].join('\n\n'),
		translations: [],
		sourceOnly: true
	}
];

// Sections first: a belongs_to relation emits a foreign key against the
// target's generated table, so the target has to exist before the schema that
// points at it is applied.
await applySchemas(client, [
	{
		name: SECTIONS,
		display_name: 'Site sections',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			// The engine takes no sort parameter, so navigation order is a field
			// the application sorts on.
			{ name: 'position', field_type: 'number' }
		]
	},
	{
		name: PAGES,
		display_name: 'Pages',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			{ name: 'position', field_type: 'number' },
			belongsTo('section', SECTIONS)
		]
	}
]);
console.log('content types ready');

const sectionIds: Record<string, string> = {};
for (const section of sections) {
	sectionIds[section.slug] = await ensureEntry(SECTIONS, section.slug, section.title, {
		slug: section.slug,
		position: section.position
	});
}

const pageIds: Record<string, string> = {};
for (const page of pages) {
	pageIds[page.slug] = await ensureEntry(PAGES, page.slug, page.title, {
		slug: page.slug,
		summary: page.summary,
		body: page.body,
		position: page.position,
		// A relation is written under its field name and read back as
		// `<field>_id`. It is also always optional: a required belongs_to
		// generates a second NOT NULL column the write path never fills, and
		// every insert then fails.
		section: sectionIds[page.section]
	});
}
console.log(`records ready: ${sections.length} sections, ${pages.length} pages`);

const everySeed: Seed[] = [...sections, ...pages];
const idFor = (seed: Seed) => sectionIds[seed.slug] ?? pageIds[seed.slug];

// One export tells us which records already carry translations. Re-importing
// over them would overwrite whatever was edited through the app, and bulk-import
// is an upsert with no way to ask it to skip an existing row.
const already = new Set(
	(await bulkExport(client, everySeed.map(idFor))).map((row) => row.entry_id)
);

const rows = everySeed
	.filter((seed) => !seed.sourceOnly && !already.has(idFor(seed)))
	.flatMap((seed) => translationRows(idFor(seed), seed));

if (rows.length === 0) {
	console.log('translations already present, nothing to import');
} else {
	const imported = await bulkImport(client, rows);
	console.log(`imported ${imported} translations across ${new Set(rows.map((r) => r.locale)).size} locales`);
}

/** Creates a content entry unless its slug is already taken, and returns the id. */
async function ensureEntry(
	schema: string,
	slug: string,
	title: string,
	body: Record<string, unknown>
): Promise<string> {
	const [existing] = await listContent(client, schema, { filters: { slug }, limit: 25 });
	if (existing) return existing.id;

	const { id } = await createContent(client, { schema, slug, title, body });
	return id;
}

/**
 * The rows for one record, default locale included.
 *
 * The default locale needs a row like every other language. `resolve` walks the
 * translation table and never reads the content entry, so an entry with no
 * English row answers with an empty title even though its own title is sitting
 * right there. The row below is derived from the entry so the two cannot drift.
 */
function translationRows(entryId: string, seed: Seed) {
	const own = {
		entry_id: entryId,
		locale: 'en',
		title: seed.title,
		body: { summary: seed.summary ?? '', text: seed.body ?? '' },
		meta: { description: seed.summary ?? '' },
		translation_status: 'translated' as Status
	};

	return [
		own,
		...seed.translations.map((t) => ({
			entry_id: entryId,
			locale: t.locale,
			title: t.title,
			// `body` and `meta` are opaque JSON to the engine. The keys are this
			// application's contract with itself.
			body: { summary: t.summary ?? '', text: t.text ?? '' },
			meta: { description: t.description ?? '' },
			translation_status: t.status
		}))
	];
}

interface ExportedRow {
	entry_id: string;
	locale: string;
}

/** `entry_ids` is validated min=1 max=200, and this site is well under it. */
async function bulkExport(c: LyeveClient, entryIds: string[]): Promise<ExportedRow[]> {
	const ids = entryIds.filter((id) => Boolean(id));
	if (ids.length === 0) return [];

	const res = await c.request<{ localizations: ExportedRow[] }>(
		'admin',
		'/api/admin/translations/bulk-export',
		{ method: 'POST', body: JSON.stringify({ entry_ids: ids }) }
	);
	return Array.isArray(res?.localizations) ? res.localizations : [];
}

/** Insert-or-update, in one transaction, keyed on tenant, entry and locale. */
async function bulkImport(c: LyeveClient, localizations: unknown[]): Promise<number> {
	const res = await c.request<{ imported: number }>(
		'admin',
		'/api/admin/translations/bulk-import',
		{ method: 'POST', body: JSON.stringify({ localizations }) }
	);
	return res?.imported ?? 0;
}
