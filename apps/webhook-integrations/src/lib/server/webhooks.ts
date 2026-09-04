/**
 * Every webhook route this app calls, with the response shapes the engine
 * really returns.
 *
 * Three envelopes are in play on these routes and the difference is not
 * cosmetic: the listings use `{data, total_count, limit, offset}`, the delivery
 * log is a bare array with no count at all, and delivery search has its own
 * `{total, items}`. A helper per route is cheaper than remembering which.
 */
import { LyeveError } from '$lib/lyeve';
import type { Registration } from '$lib/contract';
import { RECEIVER_URL_OVERRIDE, lyeve } from './lyeve';

export interface Webhook {
	id: string;
	name: string;
	url: string;
	tenant_id: string;
	events: string[];
	schemas: string[];
	enabled: boolean;
	secret_rotated_at?: string;
	headers?: Record<string, string>;
	payload_template?: string;
	max_retries?: number;
	retry_delay_seconds?: number;
	field_filters?: Record<string, string>;
	jsonpath_filter?: string;
	include_fields?: string[];
	exclude_fields?: string[];
	max_response_size?: number;
	created_at: string;
	updated_at: string;
}

export interface Delivery {
	id: string;
	webhook_id: string;
	event_type: string;
	schema_name: string;
	status_code?: number;
	success: boolean;
	duration_ms?: number;
	request_body: string;
	original_payload: string;
	error?: string;
	attempted_at: string;
	retry_count: number;
	next_retry_at?: string;
}

export interface DeliveryStats {
	total: number;
	success_count: number;
	failure_count: number;
	success_rate: number;
	avg_latency_ms: number;
	last_24h: number;
}

export interface Attempt {
	id: string;
	webhook_id: string;
	event_type: string;
	schema_name: string;
	attempt_num: number;
	status_code?: number;
	status: 'pending' | 'success' | 'failed' | 'exhausted' | 'superseded';
	duration_ms?: number;
	error?: string;
	created_at: string;
}

export interface DeadLetter {
	id: string;
	webhook_id: string;
	webhook_name: string;
	webhook_url: string;
	event_type: string;
	schema_name: string;
	request_body: string;
	last_status_code?: number;
	last_error?: string;
	total_attempts: number;
	status: 'pending' | 'replayed' | 'dismissed';
	dead_at: string;
	replayed_at?: string;
	created_at: string;
}

export interface RetryConfig {
	id: string;
	webhook_id: string;
	max_attempts: number;
	base_delay_ms: number;
	max_delay_ms: number;
	strategy: 'exponential' | 'fixed' | 'linear';
	enabled: boolean;
}

export interface GlobalHealth {
	total_webhooks: number;
	healthy_webhooks: number;
	unhealthy_webhooks: number;
	pending_retries: number;
	total_dlq: number;
	pending_dlq: number;
}

export interface WebhookHealth {
	webhook_id: string;
	webhook_name: string;
	total_attempts: number;
	success_count: number;
	failed_count: number;
	exhausted_count: number;
	dlq_pending: number;
	average_duration_ms?: number;
	healthy: boolean;
}

export interface FireResult {
	success: boolean;
	status_code: number;
	message: string;
	delivery_id?: string;
}

interface Paginated<T> {
	data: T[];
	total_count: number;
	limit: number;
	offset: number;
}

interface Envelope<T> {
	total: number;
	limit: number;
	offset: number;
	items: T[];
}

export interface WebhookInput {
	name: string;
	url: string;
	events: string[];
	schemas: string[];
	secret: string;
	enabled: boolean;
	headers?: Record<string, string>;
	jsonpath_filter?: string;
	exclude_fields?: string[];
	max_retries?: number;
	retry_delay_seconds?: number;
}

export async function listWebhooks(): Promise<Webhook[]> {
	const page = await lyeve.request<Paginated<Webhook>>('admin', '/api/admin/webhooks?limit=200');
	return page?.data ?? [];
}

