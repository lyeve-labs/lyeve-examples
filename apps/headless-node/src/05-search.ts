/**
 * Step 5. Search, and the content that search cannot see.
 *
 *   pnpm search
 *
 * Search lives on the admin router. There is no /api/v1/search, so a public
 * search box is always proxied by your own server, which it would have to be
 * anyway because the engine reads nothing without a token.
 *
 * It reads the catalog table, which means it only sees content written
 * through POST /api/admin/content. This script writes one entry the other way,
 * through the v1 route the SDK exports as createContent(), and then shows you
 * the hole it falls into. The entry is real, it is readable, and it is
 * unfindable, forever, with no error at any point.
 *
 * Safe to run repeatedly. The demonstration entry is written once.
 */
import type { Content, HttpClient } from '@lyeve-labs/client';
import { createContent, search, type SearchResponse } from '@lyeve-labs/client-rest';
import { ARTICLES, SLUG_PREFIX, heading, note, row, run, section, signIn, signedInClient } from './lyeve.ts';

const ORPHAN_SLUG = `${SLUG_PREFIX}isotope-2-4-release-notes`;
const ORPHAN_TERM = 'Isotope';
const INDEXED_TERM = 'backpressure';

async function bySlug(client: HttpClient, slug: string): Promise<Content[]> {
	const query = new URLSearchParams({ limit: '25', 'filters[slug]': slug });
	return client.get<Content[]>(`/api/v1/content/${ARTICLES}?${query.toString()}`);
}

function report(label: string, found: SearchResponse): void {
	row(label, `total ${found.total}`);
	for (const hit of found.results) {
		row('  hit', `${hit.title}  (${hit.schema}, ${hit.status})`);
	}
}

await run(async () => {
	heading('05  Search');

	const client = signedInClient(await signIn());

	section('Content written through the admin route');
	report(`search "${INDEXED_TERM}"`, await search(INDEXED_TERM, client));

	section('Now write one entry the other way');
	const existing = await bySlug(client, ORPHAN_SLUG);
	if (existing.length > 0) {
		row(ORPHAN_SLUG, 'already written on an earlier run');
	} else {
		// This is the SDK's own createContent, and it posts to
		// /api/v1/content/{type}. The write succeeds. The row is real.
		await createContent(
			ARTICLES,
			{
				title: `${ORPHAN_TERM} 2.4 release notes`,
				slug: ORPHAN_SLUG,
				summary: 'Ingest workers now shed load instead of queueing it. Two config keys were renamed.',
				body: 'The scheduler no longer buffers work it cannot start within the window. A rejected batch is reported to the caller with the window it missed, so a retry can be scheduled rather than guessed.',
				read_minutes: 2
			},
			client
		);
		row(ORPHAN_SLUG, 'written through POST /api/v1/content');
	}

	section('It is really there');
	const orphan = await bySlug(client, ORPHAN_SLUG);
	row('rows on the v1 router', orphan.length);
	row('title', orphan.length > 0 ? String(orphan[0].data.title) : '(missing)');

	section('And search cannot see it');
	report(`search "${ORPHAN_TERM}"`, await search(ORPHAN_TERM, client));
	note('Zero hits. Not an error, not a delay, not a missing index. The entry was never in the catalog table.');
	note('The same entry is also absent from the admin UI, so nobody can find it there and fix it either.');

	section('Searching a subset');
	// The SDK's search() sends q and nothing else. The route also takes schema,
	// status, tags, limit, offset and highlight, so a real search page builds
	// its own query on the same client.
	const scoped = new URLSearchParams({ q: INDEXED_TERM, schema: ARTICLES, limit: '5', highlight: 'true' });
	const page = await client.get<SearchResponse>(`/api/admin/search?${scoped.toString()}`);
	row('scoped to one type', `total ${page.total}, limit ${page.limit}, offset ${page.offset}`);

	section('The rule that follows from this');
	note('Write with POST /api/admin/content. Always. The v1 write route is for data you are willing to lose track of.');
	note('If you have already used it, re-writing the same entries through the admin route is the only repair.');
});
