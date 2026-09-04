/**
 * The media plugin, as it actually answers.
 *
 * The shared client covers the three routes the other examples need. This app
 * is about the pipeline itself, so it talks to the whole surface and models the
 * response shapes the plugin really returns, which are not the shapes the rest
 * of the engine returns.
 */
import { LyeveError } from '$lib/lyeve';
import { PRESETS, presetSkipped, type PresetName } from '$lib/naming';
import { lyeve } from './lyeve';

export { PRESETS, type PresetName };

/**
 * Every field a media record carries, from the plugin's own struct.
 *
 * Two absences matter more than anything present. There is no usable `url` on a
 * local driver, and it cannot be configured into existence: the driver reads
 * `storage_local_signing_secret` through Config.String, which redacts every key
 * ending in `_secret` to the empty string, so it never receives a signing key
 * and `omitempty` drops the field. And `updated_at` is always the zero time,
 * because `sys_media` has no such column and the JSON field is marshaled from
 * a struct member nothing ever sets.
 */
export interface MediaRecord {
	id: string;
	key: string;
	filename: string;
	content_type: string;
	size: number;
	folder: string;
	tenant_id: string;
	alt_text?: string;
	width?: number;
	height?: number;
	uploaded_by?: string;
	scan_status?: string;
	scan_result?: string;
	thumbnail_key?: string;
	metadata?: MediaMetadata;
	tags?: string[];
	created_at: string;
	updated_at: string;
	url?: string;
	thumbnails?: MediaThumbnail[];
}

/** The extracted document. Every key is omitted when the value is zero. */
export interface MediaMetadata {
	width?: number;
	height?: number;
	color_space?: string;
	color_depth?: number;
	has_alpha?: boolean;
	make?: string;
	model?: string;
	lens?: string;
	f_number?: number;
	aperture?: string;
	exposure_time?: string;
	iso_speed?: number;
	focal_length?: string;
	datetime_original?: string;
	orientation?: number;
	flash?: boolean;
	gps_latitude?: number;
	gps_longitude?: number;
	software?: string;
	copyright?: string;
	artist?: string;
	description?: string;
	iptc_keywords?: string[];
	iptc_caption?: string;
	iptc_city?: string;
	iptc_country?: string;
	xmp_title?: string;
	xmp_creator?: string;
	duration?: number;
	video_codec?: string;
	icc_profile?: string;
}

export interface MediaThumbnail {
	id: string;
	media_id: string;
	tenant_id: string;
	key: string;
	format: string;
	width: number;
	height: number;
	/** The preset name, not a byte count. The byte count is `byte_size`. */
	size: string;
	byte_size: number;
	created_at: string;
	/** Empty on every local-driver install. See `variantBytesReachable`. */
	url?: string;
}

/** `GET /api/admin/media` answers an envelope, not the bare array a v1 content list answers with. */
interface MediaPage {
	data: MediaRecord[];
	total_count: number;
	limit: number;
	offset: number;
}

export interface MediaListing {
	items: MediaRecord[];
	total: number;
	limit: number;
	offset: number;
}

/**
 * Lists media, optionally narrowed to one folder.
 *
 * `limit` defaults to 50 and is clamped to 500, which is the engine's page
 * limit rather than the 25..200 clamp the content routes apply. The two are
 * unrelated and neither is documented in the other's terms.
 */
export async function listMediaPage(
	opts: { folder?: string; limit?: number; offset?: number } = {}
): Promise<MediaListing> {
	const q = new URLSearchParams();
	if (opts.folder) q.set('folder', opts.folder);
	if (opts.limit) q.set('limit', String(opts.limit));
	if (opts.offset) q.set('offset', String(opts.offset));

	const page = await lyeve.request<MediaPage>('admin', `/api/admin/media?${q.toString()}`);
	return {
		items: page?.data ?? [],
		total: page?.total_count ?? 0,
		limit: page?.limit ?? 0,
		offset: page?.offset ?? 0
	};
}

/** One record, with its variants attached. Null for an id the tenant cannot see. */
export async function getMediaRecord(id: string): Promise<MediaRecord | null> {
	try {
		return await lyeve.request<MediaRecord>('admin', `/api/admin/media/${id}`);
	} catch (err) {
		if (err instanceof LyeveError && (err.status === 404 || err.status === 400)) return null;
		throw err;
	}
}

