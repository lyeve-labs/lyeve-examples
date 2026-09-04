import { error } from '@sveltejs/kit';
import { mediaDownload } from '$lib/server/media';
import type { RequestHandler } from './$types';

/**
 * Serves the original bytes of one media record.
 *
 * The engine's own download route requires a bearer token, so a browser asking
 * it for bytes gets a 401 and the page shows a broken image. This route is the
 * credential boundary: the browser asks the app, and the app asks the engine.
 *
 * The upstream response carries `Content-Disposition: attachment` and
 * `Cache-Control: no-store`, which are right for an admin download and wrong
 * for an `<img>`. Neither header is forwarded: this route decides how its own
 * response is presented, and inline display with a cache is what a gallery
 * wants.
 */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const upstream = await mediaDownload(params.id);
	if (!upstream.ok || !upstream.body) {
		error(upstream.status === 404 ? 404 : 502, 'Image unavailable');
	}

	setHeaders({
		'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
		'cache-control': 'public, max-age=3600'
	});
	return new Response(upstream.body);
};
