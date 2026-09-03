import { error } from '@sveltejs/kit';
import { mediaBytes } from '$lib/lyeve';
import { lyeve } from '$lib/server/lyeve';
import type { RequestHandler } from './$types';

/**
 * Serves a public image, such as an employer logo.
 *
 * The engine's own download route requires a bearer token, so a browser asking
 * it for bytes gets a 401 and the page shows a broken image. This route is the
 * credential boundary: the browser asks the app, and the app asks the engine.
 *
 * It refuses anything that is not an image, and that refusal is the point. The
 * engine has one media library and no per-record access control, so every CV
 * this board receives sits behind the same credential as every logo. Without
 * the check, a public route with a uuid in it would hand out applicants' CVs.
 */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	const upstream = await mediaBytes(lyeve, params.id);
	if (!upstream.ok || !upstream.body) error(upstream.status === 404 ? 404 : 502, 'Image unavailable');

	const contentType = upstream.headers.get('content-type') ?? '';
	if (!contentType.startsWith('image/')) {
		await upstream.body.cancel();
		error(404, 'Image unavailable');
	}

	setHeaders({
		'content-type': contentType,
		'cache-control': 'public, max-age=3600'
	});
	return new Response(upstream.body);
};
