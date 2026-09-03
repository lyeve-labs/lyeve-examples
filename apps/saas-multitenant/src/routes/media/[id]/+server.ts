import { error } from '@sveltejs/kit';
import { mediaBytes } from '$lib/lyeve';
import { lyeve } from '$lib/server/lyeve';
import type { RequestHandler } from './$types';

/**
 * Serves an uploaded image.
 *
 * The engine's own download route requires a bearer token, so a browser asking
 * it for bytes gets a 401 and the page shows a broken image. This route is the
 * credential boundary: the browser asks the app, and the app asks the engine.
 */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const upstream = await mediaBytes(lyeve, params.id);
	if (!upstream.ok || !upstream.body) error(upstream.status === 404 ? 404 : 502, 'Image unavailable');

	setHeaders({
		'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
		'cache-control': 'public, max-age=3600'
	});
	return new Response(upstream.body);
};