/** Create is super_admin only. Admin can read and test but not register. */
export async function createWebhook(input: WebhookInput): Promise<Webhook> {
	return lyeve.request<Webhook>('admin', '/api/admin/webhooks', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

/**
 * Update replaces every mutable field, secret included, rather than merging.
 * Leaving the secret out of the body sets it to empty, which turns signing off
 * silently, so callers pass the whole input every time.
 */
export async function updateWebhook(id: string, input: WebhookInput): Promise<Webhook> {
	return lyeve.request<Webhook>('admin', `/api/admin/webhooks/${id}`, {
		method: 'PUT',
		body: JSON.stringify(input)
	});
}

export async function deleteWebhook(id: string): Promise<void> {
	await lyeve.request<void>('admin', `/api/admin/webhooks/${id}`, { method: 'DELETE' });
}

/**
 * Fires a synthetic payload and answers 200 whatever happens, with the outcome
 * in the body. A failed test is not an error the caller has to catch.
 */
export async function testWebhook(id: string): Promise<FireResult> {
	return lyeve.request<FireResult>('admin', `/api/admin/webhooks/${id}/test`, { method: 'POST' });
}

/**
 * Replaces the signing key. This is the only route that ever discloses a
 * webhook secret: the webhook object carries `json:"-"` on the field, so create
 * and read never return it, and the rotate response's `new_secret` is the one
 * chance to record the value.
 */
export async function rotateSecret(id: string, newSecret: string): Promise<string> {
	const result = await lyeve.request<{ new_secret: string }>(
		'admin',
		`/api/admin/webhooks/${id}/rotate-secret`,
		{ method: 'POST', body: JSON.stringify({ new_secret: newSecret }) }
	);
	return result.new_secret;
}

/** A bare array, newest first, with no total. */
export async function listDeliveries(id: string, limit = 50): Promise<Delivery[]> {
	const rows = await lyeve.request<Delivery[]>(
		'admin',
		`/api/admin/webhooks/${id}/deliveries?limit=${limit}`
	);
	return Array.isArray(rows) ? rows : [];
}

export interface DeliveryQuery {
	event?: string;
	schema?: string;
	success?: 'true' | 'false';
	q?: string;
	limit?: number;
	offset?: number;
}

export async function searchDeliveries(
	id: string,
	query: DeliveryQuery
): Promise<Envelope<Delivery>> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== '') params.set(key, String(value));
	}
	const result = await lyeve.request<Envelope<Delivery>>(
		'admin',
		`/api/admin/webhooks/${id}/deliveries/search?${params.toString()}`
	);
	return result ?? { total: 0, limit: 50, offset: 0, items: [] };
}

export async function deliveryStats(id: string): Promise<DeliveryStats> {
	return lyeve.request<DeliveryStats>('admin', `/api/admin/webhooks/${id}/deliveries/stats`);
}

/**
 * Re-fires one recorded delivery, synchronously, and writes a new delivery row
 * for the attempt. The row that failed keeps its own outcome: nothing marks it
 * resolved, so a delivery log is an append-only history rather than a queue.
 */
export async function retryDelivery(id: string, deliveryId: string): Promise<FireResult> {
	return lyeve.request<FireResult>(
		'admin',
		`/api/admin/webhooks/${id}/deliveries/${deliveryId}/retry`,
		{ method: 'POST' }
	);
}

/**
 * The retry policy. This route answers for a webhook that does not exist,
 * returning the defaults with a nil id, so a 200 here is not proof of anything.
 */
export async function getRetryConfig(id: string): Promise<RetryConfig> {
	return lyeve.request<RetryConfig>('admin', `/api/admin/webhooks/${id}/retry-config`);
}

export async function putRetryConfig(
	id: string,
	config: Omit<RetryConfig, 'id' | 'webhook_id'>
): Promise<RetryConfig> {
	return lyeve.request<RetryConfig>('admin', `/api/admin/webhooks/${id}/retry-config`, {
		method: 'PUT',
		body: JSON.stringify(config)
	});
}

export async function listAttempts(id: string, limit = 50): Promise<Attempt[]> {
	const page = await lyeve.request<Paginated<Attempt>>(
		'admin',
		`/api/admin/webhooks/${id}/attempts?limit=${limit}`
	);
	return page?.data ?? [];
}

export async function listDeadLetters(status = 'pending'): Promise<DeadLetter[]> {
	const page = await lyeve.request<Paginated<DeadLetter>>(
		'admin',
		`/api/admin/webhook-dead-letters?limit=50&status=${status}`
	);
	return page?.data ?? [];
}

