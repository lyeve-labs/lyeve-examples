import type { Verdict } from '$lib/contract';
import { equalDigest, hmacHex, isAlgorithm, type Algorithm } from './digest';
import { claim } from './replay';

/**
 * The signing scheme the engine's webhook plugin uses, reimplemented here.
 *
 * The same scheme covers the dispatcher that sends, the engine's own inbound
 * verifier and the background retry. The whole scheme:
 *
 *   X-Webhook-Signature   <algo>=<hex>, algo in sha256 | sha384 | sha512
 *   X-Webhook-Algorithm   sha256, used only when the value carries no prefix
 *   X-Webhook-Timestamp   unix seconds
 *   X-Webhook-Nonce       a UUID, single use
 *   X-Webhook-Event       after_create | after_update | after_delete | test | retry
 *   X-Webhook-Schema      the content type the event came from
 *
 * and the signed string is
 *
 *   HMAC(secret, "<timestamp>.<nonce>.<raw request body>")
 *
 * with the secret used as raw bytes, never hex-decoded, and the body signed
 * exactly as it arrived. Header names are case-insensitive, and the wire
 * carries the form above.
 *
 * Two senders inside the engine do not follow it, which is why this file has
 * two modes rather than one. The README says what that costs.
 */

const PAST_TOLERANCE_SECONDS = 300;
const FUTURE_TOLERANCE_SECONDS = 30;

export type SignatureMode = 'replay-protected' | 'body-only' | 'none';

export interface Verification {
	verdict: Verdict;
	mode: SignatureMode;
	algorithm: Algorithm | null;
	timestamp: number | null;
	nonce: string | null;
	/** 0 when the active key matched, higher for a key kept through a rotation. */
	keyIndex: number | null;
	detail: string;
}

interface Parsed {
	algorithm: Algorithm;
	digest: string;
}

/**
 * Splits a signature value the way the engine does.
 *
 * The prefix wins over the algorithm header, and a value with no prefix falls
 * back to that header, then to sha256. Getting this order wrong is a silent
 * failure: every signature verifies as sha256 and a sender that moved to
 * sha512 is rejected with no clue why.
 */
function parseSignature(value: string, algorithmHeader: string): Parsed | 'malformed' | 'unknown' {
	for (const algorithm of ['sha512', 'sha384', 'sha256'] as const) {
		if (value.startsWith(`${algorithm}=`)) {
			return { algorithm, digest: value.slice(algorithm.length + 1) };
		}
	}
	if (value.includes('=')) return 'malformed';
	const named = algorithmHeader.trim().toLowerCase();
	if (named === '') return { algorithm: 'sha256', digest: value };
	if (!isAlgorithm(named)) return 'unknown';
	return { algorithm: named, digest: value };
}

function withinWindow(unixSeconds: number, nowMs: number): boolean {
	const skew = nowMs / 1000 - unixSeconds;
	if (skew < 0) return -skew <= FUTURE_TOLERANCE_SECONDS;
	return skew <= PAST_TOLERANCE_SECONDS;
}

/** The RFC 3339 timestamp inside a payload, when it has one. */
function payloadTimestamp(rawBody: string): number | null {
	try {
		const parsed: unknown = JSON.parse(rawBody);
		if (!parsed || typeof parsed !== 'object') return null;
		const value = (parsed as { timestamp?: unknown }).timestamp;
		if (typeof value !== 'string') return null;
		const at = Date.parse(value);
		return Number.isNaN(at) ? null : Math.floor(at / 1000);
	} catch {
		return null;
	}
}

/**
 * Verifies one delivery.
 *
 * `secrets` is every key the receiver still accepts, newest first, so a
 * rotation does not reject the deliveries already in flight when it happened.
 * The result is returned rather than thrown: a rejection is recorded, and the
 * reason is the only thing that tells an operator whether the clock, the key or
 * the sender is at fault.
 */
