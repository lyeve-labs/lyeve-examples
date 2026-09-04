import { json } from '@sveltejs/kit';
import { ARTICLES } from '$lib/server/lyeve';
import { instant, safely, search } from '$lib/server/search';
import type { RequestHandler } from './$types';

/**
 * The proxy the instant-search page types into.
 *
 * It exists because the instant route is on the admin router behind auth, like
 * everything else in the search plugin, so the browser cannot call it. Each
 * keystroke reaches this endpoint, which holds the credential and asks the
 * engine.
 *
 * It also runs the full search for the same term. That is the comparison the
 * page is for: instant search is a prefix match on the title and nothing else,
 * so the two numbers diverge immediately and the difference is the point.
 */
export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	if (!q) return json({ query: '', results: [], tookMs: 0, roundTripMs: 0, fullTotal: 0 });

	const started = performance.now();
	const suggestions = await instant(q, ARTICLES, 8);
	const roundTripMs = Math.round(performance.now() - started);

	// A failure here leaves a gap in a comparison rather than breaking the
	// suggestions the reader is waiting for.
	const full = await safely(search({ q, schema: ARTICLES, limit: 1 }));

	return json({
		query: suggestions.query,
		// The engine's own measurement of the query, which only this route
		// reports. A full search returns no timing at all.
		tookMs: suggestions.took_ms,
		roundTripMs,
		fullTotal: full?.total ?? null,
		results: suggestions.results.map((hit) => ({
			id: hit.entry_id,
			title: hit.title,
			slug: hit.slug
		}))
	});
};
