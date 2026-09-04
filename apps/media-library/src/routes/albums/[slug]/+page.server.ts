import { error } from '@sveltejs/kit';
import { getAlbum, listAlbumPhotos } from '$lib/server/gallery';
import { PRESETS, albumFolder } from '$lib/naming';
import { listMediaPage, searchMedia } from '$lib/server/media';
import type { PageServerLoad } from './$types';

const LARGE = PRESETS[2];

export const load: PageServerLoad = async ({ params }) => {
	const album = await getAlbum(params.slug);
	if (!album) error(404, 'No such album');

	const folder = albumFolder(album.segment);

	// Two views of the same set, deliberately. The photo entries are what this
	// app wrote. The folder listing is what the media plugin holds. They can
	// disagree, and an album page that read only one of them would never show
	// it: a failed content write after a successful upload leaves a file in the
	// folder with no entry pointing at it.
	//
	// The two searches answer one question. A frame can carry the large variant
	// when it is wider than the box or taller than it, and the media filter has
	// no way to express OR across two fields, so the union is taken here. The
	// content routes cannot ask this at all: there is no operator beyond exact
	// equality on them.
	const [photos, stored, wide, tall] = await Promise.all([
		listAlbumPhotos(album.id),
		listMediaPage({ folder, limit: 500 }),
		searchMedia({ folder, kind: 'image', min_width: LARGE.width + 1, limit: 200 }),
		searchMedia({ folder, kind: 'image', min_height: LARGE.height + 1, limit: 200 })
	]);

	const referenced = new Set(photos.map((p) => p.mediaId).filter(Boolean));
	const largeCapable = new Set([...wide.items, ...tall.items].map((m) => m.id));

	return {
		album,
		folder,
		photos: photos.map((photo) => ({
			id: photo.id,
			title: photo.title,
			segment: photo.segment,
			caption: photo.caption,
			mediaId: photo.mediaId,
			width: photo.width,
			height: photo.height
		})),
		storedInFolder: stored.total,
		largeBox: LARGE.width,
		largeCapable: largeCapable.size,
		orphans: stored.items
			.filter((m) => !referenced.has(m.id))
			.map((m) => ({ id: m.id, filename: m.filename, size: m.size, key: m.key }))
	};
};
