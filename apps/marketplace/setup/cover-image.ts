/**
 * Draws the cover images the seed uploads.
 *
 * The repo carries no binary assets, so the covers are generated rather than
 * checked in. What the example is showing is the upload and the proxy route in
 * front of it, not the photograph. They are PNG because the media plugin
 * refuses an SVG upload outright, whatever the file is called.
 */
import { crc32, deflateSync } from 'node:zlib';

const WIDTH = 480;
const HEIGHT = 360;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type Rgb = { r: number; g: number; b: number };

/** A category color, so a grid of products reads as a grid of departments. */
export const PALETTE: Record<string, Rgb> = {
	'bags-and-carry': { r: 96, g: 102, b: 66 },
	ceramics: { r: 158, g: 108, b: 86 },
	coffee: { r: 88, g: 60, b: 46 },
	stationery: { r: 70, g: 82, b: 128 },
	'home-and-kitchen': { r: 64, g: 104, b: 104 }
};

export function coverPng(color: Rgb, seed: string): Buffer {
	const offset = hash(seed) % 360;
	const pixels = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));

	let p = 0;
	for (let y = 0; y < HEIGHT; y++) {
		pixels[p++] = 0; // filter type 0: no per-scanline prediction
		for (let x = 0; x < WIDTH; x++) {
			// Quantized diagonal bands rather than a smooth gradient. Flat runs
			// of one color cost a few kilobytes. A gradient costs sixty.
			const wave = Math.sin((x * 0.9 + y * 1.7 + offset) * 0.014);
			const band = Math.round((0.7 + 0.3 * wave) * 5) / 5;
			const depth = 0.86 + 0.24 * (1 - y / HEIGHT);
			pixels[p++] = channel(color.r * band * depth);
			pixels[p++] = channel(color.g * band * depth);
			pixels[p++] = channel(color.b * band * depth);
		}
	}

	const header = Buffer.alloc(13);
	header.writeUInt32BE(WIDTH, 0);
	header.writeUInt32BE(HEIGHT, 4);
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
