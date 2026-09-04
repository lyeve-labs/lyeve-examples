import { error } from '@sveltejs/kit';
import { getPhoto, listAlbums } from '$lib/server/gallery';
import {
	getMediaRecord,
	isUnverified,
	scanExplanation,
	variantStates,
	type MediaRecord
} from '$lib/server/media';
import type { PageServerLoad } from './$types';

/** sys_media has no updated_at column, so every record reports the Go zero time. */
const ZERO_TIME = '0001-01-01T00:00:00Z';

interface Field {
	label: string;
	value: string;
	note: string;
}

/**
 * Flattens the record into labeled rows.
 *
 * Built here rather than in the page because the note beside each value is the
 * point of this example, and a note is a claim about the engine that belongs
 * next to the code that read the engine.
 */
function recordFields(record: MediaRecord): Field[] {
	return [
		{ label: 'id', value: record.id, note: '' },
		{
			label: 'key',
			value: record.key,
			note: 'The storage key. It opens with a slash when the folder defaulted to "/", because the key is built by trimming slashes off the folder and joining.'
		},
		{
			label: 'filename',
			value: record.filename,
			note: 'As submitted. The key carries a sanitized copy with spaces and anything outside [A-Za-z0-9._-] removed.'
		},
		{
			label: 'content_type',
			value: record.content_type,
			note: 'Sniffed from the leading bytes. A mismatched declaration is rejected, and the declaration never wins.'
		},
		{
			label: 'size',
			value: `${record.size} bytes`,
			note: 'The bytes on disk after the EXIF strip re-encoded the file, not the bytes that were uploaded. A checksum of your upload will not match.'
		},
		{ label: 'folder', value: record.folder, note: 'Exact string match is the only way to filter a list by it.' },
		{ label: 'tenant_id', value: record.tenant_id, note: '' },
		{
			label: 'width x height',
			value: record.width && record.height ? `${record.width} x ${record.height}` : 'not recorded',
			note: 'Read from the decoded image, and re-read after processing. Zero means the decoder could not open the file.'
		},
		{
			label: 'alt_text',
			value: record.alt_text || 'empty',
			note: 'One value per upload request, applied to every file in it. No route updates it afterwards.'
		},
		{
			label: 'tags',
			value: (record.tags ?? []).join(', ') || 'none',
			note: 'Derived from the metadata and the media kind. No route accepts tags, so a plain image is tagged "image" and nothing else.'
		},
		{ label: 'uploaded_by', value: record.uploaded_by ?? 'none', note: 'The user id from the token that uploaded it.' },
		{
			label: 'thumbnail_key',
			value: record.thumbnail_key || 'empty',
			note: 'A single-variant column from the first migration. The variants live in sys_media_thumbnails and this stays empty.'
		},
		{ label: 'created_at', value: record.created_at, note: '' },
		{
			label: 'updated_at',
			value: record.updated_at,
			note:
				record.updated_at === ZERO_TIME
					? 'Not a timestamp. sys_media has no updated_at column, so this is the Go zero time on every record ever returned.'
					: ''
		},
		{
			label: 'url',
			value: record.url || 'absent',
			note: 'The local driver signs a URL only when a base URL and a signing secret are both configured. Otherwise the key is dropped from the response and the bytes have exactly one door: the download route.'
		}
	];
}

export const load: PageServerLoad = async ({ params }) => {
	const photo = await getPhoto(params.slug);
	if (!photo) error(404, 'No such photograph');

	const record = photo.mediaId ? await getMediaRecord(photo.mediaId) : null;

	// The relation stores an album id and the engine offers no reverse lookup,
	// so the album list is fetched and matched. For three albums that is
	// cheaper than a populated read of the photo.
	const albums = await listAlbums();
	const album = albums.find((a) => a.id === photo.albumId) ?? null;

	return {
		photo,
		album,
		fields: record ? recordFields(record) : [],
		metadata: (record?.metadata ?? {}) as Record<string, unknown>,
		variants: record ? variantStates(record, record.thumbnails ?? []) : [],
		hasRecord: record !== null,
		scan: {
			status: record?.scan_status ?? '',
			result: record?.scan_result ?? '',
			explanation: scanExplanation(record?.scan_status, record?.scan_result),
			unverified: isUnverified(record?.scan_status)
		}
	};
};
