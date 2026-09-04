/**
 * Draws the photographs the seed uploads.
 *
 * The repository carries no binary assets, so the images are generated. They
 * have to be real PNGs and not a hand-rolled stub: the engine decodes every
 * upload with Go's image package to read its dimensions, strip EXIF and resize
 * it, and a file with a plausible header and a broken deflate stream is stored
 * as an opaque blob with no dimensions and no variants at all. That failure is
 * silent, because the processor logs the decode error at warning level and
 * returns success.
 *
 * The dimensions are the point of the seed. The processor skips a preset whose
 * box already contains the source in both dimensions, so a set of images has to
 * straddle 150, 480 and 1024 for the skipping to be visible.
 *
 * They are PNG because the media plugin refuses an SVG upload outright,
 * whatever the file is called.
 */
import { crc32, deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export interface Rgb {
	r: number;
	g: number;
	b: number;
}

/** A tone per album, so a grid reads as a set rather than as test output. */
export const TONES: Record<string, Rgb> = {
	rooftops: { r: 176, g: 106, b: 74 },
	harbour: { r: 82, g: 106, b: 122 },
	studio: { r: 108, g: 112, b: 104 }
};

/**
 * A PNG of the given size: 8-bit truecolour, no alpha, no interlace.
 *
 * The pattern is quantized into flat bands rather than drawn as a smooth
 * gradient. A gradient at 2048 pixels wide deflates to megabytes. Bands of one
 * color deflate to tens of kilobytes, and the engine buffers the whole upload
 * in memory twice.
 */
export function photoPng(width: number, height: number, tone: Rgb, seed: string): Buffer {
	const offset = hash(seed) % 512;
	const pixels = Buffer.alloc(height * (1 + width * 3));

	let p = 0;
	for (let y = 0; y < height; y++) {
		pixels[p++] = 0; // filter type 0: no per-scanline prediction
		for (let x = 0; x < width; x++) {
			const u = x / width;
			const v = y / height;
			const wave = Math.sin((u * 5.5 + v * 2.2) * Math.PI + offset * 0.017);
			const band = Math.round((0.68 + 0.32 * wave) * 6) / 6;
			// A darker top edge reads as sky and stops the frames looking flat.
			const depth = 0.7 + 0.3 * v;
			pixels[p++] = channel(tone.r * band * depth + 22);
			pixels[p++] = channel(tone.g * band * depth + 18);
			pixels[p++] = channel(tone.b * band * depth + 26);
		}
	}

	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8; // bit depth
	header[9] = 2; // color type: truecolour
	// bytes 10-12 stay zero: deflate, adaptive filtering, no interlace

	return Buffer.concat([
		PNG_SIGNATURE,
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(pixels, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

function chunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(crc32(body) >>> 0, 0);
	return Buffer.concat([length, body, checksum]);
}

function channel(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function hash(value: string): number {
	let h = 2166136261;
	for (let i = 0; i < value.length; i++) {
		h = Math.imul(h ^ value.charCodeAt(i), 16777619);
	}
	return Math.abs(h);
}
