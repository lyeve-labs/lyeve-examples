import { LyeveError, type LyeveClient } from '$lib/lyeve';

/**
 * The two meters, which are separate systems with separate limits, both in
 * the usage plugin.
 *
 * One counts requests per tenant and answers with X-Quota-* headers on every
 * response. The other counts requests and bytes per API key and enforces the
 * key's own monthly_limit. They do not share a
 * counter, a table, a header or a 429 body, and a client can be refused by
 * either one.
 */

export interface Quota {
	id: string;
	tenant_id: string;
	requests_limit: number;
	storage_bytes_limit: number;
	bandwidth_bytes_limit: number;
	is_hard_limit: boolean;
	grace_period_hours: number;
	warn_at_pct_80: boolean;
	warn_at_pct_90: boolean;
	block_on_exceeded: boolean;
	blocked_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface QuotaStatus {
	tenant_id: string;
	requests_used: number;
	requests_limit: number;
	requests_pct: number;
	is_blocked: boolean;
	is_warning_80: boolean;
	is_warning_90: boolean;
	is_exceeded: boolean;
	is_hard_limit: boolean;
	grace_period_hours: number;
	blocked_at?: string | null;
}

export interface TenantUsage {
	tenant_id: string;
	billing_period: string;
	api_calls: number;
	storage_bytes: number;
	bandwidth_bytes: number;
	content_count: number;
	media_count: number;
}

export interface KeyUsage {
	api_key_id: string;
	tenant_id: string;
	billing_period: string;
	requests: number;
	bytes_in: number;
	bytes_out: number;
}

/** The headers the quota middleware writes onto every response it sees. */
export interface QuotaHeaders {
	used: string | null;
	limit: string | null;
	pct: string | null;
	warning80: boolean;
	warning90: boolean;
	exceeded: boolean;
	blocked: boolean;
}

function isStatus(err: unknown, status: number): boolean {
	return err instanceof LyeveError && err.status === status;
}

/** Null when the tenant has no quota row, which the engine reads as unlimited. */
export async function getQuota(client: LyeveClient, tenant: string): Promise<Quota | null> {
	try {
		return await client.request<Quota>('admin', `/api/admin/quotas/${tenant}`);
	} catch (err) {
		if (isStatus(err, 404)) return null;
		throw err;
	}
}

/**
 * The tenant's live position, read the way a client reads it.
 *
 * This is the one metering route on the public router, and it is not scope
 * gated: the plugin declares it in the authenticated group rather than the
 * scoped one, so a key with an empty scope list still gets an answer here
 * while being refused on content. The route is fetched raw because the headers
 * are half the answer and a parsed body throws them away.
 */
export async function quotaStatus(
	client: LyeveClient
): Promise<{ status: QuotaStatus | null; headers: QuotaHeaders; httpStatus: number }> {
	const res = await client.raw('api', '/api/v1/quotas/status');
	const headers = readQuotaHeaders(res.headers);
	const body: unknown = await res.json().catch(() => null);

	// A tenant with no quota row gets a message rather than a status object.
	const status =
		body && typeof body === 'object' && 'requests_limit' in body ? (body as QuotaStatus) : null;

	return { status, headers, httpStatus: res.status };
}

export function readQuotaHeaders(h: Headers): QuotaHeaders {
	return {
		used: h.get('x-quota-requests-used'),
		limit: h.get('x-quota-requests-limit'),
		pct: h.get('x-quota-requests-pct'),
		warning80: h.get('x-quota-warning-80') === 'true',
		warning90: h.get('x-quota-warning-90') === 'true',
		exceeded: h.get('x-quota-exceeded') === 'true',
		blocked: h.get('x-quota-blocked') === 'true'
	};
}

/**
 * The tenant rollup for a billing period.
 *
 * Answers 404 for a tenant that holds no API key, because that is how the
 * plugin decides a tenant exists: it asks sys_api_keys, not sys_tenants. A
 * tenant with keys and no traffic returns a row of zeros. A tenant with no
 * keys at all is indistinguishable from a tenant that was never created.
 */
export async function tenantUsage(
	client: LyeveClient,
	tenant: string,
	period?: string
): Promise<TenantUsage | null> {
	const q = period ? `?period=${encodeURIComponent(period)}` : '';
	try {
		return await client.request<TenantUsage>('admin', `/api/admin/usage/tenant/${tenant}${q}`);
	} catch (err) {
		if (isStatus(err, 404)) return null;
		throw err;
	}
}

/**
 * Per-key metering.
 *
 * Not at `/api/admin/api-keys/{id}/usage`, which answers 501 by design: the
 * apikey plugin cannot read the usage plugin's table without closing a
 * dependency cycle, and it declines rather than reporting a zero that would be
 * indistinguishable from an idle key. This is the route that owns the data.
 */
export async function keyUsage(
	client: LyeveClient,
	keyId: string,
	period?: string
): Promise<KeyUsage | null> {
	const q = period ? `?period=${encodeURIComponent(period)}` : '';
	try {
		return await client.request<KeyUsage>('admin', `/api/admin/usage/api-key/${keyId}${q}`);
	} catch (err) {
		if (isStatus(err, 404)) return null;
		throw err;
	}
}
