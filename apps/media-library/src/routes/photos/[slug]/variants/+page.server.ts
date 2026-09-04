import { error } from '@sveltejs/kit';
import { getPhoto } from '$lib/server/gallery';
import { PRESETS, getMediaRecord, getMediaThumbnails, variantStates } from '$lib/server/media';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const photo = await getPhoto(params.slug);
	if (!photo) error(404, 'No such photograph');
	if (!photo.mediaId) error(404, 'This photograph has no media record');

	const record = await getMediaRecord(photo.mediaId);
	if (!record) error(404, 'The media record this photograph names no longer exists');

	// Both doors to the same rows, on purpose. GET /api/admin/media/{id}
	// attaches the variants. GET /api/admin/media/{id}/thumbnails returns the
	// same rows plus a url field. The url is the only difference and it is the
	// one that decides whether the bytes can be served.
	const thumbs = await getMediaThumbnails(photo.mediaId);

	return {
		photo,
		record: {
			id: record.id,
			filename: record.filename,
			key: record.key,
			contentType: record.content_type,
			width: record.width ?? 0,
			height: record.height ?? 0,
			size: record.size
		},
		presets: PRESETS.map((p) => ({ ...p })),
		variants: variantStates(record, thumbs),
		attachedCount: record.thumbnails?.length ?? 0,
		thumbnailRouteCount: thumbs.length
	};
};
