/**
 * Step 6. Upload a file, and get the bytes back.
 *
 *   pnpm media
 *
 * Media is where the SDK stops helping and the reason is worth understanding.
 * @lyeve-labs/client-rest models no media route at all, and the client from
 * @lyeve-labs/client cannot carry the request even if it did: it sets
 * Content-Type: application/json on every call and runs JSON.stringify over
 * every body, so a multipart upload and a binary download both have to go
 * through fetch directly. The wrapper from lyeve.ts is still doing the work of
 * turning a path into a URL.
 *
 * Safe to run repeatedly. An upload with this filename is reused if it exists.
 */
import { getList } from '@lyeve-labs/client-rest';
import { ARTICLES, endpoints, heading, note, routedFetch, row, run, section, signIn, signedInClient } from './lyeve.ts';

interface MediaItem {
	id: string;
	key: string;
	filename: string;
	content_type: string;
	size: number;
	width?: number;
	height?: number;
	url?: string;
}

const FILENAME = 'headless-node-mark.png';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A 16x16 PNG, inlined so this example carries no binary asset. */
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAV0lEQVR42pXLqw0AIAwFQFbAIBFI8EzE' +
	'/ukIGMKnlPaRnD3nQ/zifIjUCrWScjUdATkjpFzBswJ4joAcHswjBP3IQTnP8DpaEI8R7mMHdqCwHzTM' +
	'M8KXDtRfmz393qk+AAAAAElFTkSuQmCC';

await run(async () => {
	heading('06  Media');

	const token = await signIn();
	const client = signedInClient(token);
	const call = routedFetch(endpoints());
	const bytes = new Uint8Array(Buffer.from(PNG_BASE64, 'base64'));

	section('What is already stored');
	// The media list answers the paginated envelope, {data, total_count, limit,
	// offset}, not a bare array. getList normalizes both shapes, which matters
	// because reading .length off the envelope gives undefined rather than an
	// error and the page renders empty with nothing to debug.
	const stored = await getList<MediaItem>(client, '/api/admin/media');
	row('items', stored.length);

	let item = stored.find((m) => m.filename === FILENAME);

	if (item) {
		section('Reusing the upload from an earlier run');
	} else {
		section('Uploading');
		const form = new FormData();
		// The field name is file. The engine reads every file part in the form,
		// so one request can carry several.
		form.append('file', new Blob([bytes], { type: 'image/png' }), FILENAME);

		const res = await call('/api/admin/media', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` },
			body: form
		});
		if (!res.ok) throw new Error(`upload failed with HTTP ${res.status}: ${await res.text()}`);

		// The response is an array even for a single file.
		const uploaded = (await res.json()) as MediaItem[];
		item = uploaded[0];
		if (!item) throw new Error('the upload returned no record');
	}

	row('id', item.id);
	row('filename', item.filename);
	row('content_type', item.content_type);
	row('size', `${item.size} bytes`);
	row('dimensions', item.width && item.height ? `${item.width}x${item.height}` : '(not reported)');
	row('key', item.key);
	row('url', item.url || '(none: the local storage driver signs no URL)');
	note('The declared content type is not trusted. The engine sniffs the leading bytes and stores what it detected.');

	section('Fetching the bytes back');
	const download = await call(`/api/admin/media/${item.id}/download`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	const returned = new Uint8Array(await download.arrayBuffer());
	const isPng = PNG_SIGNATURE.every((b, i) => returned[i] === b);
	row('status', download.status);
	row('content-type', download.headers.get('content-type') ?? '(none)');
	row('bytes sent', bytes.length);
	row('bytes returned', returned.length);
	row('still a PNG', isPng);
	row('byte for byte identical', returned.length === bytes.length && returned.every((b, i) => b === bytes[i]));
	note('The store is not a blob store. An image it can decode is re-encoded on upload to strip EXIF, so what');
	note('comes back is the same picture and a different file. The dimensions and the type survive. A checksum');
	note('of your upload does not, so do not use one to decide whether the stored copy is current.');

	section('The same request without a token');
	const { adminUrl } = endpoints();
	const anonymous = await fetch(`${adminUrl}/api/admin/media/${item.id}/download`);
	row('status', anonymous.status);
	note('That is why an img tag pointed at the engine is a broken image, and why every app in this repo');
	note('serves media from a route of its own: the browser asks the app, and the app asks the engine.');

	section('Storing the reference');
	note('Store the media id on the entry, never a URL. The id survives a storage driver change and a URL does not.');
	note(`This example declares cover_media_id on ${ARTICLES} for exactly that.`);
});
