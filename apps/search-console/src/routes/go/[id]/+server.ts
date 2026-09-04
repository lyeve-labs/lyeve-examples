import { error, redirect } from '@sveltejs/kit';
import { recordReportedClick } from '$lib/server/clicks';
import { logClick, safely } from '$lib/server/search';
import { sessionId } from '$lib/server/session';
import type { RequestHandler } from './$types';

/**
 * Records that a search result was clicked, then sends the reader on.
 *
 * This hop exists because the engine records nothing by itself. A click is
 * attached to the most recent logged search with the same query text and
 * session id, so the click has to be reported from the server, with the same
 * session cookie and the exact text that was logged, before the article page
 * loads. A link straight to the article would report nothing.
 *
 * Only the first click on a given logged search is kept: the update matches on
 * `clicked_entry_id IS NULL`, so a second click on the same result set is
 * accepted with a 202 and stored nowhere.
 */
export const GET: RequestHandler = async ({ params, url, cookies }) => {
	const slug = url.searchParams.get('slug');
	if (!slug) error(400, 'No article named');

	const query = url.searchParams.get('q') ?? '';
	if (query) {
		await safely(
			logClick({
				entry_id: params.id,
				query_text: query,
				session_id: sessionId(cookies)
			})
		);
		recordReportedClick();
	}

	redirect(303, `/articles/${encodeURIComponent(slug)}`);
};
