/**
 * Creates the gallery's content types, generates the photographs and uploads
 * them.
 *
 * Safe to run more than once. Applying a schema that exists is accepted, an
 * album that exists is reused, and a file already stored in the album's folder
 * under the same name is not uploaded again. Media is the one part of a seed
 * that a naive re-run makes a mess of: an upload always succeeds and always
 * creates a new record, so nothing about a duplicate announces itself.
 *
 * The image sizes are chosen deliberately. The processor skips a preset whose
 * box already contains the source in both dimensions, so the set straddles
 * 150, 480 and 1024 and the report at the end shows the skipping happening.
 */
import {
	lyeveFromEnv,
	applySchemas,
	belongsTo,
	getContentBySlug,
	listContent,
	createContent,
	type LyeveClient
} from '../src/lib/lyeve/index.ts';
import {
	ALBUMS,
	PHOTOS,
	PRESETS,
	albumFolder,
	albumSlug,
	photoSlug,
	presetSkipped
} from '../src/lib/naming.ts';
import { TONES, photoPng, type Rgb } from './photo-image.ts';

interface MediaRecord {
	id: string;
	key: string;
	filename: string;
	content_type: string;
	size: number;
	folder: string;
	width?: number;
	height?: number;
	scan_status?: string;
	scan_result?: string;
	tags?: string[];
}

interface Thumbnail {
	size: string;
	width: number;
	height: number;
	format: string;
}

const client = lyeveFromEnv();

// Albums before photos: a relation emits a foreign key against the target's
// generated table, so gallery_albums has to exist first.
await applySchemas(client, [
	{
		name: ALBUMS,
		display_name: 'Albums',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'description', field_type: 'text' }
		]
	},
	{
		name: PHOTOS,
		display_name: 'Photographs',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'caption', field_type: 'text' },
			// The media id, not a URL. An id survives a storage driver change,
			// a signing secret rotation and a bucket move. A URL survives none
			// of them, and on a local driver there is no URL to store anyway.
			{ name: 'media_id', field_type: 'text' },
			// Copied from the media record at upload time so a grid can reserve
			// the right space without one media request per tile.
			{ name: 'width', field_type: 'number' },
			{ name: 'height', field_type: 'number' },
			belongsTo('album', ALBUMS)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, PHOTOS, { limit: 25 })).length > 0) {
	console.log('photographs already seeded, nothing to do');
	process.exit(0);
}

interface PhotoSeed {
	segment: string;
	title: string;
	caption: string;
	width: number;
	height: number;
}

interface AlbumSeed {
	segment: string;
	title: string;
	description: string;
	tone: Rgb;
	photos: PhotoSeed[];
}

const albums: AlbumSeed[] = [
	{
		segment: 'rooftops-at-dusk',
		title: 'Rooftops at Dusk',
		description:
			'Six weeks of climbing fire escapes in the print district, mostly for the twenty minutes after the sun clears the chimney line.',
		tone: TONES.rooftops,
		photos: [
			{
				segment: 'copper-standpipe',
				title: 'Copper Standpipe',
				caption:
					'The standpipe on the old bindery has been painted over four times and the copper still shows through at the union.',
				width: 1600,
				height: 1000
			},
			{
				segment: 'water-tower-on-nineteenth',
				title: 'Water Tower on Nineteenth',
				caption:
					'Shot upward from the parapet because there is nowhere on that roof to stand far enough back.',
				width: 1200,
				height: 1600
			},
			{
				segment: 'parapet-and-antennae',
				title: 'Parapet and Antennae',
				caption: 'Nine aerials, three of them still connected to something.',
				width: 960,
				height: 540
			},
			{
				segment: 'tar-seam-at-golden-hour',
				title: 'Tar Seam at Golden Hour',
				caption:
					'A close frame of the roofing seam, kept small because the detail is in the texture and not the scale.',
				width: 480,
				height: 360
			}
		]
	},
	{
		segment: 'harbour-in-fog',
		title: 'Harbour in Fog',
		description:
			'The east quay on the four mornings in October when the fog held past ten and the cranes were the only thing with an edge.',
		tone: TONES.harbour,
		photos: [
			{
				segment: 'bollard-and-chain',
				title: 'Bollard and Chain',
				caption: 'Square frame, because the chain fell into it without being arranged.',
				width: 800,
				height: 800
			},
			{
				segment: 'crane-through-haze',
				title: 'Crane Through Haze',
				caption:
					'Exactly one thousand and twenty-four pixels on both sides, which turns out to matter to the resizer.',
				width: 1024,
				height: 1024
			},
			{
				segment: 'fog-signal-mast',
				title: 'Fog Signal Mast',
				caption: 'A contact-sheet crop, kept at the size a contact sheet prints.',
				width: 150,
				height: 150
			},
			{
				segment: 'gull-on-a-piling',
				title: 'Gull on a Piling',
				caption: 'Cropped to almost nothing and kept anyway.',
				width: 120,
				height: 90
			}
		]
	},
	{
		segment: 'calibration-frames',
		title: 'Calibration Frames',
		description:
			'Gray cards and focus charts. Nobody wants to look at these and every archive needs them.',
		tone: TONES.studio,
		photos: [
			{
				segment: 'gray-card-reference',
				title: 'Gray Card Reference',
				caption: 'Full sensor width, shot flat, used to set the white balance for both other sets.',
				width: 2048,
				height: 1365
			},
			{
				segment: 'focus-chart-sixteen',
				title: 'Focus Chart Sixteen',
				caption: 'The sixteenth chart in the box, and the only one that is still square.',
				width: 300,
				height: 300
			}
		]
	}
];

