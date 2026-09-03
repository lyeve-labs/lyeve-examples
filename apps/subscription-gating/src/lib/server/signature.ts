import { equalDigest, hmacHex } from './digest';

/**
 * How far the signature timestamp may be from now. The timestamp is inside the
 * signed material, so it cannot be edited without breaking the digest, and
 * bounding it is what stops a captured request from being replayable forever.
 */
const TOLERANCE_SECONDS = 300;

export type SignatureResult = 'ok' | 'malformed' | 'stale' | 'mismatch';

/**
 * Verifies an inbound webhook the way a payment provider signs one.
 *
 * The header is `t=<unix seconds>,v1=<hex>` and the digest is HMAC-SHA256 over
 * `<timestamp>.<raw body>`, the scheme Stripe-style providers use. The engine
 * keeps no subscriber records of its own, so the application verifies it.
 *
 * The outcome is returned rather than thrown, and the caller puts it in the
 * response, because a clock that has drifted and a key that is wrong need
 * different fixes and the sender is the only party who can apply either. It
 * discloses nothing: the timestamp came from the sender in the first place.
 */
export function verifySignature(
	header: string | null,
	rawBody: string,
	secret: string,
	nowMs: number = Date.now()
): SignatureResult {
	if (!header) return 'malformed';

	const parts = new Map<string, string>();
	for (const pair of header.split(',')) {
		const cut = pair.indexOf('=');
		if (cut > 0) parts.set(pair.slice(0, cut).trim(), pair.slice(cut + 1).trim());
	}

	const timestamp = parts.get('t');
	const digest = parts.get('v1');
	if (!timestamp || !digest || !/^\d+$/.test(timestamp)) return 'malformed';

	if (Math.abs(nowMs / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return 'stale';

	return equalDigest(digest, hmacHex(secret, `${timestamp}.${rawBody}`)) ? 'ok' : 'mismatch';
}
