/**
 * Step 4. Read it back: pages, filters, relations.
 *
 *   pnpm read-content
 *
 * Reads come from the public v1 router. Every number this script prints is the
 * engine's answer, not a claim from a document, so run it against your own
 * stack and believe the output over the prose.
 */
import type { Content, HttpClient } from '@lyeve-labs/client';
import { getContent, listContent, listContentCursor } from '@lyeve-labs/client-rest';
import {
	ARTICLES, SLUG_PREFIX, heading, note, related, relationId, row, run, section, signIn, signedInClient
} from './lyeve.ts';

/**
 * The SDK's listContent takes a limit and an offset and nothing else. Filters
 * and relation population are query parameters it does not model, so anything
 * past a plain page is a hand-built path on the same client.
 */
function contentPath(schema: string, params: Record<string, string>): string {
	const query = new URLSearchParams(params);
	return `/api/v1/content/${encodeURIComponent(schema)}?${query.toString()}`;
}

function titlesOf(rows: Content[]): string {
	return rows.map((r) => String(r.data.title)).join(' | ') || '(nothing)';
}

await run(async () => {
	heading('04  Read content');

	const client: HttpClient = signedInClient(await signIn());

	section('A plain page');
	const page = await listContent(ARTICLES, client, 25, 0);
	row('rows returned', page.length);
	row('response shape', 'a bare JSON array, with no total and no has_more');
	row('order', 'created_at descending, always');

	section('The limit is not yours to choose');
	const small = await listContent(ARTICLES, client, 3, 0);
	row('asked for', 3);
	row('got back', small.length);
	note('The offset route clamps limit into 25..200. Ask for 3 and you are served 25, with no warning.');
	note('So a page of 3 is a slice in your own code, not a smaller request.');
	row('sliced to 3', titlesOf(small.slice(0, 3)));

	section('Offset paging');
	const first = await listContent(ARTICLES, client, 25, 0);
	const second = await listContent(ARTICLES, client, 25, 25);
	row('page 1 rows', first.length);
	row('page 2 rows', second.length);
	note('There is no total anywhere in the response, so "last page" means "a short page".');

	section('Cursor paging, which behaves differently');
	// The cursor route is a separate endpoint with its own rules: it walks by
	// id ascending and it honors the page size you ask for. Two facts the
	// offset route does not share, and the reason a full export uses this one.
	const cursorPage = await listContentCursor(ARTICLES, client, undefined, 2);
	row('asked for', 2);
	row('got back', cursorPage.items.length);
	row('next_cursor', cursorPage.next_cursor || '(none, this was the last page)');
	if (cursorPage.next_cursor) {
		const nextPage = await listContentCursor(ARTICLES, client, cursorPage.next_cursor, 2);
		row('page 2 rows', nextPage.items.length);
	}

	section('Filtering');
	const slug = `${SLUG_PREFIX}backpressure-is-a-product-decision`;
	const matched = await client.get<Content[]>(contentPath(ARTICLES, { limit: '25', 'filters[slug]': slug }));
	row('filters[slug]', slug);
	row('matched', matched.length);
	note('Filters are exact equality on one column. There is no LIKE, no range, no OR and no null test.');
	note('An unknown parameter is ignored in silence, so a typo in a filter name reads as no filter at all.');

	section('Relations, unpopulated');
	if (matched.length === 0) throw new Error('seed content is missing; run pnpm write-content first');
	const plain = matched[0];
	row('data.author', plain.data.author ?? 'null');
	row('data.author_id', plain.data.author_id ?? 'null');
	note('You write author and you read author_id. The bare author key is the dead half of the pair and is always null.');
	row('relationId(data)', relationId(plain.data, 'author'));

	section('Relations, populated');
	const populated = await client.get<Content[]>(
		contentPath(ARTICLES, { limit: '25', 'filters[slug]': slug, populate: 'author' })
	);
	if (populated.length === 0) throw new Error('the populated read returned nothing');
	const inflated = populated[0];
	const author = related<{ title: string; bio: string }>(inflated.data, 'author');
	row('author.title', author?.title ?? '(not populated)');
	row('author.bio', author?.bio ?? '(not populated)');
	note('populate=author inflates the id into the whole record in one round trip. depth=1 does it for every relation.');

	section('One entry by id');
	const single = await getContent(ARTICLES, inflated.id, client);
	row('id', single.id);
	row('title', String(single.data.title));
	row('created_at', single.created_at);

	section('Sorting');
	// There is no sort parameter. Unknown parameters are dropped without
	// comment, so ?sort=title looks like it worked and changes nothing.
	// First three of each, so the difference is visible without a wall of titles.
	const byTitle = [...page].sort((a, b) => String(a.data.title).localeCompare(String(b.data.title)));
	row('engine order', titlesOf(page.slice(0, 3)));
	row('sorted by title here', titlesOf(byTitle.slice(0, 3)));
	note('Sorting other than newest-first happens in your code, over a page you already hold.');
});