/**
 * Uploads one file into a folder.
 *
 * `folder` and `alt_text` are ordinary form values beside the file part, and
 * the response is an array even for a single file. The shared client's
 * `uploadMedia` covers the simple case and does not carry a folder, which is
 * the whole reason this app builds the form itself.
 */
async function upload(
	c: LyeveClient,
	bytes: Buffer,
	filename: string,
	folder: string,
	altText: string
): Promise<MediaRecord> {
	const form = new FormData();
	form.append('folder', folder);
	form.append('alt_text', altText);
	form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), filename);

	const rows = await c.request<MediaRecord[]>('admin', '/api/admin/media', {
		method: 'POST',
		body: form
	});
	const record = Array.isArray(rows) ? rows[0] : undefined;
	if (!record) throw new Error(`upload of ${filename} returned no record`);
	return record;
}

/** The media already in a folder, keyed by original filename. */
async function storedInFolder(c: LyeveClient, folder: string): Promise<Map<string, MediaRecord>> {
	const page = await c.request<{ data: MediaRecord[] }>(
		'admin',
		`/api/admin/media?folder=${encodeURIComponent(folder)}&limit=500`
	);
	const rows = Array.isArray(page?.data) ? page.data : [];
	return new Map(rows.map((row) => [row.filename, row]));
}

/**
 * The variants an upload produced.
 *
 * The upload response never carries them. Generation is inline and finishes
 * before the request returns, but the rows are written straight to
 * sys_media_thumbnails and never attached to the record the handler marshals,
 * so this is a second request per file.
 */
async function variantsOf(c: LyeveClient, id: string): Promise<Thumbnail[]> {
	const rows = await c.request<Thumbnail[]>('admin', `/api/admin/media/${id}/thumbnails`);
	return Array.isArray(rows) ? rows : [];
}

let uploaded = 0;
let reused = 0;
const report: string[] = [];

for (const album of albums) {
	const slug = albumSlug(album.segment);
	const existing = await getContentBySlug(client, ALBUMS, slug);
	const albumId =
		existing?.id ??
		(
			await createContent(client, {
				schema: ALBUMS,
				slug,
				title: album.title,
				body: { slug, description: album.description }
			})
		).id;

	const folder = albumFolder(album.segment);
	const stored = await storedInFolder(client, folder);

	for (const photo of album.photos) {
		const filename = `${photo.segment}.png`;
		const alreadyStored = stored.get(filename);
		if (alreadyStored) reused++;
		else uploaded++;

		// The right-hand side is evaluated only when the left is absent, so a
		// re-run neither draws the image again nor uploads it.
		const record: MediaRecord =
			alreadyStored ??
			(await upload(
				client,
				photoPng(photo.width, photo.height, album.tone, photo.segment),
				filename,
				folder,
				photo.title
			));

		const slugValue = photoSlug(photo.segment);
		await createContent(client, {
			schema: PHOTOS,
			slug: slugValue,
			title: photo.title,
			body: {
				slug: slugValue,
				caption: photo.caption,
				media_id: record.id,
				// The engine's own reading of the file, not what was requested.
				// They agree here. On a rotated JPEG they would not, because the
				// strip bakes the orientation in and swaps the two.
				width: record.width ?? photo.width,
				height: record.height ?? photo.height,
				album: albumId
			}
		});

		const variants = await variantsOf(client, record.id);
		const present = variants.map((v) => v.size);
		const skipped = PRESETS.filter(
			(p) => !present.includes(p.name) && presetSkipped(p, record.width ?? 0, record.height ?? 0)
		).map((p) => p.name);
		report.push(
			`  ${filename.padEnd(30)} ${`${record.width}x${record.height}`.padEnd(11)} ` +
				`variants: ${present.join(', ') || 'none'}` +
				(skipped.length ? `   skipped: ${skipped.join(', ')}` : '')
		);
	}
}

const photoCount = albums.reduce((n, a) => n + a.photos.length, 0);
console.log(
	`seeded ${albums.length} albums and ${photoCount} photographs ` +
		`(${uploaded} uploaded, ${reused} already in the store)`
);
console.log(report.join('\n'));
console.log(
	'\nA preset is skipped when the source already fits inside it in both dimensions, so\n' +
		'1024x1024 gets no large variant and 150x150 gets none at all. That is the processor\n' +
		'declining to upscale, not a failure.'
);
