import { json } from '@sveltejs/kit';
import { WEBHOOK_SECRET } from '$lib/server/lyeve';
import { findReaderByEmail, setSubscription } from '$lib/server/members';
import { verifySignature } from '$lib/server/signature';
import { isTier, type MemberStatus, type Tier } from '$lib/server/tiers';
import type { RequestHandler } from './$types';

/**
 * Receives subscription state from the payment provider.
 *
 * Nothing here charges anyone. The reader paid at the provider. This route is
 * told what happened and writes it down. That is the whole of the product's
 * involvement in payments, and it is deliberate: the engine verifies and
 * records, it does not hold card data.
 *
 * The status codes are chosen for a retrying sender rather than for a browser.
 * A provider retries anything that is not 2xx, so an event this app has decided
 * not to act on is acknowledged, and only a failure that a later attempt could
 * succeed at is reported as one.
 *
 * Send it as `application/json`. SvelteKit refuses a cross-origin POST that
 * carries a form content type, and a webhook is cross-origin by definition, so
 * a sender configured to post a form is rejected with a 403 before this handler
 * is reached.
 */
export const POST: RequestHandler = async ({ request }) => {
	// The signature covers the exact bytes, so the body is read as text and
	// parsed afterwards. Reading it as JSON first and re-encoding it changes
	// key order and whitespace, and the digest stops matching.
	const raw = await request.text();

	// Fail closed. A blank secret makes every payload unverifiable, and
	// treating that as permission to skip the check is how a forged event gets
	// in.
	if (!WEBHOOK_SECRET) {
		return json({ error: 'webhook secret not configured' }, { status: 500 });
	}

	const verdict = verifySignature(
		request.headers.get('x-subscription-signature'),
		raw,
		WEBHOOK_SECRET
	);
	if (verdict !== 'ok') {
		return json({ error: `signature ${verdict}` }, { status: 400 });
	}

	let event: ProviderEvent;
	try {
		event = JSON.parse(raw) as ProviderEvent;
	} catch {
		return json({ error: 'invalid JSON body' }, { status: 400 });
	}

	const change = interpret(event);
	if (!change) {
		return json({ status: 'ignored', reason: 'event type not handled', type: event.type ?? null });
	}

	const email = event.data?.object?.customer_email ?? '';
	const reader = await findReaderByEmail(email);
	if (!reader) {
		// Not an error the provider can fix by sending it again, so it is
		// acknowledged rather than retried into a loop.
		return json({ status: 'ignored', reason: 'no member with that email' });
	}

	try {
		const updated = await setSubscription(reader.id, change.tier, change.status);
		return json({
			status: 'applied',
			member: updated.email,
			tier: updated.tier,
			state: updated.status
		});
	} catch {
		// A write that failed might succeed next time, so this one asks to be
		// retried. The message stays generic: the sender is not the operator.
		return json({ error: 'could not record the subscription' }, { status: 503 });
	}
};

interface ProviderEvent {
	type?: string;
	data?: {
		object?: {
			customer_email?: string;
			status?: string;
			metadata?: { tier?: string };
		};
	};
}

/**
 * Maps a provider event to the tier and status this site stores.
 *
 * Only the events that carry a complete snapshot of the subscription are
 * acted on. A partial event would have to be merged against whatever arrived
 * before it, and the provider gives no ordering guarantee, so an out-of-order
 * delivery would resurrect a state the reader has already left.
 */
function interpret(event: ProviderEvent): { tier: Tier; status: MemberStatus } | null {
	const object = event.data?.object;

	switch (event.type) {
		case 'customer.subscription.created':
		case 'customer.subscription.updated': {
			// The provider names the plan in metadata it was configured with, so
			// an unrecognized value means a misconfigured product rather than a
			// free reader. Falling back to the paid tier keeps a paying customer
			// served while the mapping is corrected.
			const requested = object?.metadata?.tier;
			return {
				tier: isTier(requested) ? requested : 'member',
				status: mapStatus(object?.status)
			};
		}
		case 'customer.subscription.deleted':
			return { tier: 'free', status: 'canceled' };
		default:
			return null;
	}
}

/** The provider's status vocabulary is larger than the one this site keeps. */
function mapStatus(status: string | undefined): MemberStatus {
	switch (status) {
		case 'active':
		case 'trialing':
			return 'active';
		case 'past_due':
		case 'unpaid':
		case 'incomplete':
			return 'past_due';
		default:
			return 'canceled';
	}
}
