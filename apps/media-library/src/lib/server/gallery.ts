/**
 * Album and photo reads.
 *
 * Photos are ordinary content entries that hold a media id in a text field.
 * They are not media records, and the separation is the point: the entry owns
 * the title, the caption and the album it belongs to, and the media record owns
 * the bytes, the dimensions, the variants and the scan status. Neither knows
 * about the other beyond that one id.
 */
import { getContentBySlug, listContent, relationId } from '$lib/lyeve';
import { ALBUMS, PHOTOS, albumSegment, albumSlug, photoSegment, photoSlug } from '$lib/naming';
import { lyeve } from './lyeve';

export interface AlbumData {
	title: string;
	slug: string;
	description?: string;
}

export interface PhotoData {
	title: string;
	slug: string;
	caption?: string;
	media_id?: string;
	width?: number;
	height?: number;
}

export interface Album {
	id: string;
	title: string;
	segment: string;
	description: string;
}

export interface Photo {
	id: string;
	title: string;
	segment: string;
	caption: string;
	mediaId: string | null;
	width: number;
	height: number;
	albumId: string | null;
	createdAt: string;
}

function toAlbum(row: { id: string; data: AlbumData }): Album {
	return {
		id: row.id,
		title: row.data.title,
		segment: albumSegment(row.data.slug),
		description: row.data.description ?? ''
	};
}

function toPhoto(row: { id: string; data: PhotoData; created_at: string }): Photo {
	return {
		id: row.id,
		title: row.data.title,
		segment: photoSegment(row.data.slug),
		caption: row.data.caption ?? '',
		mediaId: row.data.media_id ?? null,
		width: Number(row.data.width ?? 0),
		height: Number(row.data.height ?? 0),
		// A relation is written under its field name and read back under
		// `<field>_id`, with a dead `album: null` beside it.
		albumId: relationId(row.data, 'album'),
		createdAt: row.created_at
	};
}

export async function listAlbums(): Promise<Album[]> {
	const rows = await listContent<AlbumData>(lyeve, ALBUMS, { limit: 25 });
	return rows.map(toAlbum).sort((a, b) => a.title.localeCompare(b.title));
}

export async function getAlbum(segment: string): Promise<Album | null> {
	const row = await getContentBySlug<AlbumData>(lyeve, ALBUMS, albumSlug(segment));
	return row ? toAlbum(row) : null;
}

/**
 * Every photo, newest first.
 *
 * The album index needs a count and a cover per album, and the engine cannot
 * group or join, so one list of photos is fetched and grouped here. Filtering
 * per album would be one request per album for the same rows.
 */
export async function listPhotos(): Promise<Photo[]> {
	const rows = await listContent<PhotoData>(lyeve, PHOTOS, { limit: 200 });
	return rows.map(toPhoto);
}

/**
 * The photos in one album, oldest first so a set reads in the order it was shot.
 *
 * The filter is on the foreign key, because `filters[album]` is a 400 and the
 * engine does not join, so there is no way to name the album by its slug here.
 * The caller resolves the slug to an id first.
 */
export async function listAlbumPhotos(albumId: string): Promise<Photo[]> {
	const rows = await listContent<PhotoData>(lyeve, PHOTOS, {
		limit: 200,
		filters: { album_id: albumId }
	});
	return rows
		.map(toPhoto)
		.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function getPhoto(segment: string): Promise<Photo | null> {
	const row = await getContentBySlug<PhotoData>(lyeve, PHOTOS, photoSlug(segment));
	return row ? toPhoto(row) : null;
}