/**
 * Re-sends a dead letter's original body.
 *
 * It carries no signature, no timestamp and no nonce, unlike every other
 * sender in the engine, so a receiver that verifies rejects it. The reply is
 * still a 200 with the receiver's status inside, and the entry only leaves
 * `pending` on a 2xx.
 */
export async function replayDeadLetter(id: string): Promise<{ http_status: number }> {
	return lyeve.request<{ http_status: number }>(
		'admin',
		`/api/admin/webhook-dead-letters/${id}/replay`,
		{ method: 'POST' }
	);
}

export async function dismissDeadLetter(id: string): Promise<void> {
	await lyeve.request<void>('admin', `/api/admin/webhook-dead-letters/${id}/dismiss`, {
		method: 'POST'
	});
}

export async function globalHealth(): Promise<GlobalHealth> {
	return lyeve.request<GlobalHealth>('admin', '/api/admin/webhooks/health');
}

/**
 * Per-webhook health. `healthy` is true below five attempts whatever they were,
 * so a webhook that has failed four times in a row still reads healthy.
 */
export async function webhookHealth(id: string): Promise<WebhookHealth> {
	return lyeve.request<WebhookHealth>('admin', `/api/admin/webhooks/${id}/health`);
}

/**
 * Builds the body both create and update take.
 *
 * Update replaces every field, so a caller that wants to change one of them has
 * to send all of them, and that includes the secret. This is the one place that
 * assembles the body, so a toggle cannot accidentally clear the signing key.
 */
export function buildInput(
	registration: Registration,
	url: string,
	secret: string,
	enabled = true
): WebhookInput {
	return {
		name: registration.name,
		url,
		events: registration.events,
		// Never empty. An empty schemas array matches every content type, and
		// this app's receiver writes a receipt for each delivery, so a webhook
		// with no schema filter would deliver the receipt back to itself and
		// keep going until something ran out.
		schemas: registration.schemas,
		secret,
		enabled,
		headers: { 'X-Integration-Channel': registration.channel },
		jsonpath_filter: registration.jsonpathFilter ?? '',
		exclude_fields: registration.excludeFields ?? []
	};
}

/**
 * Registers, or re-registers, one of this app's endpoints.
 *
 * Matched by name rather than by URL, because the URL is the thing that
 * changes: the dev server and the preview server sit on different ports, and a
 * re-register has to move the existing row rather than add a second one
 * pointing at a port nothing is listening on.
 */
export async function ensureRegistration(
	registration: Registration,
	url: string,
	secret: string,
	existing: Webhook[]
): Promise<{ webhook: Webhook; created: boolean }> {
	const input = buildInput(registration, url, secret);
	const found = existing.find((wh) => wh.name === registration.name);
	if (found) return { webhook: await updateWebhook(found.id, input), created: false };
	return { webhook: await createWebhook(input), created: true };
}

/** Turns an engine failure into one sentence a page can show. */
export function describe(err: unknown, fallback: string): string {
	if (!(err instanceof LyeveError)) return fallback;
	if (err.status === 403) return 'Refused: registering a webhook needs a super_admin token.';
	return err.fieldErrors[0]?.message || err.message || fallback;
}

/**
 * The URL to register, derived from the page the operator is looking at.
 *
 * Hard-coding a port would be wrong twice over: the dev server and the preview
 * server use different ones. `localhost` is narrowed to `127.0.0.1` on purpose,
 * because the engine's SSRF guard takes the literal-IP path for an address and
 * the resolver path for a name, and the loopback allowance is expressed as
 * CIDRs. One less thing that can differ between two machines.
 */
export function receiverUrl(pageUrl: URL): string {
	if (RECEIVER_URL_OVERRIDE) return RECEIVER_URL_OVERRIDE;
	const origin = new URL(pageUrl.origin);
	if (origin.hostname === 'localhost') origin.hostname = '127.0.0.1';
	return `${origin.origin}/hooks/receive`;
}

/** Reads that are decoration rather than substance: a failure leaves a gap. */
export async function safely<T>(read: Promise<T>): Promise<T | null> {
	try {
		return await read;
	} catch {
		return null;
	}
}
