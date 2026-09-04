/**
 * Creates the knowledge base and seeds it with enough documents to rank.
 *
 * Safe to run more than once: applying a schema that exists is accepted,
 * seeding stops if the base already holds articles, and the demonstration
 * synonym group is created only when no group claims its base term.
 *
 * Everything is written with createContent, which posts to the admin router.
 * That is not a style choice. Search reads sys_content_entries, and only the
 * admin write path puts a row there, so an article written to the public v1
 * endpoint is invisible to every search in this example, permanently and with
 * no error anywhere.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent, LyeveError,
	getContentBySlug
} from '../src/lib/lyeve/index.ts';
import { CATEGORIES, DEMO_SYNONYM, buildArticles } from './corpus.ts';

const client = lyeveFromEnv();

const CATEGORY_SCHEMA = 'kb_categories';
const ARTICLE_SCHEMA = 'kb_articles';

// Order matters: a relation emits a foreign key against the target's generated
// table, so categories must exist before articles references them.
await applySchemas(client, [
	{
		name: CATEGORY_SCHEMA,
		display_name: 'KB Categories',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true }
		]
	},
	{
		name: ARTICLE_SCHEMA,
		display_name: 'KB Articles',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			// Comma-separated rather than a json array, because search matches
			// against the body's raw JSON text and a string of words indexes
			// cleanly while an array of them indexes brackets and quotes too.
			{ name: 'keywords', field_type: 'text' },
			belongsTo('category', CATEGORY_SCHEMA)
		]
	}
]);
console.log('content types ready');

/**
 * Counts articles by paging, because a list answers at most 200 rows and the
 * corpus is larger than that. There is no count endpoint and no total on a
 * list response.
 */
async function existingArticleSlugs(): Promise<Set<string>> {
	const slugs = new Set<string>();
	for (let offset = 0; ; offset += 200) {
		const page = await listContent<{ slug?: string }>(client, ARTICLE_SCHEMA, { limit: 200, offset });
		for (const row of page) if (row.data.slug) slugs.add(row.data.slug);
		if (page.length < 200) return slugs;
	}
}

await ensureSynonym();

// Count what is there, do not just ask whether anything is.
//
// A run that dies partway leaves rows behind, and a guard that exits on "any
// rows" then refuses to finish the job for ever: the corpus stayed at 10 of 433
// articles and every later run reported nothing to do. The demonstrations in
// this app depend on the whole corpus, so a partial seed is a failure that has
// to look like one.
// Reuse a category that is already there rather than creating it again. A run
// that died partway had left them behind, and re-creating one is a 409 whose
// body names no field, so the second run failed on the first category and never
// reached the articles it was there to finish.
const categoryIds: Record<string, string> = {};
for (const category of CATEGORIES) {
	const existing = await getContentBySlug(client, CATEGORY_SCHEMA, category.slug);
	if (existing) {
		categoryIds[category.slug] = existing.id;
		continue;
	}
	const { id } = await createContent(client, {
		schema: CATEGORY_SCHEMA,
		slug: category.slug,
		title: category.title,
		body: { slug: category.slug }
	});
	categoryIds[category.slug] = id;
}
console.log(`seeded ${CATEGORIES.length} categories`);

const articles = buildArticles();

const present = await existingArticleSlugs();
if (present.size >= articles.length) {
	console.log(`articles already seeded (${present.size}), nothing to do`);
	process.exit(0);
}
if (present.size > 0) {
	console.log(`resuming: ${present.size} of ${articles.length} articles present`);
}

// Six at a time. One request per article is unavoidable, because there is no
// bulk write route, and 433 sequential round trips is a slow enough start that
// people stop the script and assume it hung. Six keeps the engine's write path
// busy without turning the seed into a load test.
const refused: string[] = [];
const alreadyPresent: string[] = [];
const CONCURRENCY = 6;
let written = 0;