/**
 * The variants for one record.
 *
 * `GET /api/admin/media/{id}` already attaches these, so this route is only
 * worth a separate call when the record itself is not needed. It differs in one
 * way: it adds a `url` key, which is the empty string on a local install.
 */
export async function getMediaThumbnails(id: string): Promise<MediaThumbnail[]> {
	try {
		const rows = await lyeve.request<MediaThumbnail[]>(
			'admin',
			`/api/admin/media/${id}/thumbnails`
		);
		return Array.isArray(rows) ? rows : [];
	} catch (err) {
		if (err instanceof LyeveError && (err.status === 404 || err.status === 400)) return [];
		throw err;
	}
}

export interface MediaSearchFilter {
	query?: string;
	folder?: string;
	kind?: 'image' | 'video' | 'audio' | 'document' | 'other';
	content_types?: string[];
	min_size?: number;
	max_size?: number;
	min_width?: number;
	min_height?: number;
	max_width?: number;
	max_height?: number;
	tags?: string[];
	scan_status?: string;
	limit?: number;
	offset?: number;
	sort_by?: 'created_at' | 'size' | 'filename' | 'width' | 'height' | 'duration';
	sort_desc?: boolean;
}

/**
 * `POST /api/admin/media/search`, which is a different search from
 * `GET /api/admin/search`.
 *
 * The content search reads `sys_content_entries` and knows nothing about files.
 * This one reads `sys_media` and is the only way to ask a question about a
 * dimension, a size range, a tag or a camera. It answers `{items, total}`,
 * sorts ascending unless told otherwise, and its rows omit the variants.
 *
 * Its limit does not clamp. A value above 200 is discarded and replaced by the
 * default of 50, so asking for 500 returns 50 and nothing says why. Every
 * condition is ANDed, so a question spanning two fields with OR is two requests
 * and a union taken by the caller.
 */
export async function searchMedia(
	filter: MediaSearchFilter
): Promise<{ items: MediaRecord[]; total: number }> {
	const res = await lyeve.request<{ items: MediaRecord[]; total: number }>(
		'admin',
		'/api/admin/media/search',
		{ method: 'POST', body: JSON.stringify(filter) }
	);
	return { items: res?.items ?? [], total: res?.total ?? 0 };
}

/** Streams the original bytes. The engine 401s a browser, so this is called server-side only. */
export function mediaDownload(id: string): Promise<Response> {
	return lyeve.raw('admin', `/api/admin/media/${id}/download`);
}

export interface UploadResult {
	records: MediaRecord[];
	error?: string;
	status?: number;
}

/**
 * Uploads several files in one request.
 *
 * The handler walks every file part in the form, so one request carries a
 * batch, and `folder` and `alt_text` are read once and applied to all of them.
 * The batch is atomic in the direction that costs you: the first file the
 * pipeline rejects rolls back everything already stored in the same request
 * and the response is a single 422. There is no per-file result.
 */
export async function uploadFiles(
	files: File[],
	opts: { folder?: string; altText?: string } = {}
): Promise<UploadResult> {
	const form = new FormData();
	if (opts.folder) form.append('folder', opts.folder);
	if (opts.altText) form.append('alt_text', opts.altText);
	for (const file of files) form.append('file', file, file.name);

	try {
		const rows = await lyeve.request<MediaRecord[]>('admin', '/api/admin/media', {
			method: 'POST',
			body: form
		});
		return { records: Array.isArray(rows) ? rows : [] };
	} catch (err) {
		if (err instanceof LyeveError) return { records: [], error: err.message, status: err.status };
		throw err;
	}
}

export interface VariantState {
	preset: PresetName;
	/** The box the source is fitted inside, not the variant's own dimensions. */
	boxWidth: number;
	boxHeight: number;
	present: boolean;
	thumbnail?: MediaThumbnail;
	/** Why a missing variant is missing, in the terms the processor decided it. */
	reason: string;
	/** Whether an HTTP request can retrieve the variant's bytes at all. */
	reachable: boolean;
}

