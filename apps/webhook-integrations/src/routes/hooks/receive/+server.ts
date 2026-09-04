import { json } from '@sveltejs/kit';
import { CHANNEL_HEADER, ORDERS, RECEIPTS, type Verdict, asChannel } from '$lib/contract';
import { recordReceipt, type NewReceipt } from '$lib/server/receipts';
import { acceptedSecrets } from '$lib/server/secrets';
import { verifyDelivery } from '$lib/server/signature';
import type { RequestHandler } from './$types';

/**
 * The receiver.
 *
 * The engine posts here. Nothing about the request is trusted before the
 * signature verifies, and every outcome is written down: an accepted delivery
 * and a rejected one are both facts an operator needs, and a rejection that
 * leaves no trace is how a wrong key survives a week.
 *
 * Send it as `application/json`, which is what the engine does. SvelteKit
 * refuses a cross-origin POST carrying a form content type, and a webhook is
 * cross-origin by definition, so a sender configured to post a form would be
 * rejected with a 403 before this handler ran.
 */
export const POST: RequestHandler = async ({ request }) => {
	// Read the exact bytes. Parsing to JSON and re-encoding changes key order
	// and whitespace, and the digest stops matching.
	const raw = await request.text();

	const channel = asChannel(header(request, CHANNEL_HEADER));
	const eventHeader = header(request, 'x-webhook-event');
	const schemaHeader = header(request, 'x-webhook-schema');

	const check = verifyDelivery(request.headers, raw, acceptedSecrets());
	const common = {
		channel,
		algorithm: check.algorithm,
		mode: check.mode,
		nonce: check.nonce,
		keyIndex: check.keyIndex,
		payload: raw
	};

	if (check.verdict !== 'accepted' && check.verdict !== 'accepted-body-only') {
		const status = statusFor(check.verdict);
		await record({
			...common,
			event: eventHeader || 'unknown',
			sourceSchema: schemaHeader || 'unknown',
			verdict: check.verdict,
			httpStatus: status,
			detail: check.detail
		});
		return json({ error: check.verdict, detail: check.detail }, { status });
	}

	let payload: DeliveryPayload;
	try {
		payload = JSON.parse(raw) as DeliveryPayload;
	} catch {
		await record({
			...common,
			event: eventHeader || 'unknown',
			sourceSchema: schemaHeader || 'unknown',
			verdict: 'invalid-json',
			httpStatus: 400,
			detail: 'Signature verified and the body was not JSON.'
		});
		return json({ error: 'invalid-json' }, { status: 400 });
	}

	const event = payload.event || eventHeader || 'unknown';
	const schema = payload.schema || schemaHeader || 'unknown';

	// The loop guard, and the reason every registration names its schemas. A
	// webhook with an empty `schemas` array matches every content type, so the
	// receipt written below would come back here and write another one. The
	// schema filter stops that at the engine. This stops it here too, because
	// one of the two is configuration and the other is code.
	if (schema === RECEIPTS) {
		return json({ status: 'ignored', reason: 'a receipt is not an event this app acts on' });
	}

	try {
		await record({
			...common,
			event,
			sourceSchema: schema,
			verdict: check.verdict,
			httpStatus: 200,
			detail: check.detail,
			orderId: orderIdFrom(event, schema, payload)
		});
	} catch {
		// Accepting a delivery this app failed to record loses it, so the
		// sender is asked for it again. The engine treats any non-2xx as a
		// failure and schedules a retry, which is what is wanted here.
		return json({ error: 'could not record the delivery' }, { status: 503 });
	}

	return json({ status: 'recorded', event, schema, signature: check.mode });
};

interface DeliveryPayload {
	event?: string;
	schema?: string;
	data?: Record<string, unknown>;
	old_data?: Record<string, unknown>;
	timestamp?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Finds the order this delivery is about, when there certainly is one.
 *
 * A create or an update carries the entry, whose id is also the id of its row
 * in the orders table, so a receipt can point at it. A delete carries the entry
 * that has just gone, and the receipt's relation is a foreign key against that
 * table, so pointing at it would fail. A test fire carries neither.
 */
function orderIdFrom(event: string, schema: string, payload: DeliveryPayload): string | null {
	if (schema !== ORDERS) return null;
	if (event !== 'after_create' && event !== 'after_update') return null;
	const id = payload.data?.id;
	return typeof id === 'string' && UUID.test(id) ? id : null;
}

function header(request: Request, name: string): string {
	return (request.headers.get(name) ?? '').trim();
}

/**
 * The status codes are chosen for a retrying sender, not for a browser.
 *
 * A signature that will not verify never verifies on a later attempt, so
 * strictly these should not ask to be retried at all. The engine retries every
 * non-2xx regardless, which is what turns a wrong key into a dead letter
 * instead of one silent failure, and that is the more useful outcome.
 */
function statusFor(verdict: Verdict): number {
	switch (verdict) {
		case 'replayed':
			return 409;
		case 'stale-timestamp':
		case 'invalid-json':
			return 400;
		default:
			return 401;
	}
}

async function record(receipt: NewReceipt): Promise<void> {
	await recordReceipt(receipt);
}
