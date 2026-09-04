import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const HEX = /^[0-9a-f]+$/i;

/**
 * The three algorithms the engine's own verifier accepts. It resolves the
 * algorithm from the signature prefix first, then from the algorithm header,
 * and defaults to sha256, so a receiver has to do the same or it will reject a
 * sender that switched.
 */
export const ALGORITHMS = ['sha256', 'sha384', 'sha512'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

export function isAlgorithm(value: string): value is Algorithm {
	return (ALGORITHMS as readonly string[]).includes(value);
}

/** Node names these the same way the engine does, so the string passes through. */
export function hmacHex(algorithm: Algorithm, secret: string, message: string): string {
	return createHmac(algorithm, secret).update(message, 'utf8').digest('hex');
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

/** A signing key long enough for the create route, which refuses under sixteen. */
export function newSecret(): string {
	return randomBytes(24).toString('hex');
}

export function newNonce(): string {
	return randomUUID();
}
