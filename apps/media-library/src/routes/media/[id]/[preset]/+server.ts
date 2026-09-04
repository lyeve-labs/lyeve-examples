import { error } from '@sveltejs/kit';
import { PRESETS, getMediaThumbnails, variantBytesReachable } from '$lib/server/media';
import type { RequestHandler } from './$types';

/**
 * Serves one generated variant, where the deployment makes that possible.
 *
 * It usually does not, and the reason is worth stating plainly rather than
 * hiding behind a fallback. The media plugin declares nine routes and not one
 * of them serves a variant's bytes. An original is addressable by its record id
 * through `/api/admin/media/{id}/download`. A variant has a row in
 * `sys_media_thumbnails`, a file on disk and a storage key, and the only door to
 * it is the URL the storage driver signs. The local driver never receives a
 * signing key, because it reads `storage_local_signing_secret` through
 * Config.String and the config layer redacts every key ending in `_secret`, so
 * on a local install the API describes a file it cannot hand over. An S3 or CDN
 * driver does sign URLs, which is the deployment where this route serves bytes.
 *
 * This route therefore answers 404 rather than quietly serving the original at
 * the variant's address. Serving the full-size image from `/small` would make
 * every page look correct while sending forty times the bytes, which is the
 * failure this route exists to make visible.
 */
export const GET: RequestHandler = async ({ params, setHeaders, fetch }) => {
	if (!PRESETS.some((p) => p.name === params.preset)) {
		error(404, `No such preset: ${params.preset}`);
	}

	const thumbs = await getMediaThumbnails(params.id);
	const variant = thumbs.find((t) => t.size === params.preset);
	if (!variant) {
		error(404, `No ${params.preset} variant exists for this image`);
	}
	if (!variantBytesReachable(variant)) {
		error(
			404,
			`The ${params.preset} variant exists at ${variant.key} but the storage driver signs no URL for it, so its bytes are not reachable over HTTP`
		);
	}

	// Only ever an absolute http(s) URL minted by our own storage driver, which
	// is what variantBytesReachable checks before this line runs.
	const upstream = await fetch(variant.url as string);
	if (!upstream.ok || !upstream.body) error(502, 'Variant unavailable');

	setHeaders({
		'content-type': upstream.headers.get('content-type') ?? `image/${variant.format}`,
		'cache-control': 'public, max-age=3600'
	});
	return new Response(upstream.body);
};
