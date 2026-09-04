/**
 * Creates this example's content types, seeds a few orders, and creates the
 * inbound endpoint.
 *
 * It deliberately does not register the outbound webhooks. Their URL is this
 * app's own, and nothing running at provisioning time knows which port the app
 * will be served on, so registering here would point the engine at a port
 * nothing is listening on and fill the delivery log with failures before anyone
 * had opened the page. The register button on the endpoints page does it, from
 * the origin the operator is actually using.
 *
 * Safe to run more than once: applying a schema that exists is accepted, the
 * seed stops if there are already orders, and the inbound endpoint is matched
 * by name before it is created.
 */
import { applySchemas, belongsTo, createContent, listContent, lyeveFromEnv } from '../src/lib/lyeve/index.ts';
import {
	INBOUND_FIELD_MAP,
	INBOUND_WEBHOOK_NAME,
	ORDERS,
	RECEIPTS,
	SHIPMENTS
} from '../src/lib/contract.ts';

const client = lyeveFromEnv();
const INBOUND_SECRET =
	process.env.HOOKS_INBOUND_SECRET ?? 'webhook-integrations-dev-inbound-secret';

// Order matters: a relation emits a foreign key against the target's generated
// table, so orders must exist before receipts points at it.
await applySchemas(client, [
	{
		name: ORDERS,
		display_name: 'Orders',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'customer', field_type: 'text' },
			// Text rather than the engine's email type on purpose. That type
			// carries a database check constraint, and an admin write mirrors
			// into the generated table on a best-effort basis: an address the
			// constraint refuses is accepted by the API, logged on the engine,
			// and then missing from every read. The app validates instead.
			{ name: 'customer_email', field_type: 'text' },
			// Indexed because the status is the one column a listing narrows on.
			{ name: 'status', field_type: 'text', indexed: true },
			{ name: 'total_cents', field_type: 'number' },
			{ name: 'currency', field_type: 'text' },
			{ name: 'note', field_type: 'text' }
		]
	},
	{
		name: RECEIPTS,
		display_name: 'Delivery receipts',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'event', field_type: 'text', indexed: true },
			{ name: 'source_schema', field_type: 'text' },
			{ name: 'channel', field_type: 'text', indexed: true },
			{ name: 'verdict', field_type: 'text', indexed: true },
			{ name: 'http_status', field_type: 'number' },
			{ name: 'detail', field_type: 'text' },
			{ name: 'signature_algo', field_type: 'text' },
			{ name: 'signature_mode', field_type: 'text' },
			{ name: 'nonce', field_type: 'text' },
			{ name: 'key_index', field_type: 'number' },
			{ name: 'payload', field_type: 'text' },
			{ name: 'received_at', field_type: 'text' },
			belongsTo('order', ORDERS)
		]
	},
	{
		name: SHIPMENTS,
		display_name: 'Inbound shipments',
		// Every field is optional and every field is text. The inbound endpoint
		// inserts the mapped values straight into the columns with no schema
		// validation, so a required column the vendor's payload happens not to
		// carry, or a value a timestamp column cannot parse, surfaces as a
		// database error rather than a 422.
		fields: [
			{ name: 'title', field_type: 'text' },
			{ name: 'slug', field_type: 'text', indexed: true },
			{ name: 'carrier', field_type: 'text' },
			{ name: 'tracking_code', field_type: 'text' },
			{ name: 'state', field_type: 'text', indexed: true },
			{ name: 'dispatched_at', field_type: 'text' }
		]
	}
]);
console.log('content types ready');

const existing = await listContent(client, ORDERS, { limit: 25 });
if (existing.length === 0) {
	const orders = [
		{
			reference: 'LY-10233',
			customer: 'Marisa Okonjo',
			email: 'm.okonjo@example.com',
			total_cents: 14950,
			status: 'pending',
			note: 'Leave with the neighbor at 14b if nobody is in.'
		},
		{
			reference: 'LY-10234',
			customer: 'Tomas Brandt',
			email: 't.brandt@northgate.example',
			total_cents: 8225,
			status: 'paid',
			note: 'Invoice to Northgate Supplies, purchase order 44117.'
		},
		{
			reference: 'LY-10235',
			customer: 'Priya Raghunathan',
			email: 'priya@sablefield.example',
			total_cents: 47600,
			status: 'shipped',
			note: 'Two boxes. The smaller one is glass.'
		}
	];

	for (const order of orders) {
		const slug = order.reference.toLowerCase();
		await createContent(client, {
			schema: ORDERS,
			slug,
			title: order.reference,
			body: {
				slug,
				customer: order.customer,
				customer_email: order.email,
				status: order.status,
				total_cents: order.total_cents,
				currency: 'GBP',
				note: order.note
			}
		});
	}
	console.log(`seeded ${orders.length} orders`);
} else {
	console.log('orders already seeded, nothing to do');
}

// The inbound endpoint can be created now because its URL belongs to the
// engine, not to this app.
const page = await client.request<{ data: { id: string; name: string }[] }>(
	'admin',
	'/api/admin/incoming-webhooks?limit=200'
);
const inbound = (page?.data ?? []).find((row) => row.name === INBOUND_WEBHOOK_NAME);
if (inbound) {
	console.log(`inbound endpoint already there: POST /api/v1/webhooks/in/${inbound.id}`);
} else {
	const created = await client.request<{ id: string }>('admin', '/api/admin/incoming-webhooks', {
		method: 'POST',
		body: JSON.stringify({
			name: INBOUND_WEBHOOK_NAME,
			secret: INBOUND_SECRET,
			schema_name: SHIPMENTS,
			field_map: INBOUND_FIELD_MAP,
			allowed_ips: [],
			enabled: true
		})
	});
	console.log(`inbound endpoint created: POST /api/v1/webhooks/in/${created.id}`);
}

console.log('start the app, then use Register on the endpoints page to point the engine at it');
