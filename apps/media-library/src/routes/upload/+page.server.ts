import { fail } from '@sveltejs/kit';
import { LyeveError, createContent } from '$lib/lyeve';
import { listAlbums } from '$lib/server/gallery';
import { PHOTOS, albumFolder, photoSlug } from '$lib/naming';
import { lyeve } from '$lib/server/lyeve';
import { PRESETS, getMediaThumbnails, uploadFiles, type MediaRecord } from '$lib/server/media';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const albums = await listAlbums();
	return {
		albums: albums.map((a) => ({ id: a.id, title: a.title, segment: a.segment })),
		presets: PRESETS.map((p) => ({ ...p }))
	};
};

/**
 * One shape for every outcome, so the page reads `form?.accepted` without
 * narrowing a union of unrelated payloads first.
 */
interface UploadForm {
	error: string | null;
	batchSize: number | null;
	accepted: Accepted[] | null;
	albumSegment: string | null;
	albumTitle: string | null;
}

function blank(): UploadForm {
	return { error: null, batchSize: null, accepted: null, albumSegment: null, albumTitle: null };
}

interface Accepted {
	id: string;
	filename: string;
	key: string;
	contentType: string;
	size: number;
	width: number;
	height: number;
	folder: string;
	scanStatus: string;
	scanResult: string;
	tags: string[];
	variants: string[];
	/** Presets the source already fits inside, which the processor declines to upscale. */
	skipped: string[];
	/** Presets the source is large enough for that produced nothing anyway. */
	missing: string[];
	/** The photo entry that now points at this record, when one could be written. */
	photoSegment: string | null;
	slugRetried: boolean;
	entryError: string | null;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/\.[a-z0-9]+$/, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

function titleFrom(filename: string): string {
	const base = slugify(filename).replace(/-/g, ' ');
	return base ? base[0].toUpperCase() + base.slice(1) : 'Untitled';
}

/**
 * Writes the photo entry for one uploaded file.
 *
 * A slug is unique per tenant across every content type, with no schema in the
 * index, so a plausible word can be taken by an entry of a completely
 * unrelated type in another example. The refusal is a 409 whose body names no
 * field. The first attempt uses the readable slug. A 409 retries once with the
 * record id appended, which cannot collide.
 */
async function writePhotoEntry(
	record: MediaRecord,
	albumId: string
): Promise<{ segment: string | null; retried: boolean; error: string | null }> {
	const base = slugify(record.filename) || 'photograph';
	const body = {
		caption: record.alt_text ?? '',
		media_id: record.id,
		width: record.width ?? 0,
		height: record.height ?? 0,
		album: albumId
	};

	for (const [attempt, segment] of [base, `${base}-${record.id.slice(0, 8)}`].entries()) {
		try {
			await createContent(lyeve, {
				schema: PHOTOS,
				slug: photoSlug(segment),
				title: titleFrom(record.filename),
				body: { slug: photoSlug(segment), ...body }
			});
			return { segment, retried: attempt > 0, error: null };
		} catch (err) {
			if (err instanceof LyeveError && err.status === 409 && attempt === 0) continue;
			const message = err instanceof LyeveError ? err.message : String(err);
			return { segment: null, retried: attempt > 0, error: message };
		}
	}

	return { segment: null, retried: true, error: 'the slug was taken twice over' };
}

export const actions: Actions = {
	default: async ({ request }) => {
		const posted = await request.formData();
		const albumId = String(posted.get('album') ?? '');
		const altText = String(posted.get('alt_text') ?? '').trim();

		const albums = await listAlbums();
		const album = albums.find((a) => a.id === albumId);
		if (!album) {
			return fail(400, { ...blank(), error: 'Choose an album for these photographs.' });
		}

		// An empty file input still posts a part, with an empty name and no
		// bytes. Sending it would fail the whole batch on a sniff error.
		const files = posted
			.getAll('files')
			.filter((v): v is File => v instanceof File && v.size > 0 && v.name !== '');
		if (files.length === 0) {
			return fail(400, { ...blank(), error: 'Choose at least one image file.' });
		}

		const folder = albumFolder(album.segment);
		const result = await uploadFiles(files, { folder, altText });

		if (result.error) {
			// One request, one outcome. The handler rolls back every file it had
			// already stored before the failure, so nothing partial survives and
			// there is no per-file detail to report.
			return fail(result.status ?? 502, {
				...blank(),
				error: `The engine rejected the batch: ${result.error}`,
				batchSize: files.length
			});
		}

		const accepted: Accepted[] = [];
		for (const record of result.records) {
			const entry = await writePhotoEntry(record, album.id);
			// The upload response carries no variants. Generation happens inline,
			// before the request returns, and the rows are written to
			// sys_media_thumbnails without ever being attached to the item the
			// handler marshals. Only the get and thumbnails routes report them, so
			// finding out what an upload produced is a second request per file.
			const variants = (await getMediaThumbnails(record.id)).map((t) => t.size);
			accepted.push({
				id: record.id,
				filename: record.filename,
				key: record.key,
				contentType: record.content_type,
				size: record.size,
				width: record.width ?? 0,
				height: record.height ?? 0,
				folder: record.folder,
				scanStatus: record.scan_status ?? '',
				scanResult: record.scan_result ?? '',
				tags: record.tags ?? [],
				variants,
				skipped: PRESETS.filter(
					(p) =>
						!variants.includes(p.name) &&
						(record.width ?? 0) <= p.width &&
						(record.height ?? 0) <= p.height
				).map((p) => p.name),
				missing: PRESETS.filter(
					(p) =>
						!variants.includes(p.name) &&
						((record.width ?? 0) > p.width || (record.height ?? 0) > p.height)
				).map((p) => p.name),
				photoSegment: entry.segment,
				slugRetried: entry.retried,
				entryError: entry.error
			});
		}

		return { ...blank(), accepted, albumSegment: album.segment, albumTitle: album.title };
	}
};