await Promise.all(
	Array.from({ length: CONCURRENCY }, async (_unused, worker) => {
		for (let i = worker; i < articles.length; i += CONCURRENCY) {
			const article = articles[i];
			// Skip what a previous run already wrote. Re-creating an entry is a
			// 409 whose body names no field, so without this a resume dies on
			// the first article it has already done.
			if (present.has(article.slug)) continue;
			await writeArticle(article);
		}
	})
);

console.log(`seeded ${written} articles across ${CATEGORIES.length} categories`);

/**
 * Creates the synonym group the console demonstrates, unless it is already
 * there.
 *
 * The base term is unique per tenant, and a duplicate is refused with a 409
 * whose body names no field, so the list is read first rather than relying on
 * the status code to mean what it looks like it means.
 */
async function ensureSynonym(): Promise<void> {
	interface Group {
		id: string;
		base_term: string;
	}
	interface Page {
		data: Group[];
	}

	const page = await client.request<Page>('admin', '/api/admin/search/synonyms?limit=200');
	if ((page?.data ?? []).some((group) => group.base_term === DEMO_SYNONYM.base_term)) {
		console.log(`synonym group for "${DEMO_SYNONYM.base_term}" already present`);
		return;
	}

	try {
		await client.request('admin', '/api/admin/search/synonyms', {
			method: 'POST',
			body: JSON.stringify(DEMO_SYNONYM)
		});
		console.log(`synonym group for "${DEMO_SYNONYM.base_term}" created`);
	} catch (err) {
		if (err instanceof LyeveError && err.status === 409) {
			console.log(`synonym group for "${DEMO_SYNONYM.base_term}" already present`);
			return;
		}
		throw err;
	}
}

/**
 * Writes one article, and records a refusal the WAF cannot be talked out of.
 *
 * Four of these articles are about Postgres locking and name ALTER TABLE in
 * their title and keywords. The WAF scores that phrase at the block threshold,
 * so an authenticated super_admin writing an ordinary technical article is
 * refused 403. The response names no rule and no field.
 *
 * They are not renamed to get past it. A knowledge base that cannot publish an
 * article about a schema migration is a real limit of the product, and an
 * example that quietly avoided the phrase would hide it. The seed reports what
 * was refused and carries on, so the corpus is short by a known four rather
 * than dead at the first one.
 */
async function writeArticle(article: Article): Promise<void> {
	try {
		await createContent(client, {
			schema: ARTICLE_SCHEMA,
			slug: article.slug,
			title: article.title,
			body: {
				slug: article.slug,
				summary: article.summary,
				body: article.body,
				keywords: article.keywords,
				// Relations are written under the field name. A search hit carries
				// the document exactly as written, so this reads back as
				// `category` in a hit and as `category_id` from the public
				// content route.
				category: categoryIds[article.category]
			}
		});
		written += 1;
	} catch (err) {
		if (!(err instanceof LyeveError)) throw err;

		if (err.code === 'waf_blocked') {
			refused.push(article.slug);
			return;
		}
		// A conflict means the entry is already in the content store, which is
		// not the same as being readable. The resume list is built from the
		// public route, and a write can commit, answer 201, and have its
		// projection into the generated table canceled, so an entry can exist
		// to the unique index and be absent from the read this resume consulted.
		// Treating the conflict as present is the only correct reading.
		if (err.status === 409) {
			alreadyPresent.push(article.slug);
			return;
		}
		throw err;
	}
}

if (alreadyPresent.length > 0) {
	console.log(
		`\n${alreadyPresent.length} article(s) were already in the content store but absent from the ` +
		`public read this resume consulted, so a write had committed without being projected. ` +
		`They are counted as present.`
	);
}

if (refused.length > 0) {
	console.log(
		`\n${refused.length} article(s) refused by the WAF, which scores the phrase ALTER TABLE ` +
		`at its block threshold:\n  ${refused.join('\n  ')}\n` +
		`The corpus is short by that many on purpose. See the README.`
	);
}
