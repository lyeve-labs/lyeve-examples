import { createHmac, timingSafeEqual } from 'node:crypto';

const HEX = /^[0-9a-f]+$/i;

export function hmacHex(secret: string, message: string): string {
	return createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Compares two hex digests without leaking where they first differ.
 *
 * The length and the alphabet are checked first for a practical reason:
 * `Buffer.from(value, 'hex')` stops at the first pair it cannot parse instead
 * of throwing, so a malformed value would arrive at timingSafeEqual as a
 * shorter buffer and be rejected by an exception rather than by a comparison.
 */
export function equalDigest(a: string, b: string): boolean {
	if (a.length !== b.length || !HEX.test(a) || !HEX.test(b)) return false;
	return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
