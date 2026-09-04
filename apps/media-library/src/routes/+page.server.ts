import { listAlbums, listPhotos } from '$lib/server/gallery';
import { listMediaPage } from '$lib/server/media';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// The album count and the media count answer different questions, and the
	// gap between them is the interesting one: sys_media holds every file ever
	// uploaded, including files no photo entry points at any more.
	// One row, because only the count is wanted. total_count is a separate
	// COUNT that ignores the limit, so there is no reason to pull the page.
	const [albums, photos, media] = await Promise.all([
		listAlbums(),
		listPhotos(),
		listMediaPage({ limit: 1 })
	]);

	const byAlbum = new Map<string, typeof photos>();
	for (const photo of photos) {
		if (!photo.albumId) continue;
		const list = byAlbum.get(photo.albumId) ?? [];
		list.push(photo);
		byAlbum.set(photo.albumId, list);
	}

	return {
		albums: albums.map((album) => {
			const inAlbum = (byAlbum.get(album.id) ?? []).sort(
				(a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
			);
			return {
				...album,
				count: inAlbum.length,
				coverId: inAlbum.find((p) => p.mediaId)?.mediaId ?? null
			};
		}),
		unfiled: photos.filter((p) => !p.albumId).length,
		photoTotal: photos.length,
		// The whole tenant, not this app. Every example that uploaded a cover
		// image is counted here, because sys_media has no notion of which app
		// put a file in it.
		mediaTotal: media.total
	};
};