/**
 * Explains, per preset, what the processor did and why.
 *
 * The rule people trip over is the skip: `generateOne` returns nothing when the
 * source is no larger than the preset in BOTH dimensions, so a 1024x1024 upload
 * gets no `large` variant and a 150x150 upload gets none at all. That is
 * correct. Upscaling a photograph produces a bigger file that carries no more
 * detail, and the absent record is the processor declining to pretend
 * otherwise. It reads as a bug because nothing in the response says a preset
 * was considered and rejected: an absent variant and a failed variant look
 * identical from outside.
 */
export function variantStates(record: MediaRecord, thumbs: MediaThumbnail[]): VariantState[] {
	const isImage = record.content_type.startsWith('image/');
	const srcW = record.width ?? 0;
	const srcH = record.height ?? 0;

	return PRESETS.map((preset) => {
		const thumbnail = thumbs.find((t) => t.size === preset.name);
		if (thumbnail) {
			return {
				preset: preset.name,
				boxWidth: preset.width,
				boxHeight: preset.height,
				present: true,
				thumbnail,
				reason: `Fitted inside ${preset.width}x${preset.height} as ${thumbnail.width}x${thumbnail.height} ${thumbnail.format}.`,
				reachable: variantBytesReachable(thumbnail)
			};
		}

		let reason: string;
		if (!isImage) {
			reason = `Not an image. The processor only runs on content types beginning image/, and this record is ${record.content_type}.`;
		} else if (srcW === 0 || srcH === 0) {
			reason =
				'The source dimensions were never recorded, so the decoder could not read this file. Nothing was resized.';
		} else if (presetSkipped(preset, srcW, srcH)) {
			reason = `Skipped by design. The source is ${srcW}x${srcH}, which already fits inside ${preset.width}x${preset.height} in both dimensions, so resizing would only enlarge the file.`;
		} else {
			reason = `Expected but absent. The source is ${srcW}x${srcH}, large enough for this preset, so either the encode failed or thumbnail generation was switched off when the file was uploaded.`;
		}

		return {
			preset: preset.name,
			boxWidth: preset.width,
			boxHeight: preset.height,
			present: false,
			reason,
			reachable: false
		};
	});
}

/**
 * Whether the variant's bytes can be fetched over HTTP.
 *
 * The plugin declares nine routes and none of them serves a variant. The
 * original has `/api/admin/media/{id}/download`. A variant has a storage key
 * and a record, and the only door to its bytes is the `url` the storage driver
 * signs. The local driver never gets a signing key, because the config layer
 * redacts the only setting that would supply one, so on a local install a
 * variant exists on disk, is described accurately by the API, and cannot be
 * served. An S3 or CDN driver signs URLs and this answers true.
 */
export function variantBytesReachable(thumbnail: MediaThumbnail): boolean {
	const url = thumbnail.url ?? '';
	return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * What `scan_status` means, rather than what it looks like.
 *
 * `pending` does not mean queued. Nothing in the plugin ever revisits a record,
 * so the value a row is created with is the value it keeps until someone calls
 * reprocess, and reprocess does not rescan. On a deployment with scanning off
 * the scanner returns `pending` with the message "virus scanning disabled" and
 * the upload succeeds. That is the honest answer to a question nobody asked,
 * and it must be read as unscanned rather than as in progress.
 */
export function scanExplanation(status: string | undefined, result: string | undefined): string {
	switch (status) {
		case 'clean':
			return 'ClamAV inspected the bytes and found nothing. This is the only status that is evidence of anything.';
		case 'infected':
			return 'A signature matched. An infected upload is rejected outright, so a stored record should never carry this.';
		case 'unscannable':
			return 'Scanning was switched on and clamd could not be reached. The upload was accepted anyway. Treat it as unscanned.';
		case 'error':
			return 'The scan started and failed. The upload was accepted anyway. Treat it as unscanned.';
		case 'pending':
			return result === 'virus scanning disabled'
				? 'Not queued. Scanning is off on this deployment, so no scan was attempted and none ever will be. Treat it as unscanned.'
				: 'No scan result was recorded. Nothing revisits a media row, so this will not change on its own. Treat it as unscanned.';
		case 'unscanned':
			return 'Recorded as deliberately not scanned.';
		default:
			return 'No scan status was recorded at all.';
	}
}

/** True when the record carries no evidence that anything looked at the bytes. */
export function isUnverified(status: string | undefined): boolean {
	return status !== 'clean';
}
