/**
 * Everything the app and the provisioning script have to agree on.
 *
 * This module reads no environment and imports nothing from SvelteKit, because
 * `setup/provision.ts` runs under plain node and imports it directly. Anything
 * that needs a credential or an env var lives in `src/lib/server/` instead.
 */

export const ORDERS = 'hooks_orders';
export const RECEIPTS = 'hooks_receipts';
export const SHIPMENTS = 'hooks_inbound_shipments';

/**
 * The engine's delivery carries no webhook id, so a receiver cannot tell which
 * registration sent a request. Each registration adds a custom header instead,
 * and that header is the only attribution this app has.
 */
export const CHANNEL_HEADER = 'x-integration-channel';

export type Channel = 'primary' | 'shipped-only' | 'wrong-secret';

export const CHANNELS: readonly Channel[] = ['primary', 'shipped-only', 'wrong-secret'];

/**
 * Narrows the channel header to a channel this app knows.
 *
 * The value arrives in a request header, so a caller can send anything. An
 * unrecognized channel is recorded as unknown rather than trusted, because the
 * receipt it lands on is what the dashboard reads back.
 */
export function asChannel(value: string | null | undefined): Channel | 'unknown' {
	return CHANNELS.includes(value as Channel) ? (value as Channel) : 'unknown';
}

export interface Registration {
	channel: Channel;
	name: string;
	events: string[];
	/** Empty means every schema, which is a mistake this app must not make. */
	schemas: string[];
	jsonpathFilter?: string;
	excludeFields?: string[];
	/** True for the registration that proves the rejection path. */
	mismatchedSecret?: boolean;
	description: string;
}

/**
 * The event names are the engine's own hook types, matched as exact strings by
 * the dispatcher. `before_*` events exist and are never delivered: the
 * dispatcher subscribes to the three `after_*` types only, because a webhook on
 * a before-hook would hold the write open on an outbound HTTP call.
 */
export const DELIVERED_EVENTS = ['after_create', 'after_update', 'after_delete'] as const;

export const REGISTRATIONS: Registration[] = [
	{
		channel: 'primary',
		name: 'webhook-integrations primary',
		events: [...DELIVERED_EVENTS],
		schemas: [ORDERS],
		// Include and exclude selectors act on the payload's top-level keys.
		// For an entry written through the admin route those keys are the
		// envelope, so this drops the bookkeeping and leaves the order itself,
		// which sits one level down under `body`.
		excludeFields: ['meta', 'created_by', 'updated_by', 'tenant_id', 'timezone'],
		description: 'Every order event, minus the fields a receiver has no business seeing.'
	},
	{
		channel: 'shipped-only',
		name: 'webhook-integrations shipped only',
		events: ['after_update'],
		schemas: [ORDERS],
		// field_filters compare top-level keys only, so an order's own status
		// is out of their reach. The JSONPath filter can walk into the body.
		jsonpathFilter: `$.data.body.status == shipped`,
		description: 'Only an update that leaves the order shipped.'
	},
	{
		channel: 'wrong-secret',
		name: 'webhook-integrations wrong secret',
		events: [...DELIVERED_EVENTS],
		schemas: [ORDERS],
		mismatchedSecret: true,
		description: 'Signed with a key the receiver does not hold, to fill the failure path.'
	}
];

/**
 * The key the third registration signs with. Its whole job is to be wrong, and
 * it still has to clear the sixteen-character minimum the create route enforces.
 */
export const MISMATCHED_SECRET = 'not-the-receivers-signing-key';

export const INBOUND_WEBHOOK_NAME = 'webhook-integrations shipments';

/**
 * Maps the vendor's payload keys onto this app's column names.
 *
 * `field_map` is mandatory on an incoming webhook, and it is the whole reason
 * the endpoint is safe to expose: a key the map does not name is dropped, so a
 * caller cannot reach a column by inventing a JSON key for it.
 */
export const INBOUND_FIELD_MAP: Record<string, string> = {
	reference: 'title',
	shipment_id: 'slug',
	carrier_name: 'carrier',
	tracking: 'tracking_code',
	state: 'state',
	dispatched_at: 'dispatched_at'
};

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'canceled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
	return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** What happens to an order next, or null when it is finished. */
export function nextStatus(current: OrderStatus): OrderStatus | null {
	switch (current) {
		case 'pending':
			return 'paid';
		case 'paid':
			return 'shipped';
		default:
			return null;
	}
}

/**
 * Every outcome the receiver can reach. A verdict is recorded whether or not
 * the request was accepted, because a rejected delivery is the interesting one.
 */
export type Verdict =
	| 'accepted'
	| 'accepted-body-only'
	| 'ignored'
	| 'missing-signature'
	| 'malformed-signature'
	| 'unknown-algorithm'
	| 'stale-timestamp'
	| 'replayed'
	| 'signature-mismatch'
	| 'invalid-json';

export const VERDICT_LABELS: Record<Verdict, string> = {
	accepted: 'Accepted',
	'accepted-body-only': 'Accepted, body-only signature',
	ignored: 'Ignored',
	'missing-signature': 'Rejected, no signature',
	'malformed-signature': 'Rejected, malformed signature',
	'unknown-algorithm': 'Rejected, unknown algorithm',
	'stale-timestamp': 'Rejected, timestamp outside the window',
	replayed: 'Rejected, nonce already used',
	'signature-mismatch': 'Rejected, signature did not match',
	'invalid-json': 'Rejected, body was not JSON'
};

export function isAccepted(verdict: Verdict): boolean {
	return verdict === 'accepted' || verdict === 'accepted-body-only' || verdict === 'ignored';
}
