/**
 * The other direction: a vendor signs, the engine verifies.
 *
 * `POST /api/v1/webhooks/in/{id}` is the engine's own receiver. It is public,
 * so the signature is the credential and no bearer token is involved, and it
 * writes the mapped payload straight into the content type's generated table.
 */
import { listContent, type ContentEntry } from '$lib/lyeve';
import { INBOUND_FIELD_MAP, INBOUND_WEBHOOK_NAME, SHIPMENTS } from '$lib/contract';
import { newNonce } from './digest';
import { API_URL, lyeve } from './lyeve';
import { signRequest } from './signature';

export interface IncomingWebhook {
	id: string;
	name: string;
	schema_name: string;
	field_map: Record<string, string>;
	allowed_ips: string[];
	enabled: boolean;
	created_at: string;
}

interface Paginated<T> {
	data: T[];
	total_count: number;
}

export async function listIncoming(): Promise<IncomingWebhook[]> {
	const page = await lyeve.request<Paginated<IncomingWebhook>>(
		'admin',
		'/api/admin/incoming-webhooks?limit=200'
	);
	return page?.data ?? [];
}

export async function findIncoming(): Promise<IncomingWebhook | null> {
	const all = await listIncoming();
	return all.find((wh) => wh.name === INBOUND_WEBHOOK_NAME) ?? null;
}

/**
 * Creates the inbound endpoint if it is missing.
 *
 * `field_map` is required and rejected when empty, on purpose: without it a
 * caller's own JSON keys would decide which columns get written. `allowed_ips`
 * is left empty here because a vendor's egress addresses are the operator's
 * fact, not the example's, and an entry that does not parse as an IP or a CIDR
 * is refused at create time rather than silently matching nothing.
 */
export async function ensureIncoming(secret: string): Promise<IncomingWebhook> {
	const existing = await findIncoming();
	if (existing) return existing;
	return lyeve.request<IncomingWebhook>('admin', '/api/admin/incoming-webhooks', {
		method: 'POST',
		body: JSON.stringify({
			name: INBOUND_WEBHOOK_NAME,
			secret,
			schema_name: SHIPMENTS,
			field_map: INBOUND_FIELD_MAP,
			allowed_ips: [],
			enabled: true
		})
	});
}

export type SampleMode = 'valid' | 'unsigned' | 'stale' | 'replayed' | 'tampered';

export interface SampleResult {
	mode: SampleMode;
	status: number;
	response: string;
	request: {
		url: string;
		headers: Record<string, string>;
		body: string;
	};
	expectation: string;
}

/** The last correctly signed request, kept so the replay case can resend it. */
let lastSigned: { headers: Record<string, string>; body: string } | null = null;

const CARRIERS = [
	{ carrier: 'Whistlebrook Freight', tracking: 'WBF' },
	{ carrier: 'Halden Overnight', tracking: 'HLD' },
	{ carrier: 'Corrigan Rail Cargo', tracking: 'CRC' }
];

function sampleBody(reference: string): string {
	const carrier = CARRIERS[Math.floor(Math.random() * CARRIERS.length)];
	const suffix = Math.floor(100000 + Math.random() * 899999);
	// Vendor keys, deliberately not this app's column names: the field map is
	// what closes the gap, and a key it does not name is dropped.
	return JSON.stringify({
		reference,
		shipment_id: `shp-${suffix}`,
		carrier_name: carrier.carrier,
		tracking: `${carrier.tracking}-${suffix}`,
		state: 'in_transit',
		dispatched_at: new Date().toISOString(),
		operator_note: 'ignored: no field_map entry names this key'
	});
}

/**
 * Posts a sample to the engine's inbound endpoint.
 *
 * Every failing mode is here on purpose. The engine's rules are strict and the
 * error it answers with is the fastest way to see which rule was broken:
 * a missing timestamp is a 400 before any signature check, a timestamp beyond
 * the window is a 400, a reused nonce is a 409, and a signature that does not
 * verify is a 401.
 */
export async function postSample(
	id: string,
	secret: string,
	mode: SampleMode,
	reference: string
): Promise<SampleResult> {
	const url = `${API_URL}/api/v1/webhooks/in/${id}`;
	const nowSeconds = Math.floor(Date.now() / 1000);

	let headers: Record<string, string>;
	let body: string;
	let expectation: string;

	switch (mode) {
		case 'unsigned': {
			body = sampleBody(reference);
			headers = { 'content-type': 'application/json' };
			expectation = '400, because a webhook with a secret set requires X-Webhook-Timestamp.';
			break;
		}
		case 'stale': {
			body = sampleBody(reference);
			// Signed correctly, for a time outside the window. The timestamp is
			// inside the signed string, so it cannot be edited after signing.
			headers = signRequest(secret, body, nowSeconds - 600, newNonce()).headers;
			expectation = '400, timestamp outside the tolerance window of five minutes behind.';
			break;
		}
		case 'replayed': {
			if (!lastSigned) {
				body = sampleBody(reference);
				headers = signRequest(secret, body, nowSeconds, newNonce()).headers;
				lastSigned = { headers, body };
				expectation = '201, since there was no earlier request to replay. Send this again.';
				break;
			}
			headers = lastSigned.headers;
			body = lastSigned.body;
			expectation = '409, the nonce has already been recorded for this endpoint.';
			break;
		}
		case 'tampered': {
			const signedBody = sampleBody(reference);
			headers = signRequest(secret, signedBody, nowSeconds, newNonce()).headers;
			// One character changed after signing.
			body = signedBody.replace('in_transit', 'delivered');
			expectation = '401, the body no longer matches the signature.';
			break;
		}
		default: {
			body = sampleBody(reference);
			headers = signRequest(secret, body, nowSeconds, newNonce()).headers;
			lastSigned = { headers, body };
			expectation = '201 accepted, and a new shipment row.';
		}
	}

	const res = await fetch(url, { method: 'POST', headers, body });
	const text = await res.text();
	return {
		mode,
		status: res.status,
		response: text.slice(0, 500),
		request: { url, headers, body },
		expectation
	};
}

interface ShipmentFields {
	title: string;
	slug: string;
	carrier: string;
	tracking_code: string;
	state: string;
	dispatched_at: string;
}

export interface Shipment {
	id: string;
	reference: string;
	shipmentId: string;
	carrier: string;
	trackingCode: string;
	state: string;
	dispatchedAt: string;
	recordedAt: string;
}

/**
 * Reads the rows the inbound endpoint wrote.
 *
 * They are readable here and nowhere else: the endpoint inserts into the
 * generated table directly, not through `sys_content_entries`, so a shipment
 * never reaches search or the admin content list.
 */
export async function listShipments(): Promise<Shipment[]> {
	const rows = await listContent<ShipmentFields>(lyeve, SHIPMENTS, { limit: 200 });
	return rows.map((row: ContentEntry<ShipmentFields>) => ({
		id: row.id,
		reference: row.data.title ?? '',
		shipmentId: row.data.slug ?? '',
		carrier: row.data.carrier ?? '',
		trackingCode: row.data.tracking_code ?? '',
		state: row.data.state ?? '',
		dispatchedAt: row.data.dispatched_at ?? '',
		recordedAt: row.created_at
	}));
}
