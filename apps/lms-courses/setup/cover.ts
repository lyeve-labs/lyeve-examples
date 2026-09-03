/**
 * Encodes a course cover as a PNG.
 *
 * The example is about media-heavy pages, so the seed needs real image bytes.
 * The repository carries no binary assets, and the engine's upload path sniffs
 * the content type and runs the file through image processing, so a stub of
 * bytes labeled image/png is rejected. Generating a valid file is the smallest
 * honest way to get one.
 */
import { deflateSync } from 'node:zlib';

export type Rgb = [number, number, number];

const CRC_TABLE = buildCrcTable();

export function coverPng(width: number, height: number, from: Rgb, to: Rgb): Buffer {
	const stride = width * 3 + 1;
	const raw = Buffer.alloc(stride * height);

	for (let y = 0; y < height; y++) {
		const rowStart = y * stride;
		raw[rowStart] = 0; // filter type 0 (None) for every scanline
		for (let x = 0; x < width; x++) {
			const t = blend(x / width, y / height);
			const p = rowStart + 1 + x * 3;
			raw[p] = mix(from[0], to[0], t);
			raw[p + 1] = mix(from[1], to[1], t);
			raw[p + 2] = mix(from[2], to[2], t);
		}
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr(width, height)),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/** A diagonal ramp with a faint stripe, so covers read as artwork rather than a flat fill. */
function blend(u: number, v: number): number {
	const diagonal = (u + v) / 2;
	const stripe = Math.sin((u - v) * 14) * 0.04;
	return Math.min(1, Math.max(0, diagonal + stripe));
}

function mix(a: number, b: number, t: number): number {
	return Math.round(a + (b - a) * t) & 0xff;
}

function ihdr(width: number, height: number): Buffer {
	const data = Buffer.alloc(13);
	data.writeUInt32BE(width, 0);
	data.writeUInt32BE(height, 4);
	data[8] = 8; // bit depth
	data[9] = 2; // color type: truecolour RGB
	return data;
}

function chunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function crc32(buf: Buffer): number {
	let c = -1;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

function buildCrcTable(): Int32Array {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}
	return table;
}