export function verifyDelivery(
	headers: Headers,
	rawBody: string,
	secrets: string[],
	nowMs: number = Date.now()
): Verification {
	const signature = (
		headers.get('x-webhook-signature') ??
		headers.get('x-hub-signature-256') ??
		''
	).trim();
	const timestampHeader = (headers.get('x-webhook-timestamp') ?? '').trim();
	const nonce = (headers.get('x-webhook-nonce') ?? '').trim();
	const mode: SignatureMode =
		signature === '' ? 'none' : timestampHeader !== '' && nonce !== '' ? 'replay-protected' : 'body-only';

	const base: Verification = {
		verdict: 'accepted',
		mode,
		algorithm: null,
		timestamp: null,
		nonce: nonce || null,
		keyIndex: null,
		detail: ''
	};

	if (signature === '') {
		return {
			...base,
			verdict: 'missing-signature',
			detail: 'No X-Webhook-Signature header. A webhook with no secret set is unauthenticated, and a delivery this app cannot attribute is not recorded as one.'
		};
	}

	const parsed = parseSignature(signature, headers.get('x-webhook-algorithm') ?? '');
	if (parsed === 'malformed') {
		return { ...base, verdict: 'malformed-signature', detail: 'Signature value is not <algorithm>=<hex>.' };
	}
	if (parsed === 'unknown') {
		return {
			...base,
			verdict: 'unknown-algorithm',
			detail: 'X-Webhook-Algorithm named an algorithm outside sha256, sha384 and sha512.'
		};
	}

	if (mode === 'replay-protected' && !/^\d+$/.test(timestampHeader)) {
		return {
			...base,
			algorithm: parsed.algorithm,
			verdict: 'malformed-signature',
			detail: 'X-Webhook-Timestamp is not an integer number of seconds.'
		};
	}

	const preimage =
		mode === 'replay-protected' ? `${timestampHeader}.${nonce}.${rawBody}` : rawBody;

	let keyIndex: number | null = null;
	for (let i = 0; i < secrets.length; i++) {
		if (equalDigest(parsed.digest, hmacHex(parsed.algorithm, secrets[i], preimage))) {
			keyIndex = i;
			break;
		}
	}
	if (keyIndex === null) {
		return {
			...base,
			algorithm: parsed.algorithm,
			verdict: 'signature-mismatch',
			detail:
				mode === 'replay-protected'
					? 'HMAC over "<timestamp>.<nonce>.<body>" did not match any key this receiver holds.'
					: 'HMAC over the body alone did not match any key this receiver holds.'
		};
	}

	// A signature with no timestamp header is replayable for as long as the key
	// lives, so the freshness bound comes from the payload's own timestamp,
	// which is inside the bytes the signature covers.
	const timestamp =
		mode === 'replay-protected' ? Number(timestampHeader) : payloadTimestamp(rawBody);

	if (timestamp === null) {
		return {
			...base,
			algorithm: parsed.algorithm,
			keyIndex,
			verdict: 'stale-timestamp',
			detail: 'Signed over the body alone and the body carries no timestamp, so nothing bounds how long this request stays valid.'
		};
	}
	if (!withinWindow(timestamp, nowMs)) {
		return {
			...base,
			algorithm: parsed.algorithm,
			timestamp,
			keyIndex,
			verdict: 'stale-timestamp',
			detail: `Timestamp is outside the window of ${PAST_TOLERANCE_SECONDS}s behind and ${FUTURE_TOLERANCE_SECONDS}s ahead.`
		};
	}

	// The nonce is the replay token when there is one. Without it the digest
	// stands in: two deliveries of the same event carry different timestamps
	// inside the body, so an identical digest is the same request twice.
	const token = mode === 'replay-protected' ? `nonce:${nonce}` : `digest:${parsed.digest}`;
	if (!claim(token)) {
		return {
			...base,
			algorithm: parsed.algorithm,
			timestamp,
			keyIndex,
			verdict: 'replayed',
			detail: 'This exact request has already been accepted once.'
		};
	}

	return {
		...base,
		verdict: mode === 'replay-protected' ? 'accepted' : 'accepted-body-only',
		algorithm: parsed.algorithm,
		timestamp,
		keyIndex,
		detail:
			mode === 'replay-protected'
				? `Verified ${parsed.algorithm} over "<timestamp>.<nonce>.<body>".`
				: `Verified ${parsed.algorithm} over the body alone; this sender sent no timestamp or nonce headers.`
	};
}

export interface SignedHeaders {
	timestamp: string;
	nonce: string;
	signature: string;
	headers: Record<string, string>;
}

/**
 * Signs a request the way the engine expects to receive one.
 *
 * Used for the inbound direction, where this app plays the vendor and the
 * engine is the verifier. `timestamp` and `nonce` are arguments rather than
 * generated here so the inbound page can send a stale one and a replayed one on
 * purpose.
 */
export function signRequest(
	secret: string,
	body: string,
	timestamp: number,
	nonce: string,
	algorithm: Algorithm = 'sha256'
): SignedHeaders {
	const signature = `${algorithm}=${hmacHex(algorithm, secret, `${timestamp}.${nonce}.${body}`)}`;
	return {
		timestamp: String(timestamp),
		nonce,
		signature,
		headers: {
			'content-type': 'application/json',
			'x-webhook-timestamp': String(timestamp),
			'x-webhook-nonce': nonce,
			'x-webhook-algorithm': algorithm,
			'x-webhook-signature': signature
		}
	};
}
