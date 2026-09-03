import { LyeveError, type LyeveClient } from '../lyeve/index.ts';

/**
 * The tenant, API key, quota and usage endpoints the engine's platform plugins
 * expose. They are all on the admin router and all require a privileged role,
 * so this module is server-only by construction.
 *
 * Two identifiers are in play and they are not interchangeable. A tenant row is
 * addressed by its UUID (`/api/admin/tenants/{id}`), while every tenant-scoped
 * table keys off the slug (`sys_api_keys.tenant_id`, `sys_quotas.tenant_id`,
 * `X-Tenant-ID`). This app routes by slug for that reason and looks the UUID up
 * only when it needs the tenant record itself.
 */

/** Plugin admin lists answer with this envelope. The public v1 content route does not. */
export interface Page<T> {
	data: T[];
	total_count: number;
	limit: number;
	offset: number;
}

export interface Tenant {
	id: string;
	slug: string;
	name: string;
	plan: string;
	enabled: boolean;
	archived: boolean;
	created_at: string;
	updated_at: string;
}

export interface ApiKey {
	id: string;
	name: string;
	roles: string[];
	schemas: string[];
	scopes: string[];
	tenant_id: string;
	enabled: boolean;
	monthly_limit: number;
	created_at: string;
	expires_at?: string | null;
}

/** The only response that ever carries the secret. Reads return the hash and never the key. */
export interface MintedApiKey extends ApiKey {
	raw_key: string;
}

export interface Quota {
	tenant_id: string;
	requests_limit: number;
	storage_bytes_limit: number;
	bandwidth_bytes_limit: number;
	is_hard_limit: boolean;
	grace_period_hours: number;
	block_on_exceeded: boolean;
	blocked_at: string | null;
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

/**
 * Acts as one tenant for the duration of a single request.
 *
 * `sys_api_keys` and `sys_quotas` live in the shared schema and are isolated by
 * a `tenant_id` column, and the column is filled from whatever tenant the
 * request resolved to. A super_admin resolves to the implicit `default` tenant
 * unless this header names another, so without it a key minted for Northwind
 * would be stamped `default` and be invisible on Northwind's page.
 *
 * The engine validates the slug against `sys_tenants` before honoring it, and
 * answers 404 for a slug no tenant holds.
 */
function asTenant(slug: string): RequestInit {
	return { headers: { 'X-Tenant-ID': slug } };
}

function isStatus(err: unknown, status: number): boolean {
	return err instanceof LyeveError && err.status === status;
}

export async function listTenants(client: LyeveClient, limit = 100): Promise<Tenant[]> {
	const page = await client.request<Page<Tenant>>('admin', `/api/admin/tenants?limit=${limit}`);
	return page?.data ?? [];
}

/**
 * There is no lookup-by-slug route, so this filters a page of the roster. The
 * page is bounded: the engine caps a plugin admin list at 500 rows.
 */
export async function getTenantBySlug(client: LyeveClient, slug: string): Promise<Tenant | null> {
	const tenants = await listTenants(client, 500);
	return tenants.find((t) => t.slug === slug) ?? null;
}

export interface NewTenant {
	slug: string;
	name: string;
	plan: string;
}

/**
 * Creates a tenant, or returns the one that already holds the slug.
 *
 * Treating 409 as success is what makes the create form safe to resubmit. The
 * form writes a tenant row and then a profile entry, and the two are separate
 * plugins with no shared transaction, so a retry after a half-finished create
 * has to be able to reach the second step.
 */
export async function ensureTenant(client: LyeveClient, input: NewTenant): Promise<Tenant> {
	try {
		return await client.request<Tenant>('admin', '/api/admin/tenants', {
			method: 'POST',
			body: JSON.stringify(input)
		});
	} catch (err) {
		if (!isStatus(err, 409)) throw err;
		const existing = await getTenantBySlug(client, input.slug);
		if (!existing) throw err;
		return existing;
	}
}

export async function listApiKeys(client: LyeveClient, tenantSlug: string): Promise<ApiKey[]> {
	const page = await client.request<Page<ApiKey>>(
		'admin',
		'/api/admin/api-keys?limit=200',
		asTenant(tenantSlug)
	);
	return page?.data ?? [];
}

export interface NewApiKey {
	name: string;
	/**
	 * A key needs scopes, not only roles. `RequireScoped` derives a
	 * `resource:action` pair from the request path and refuses a key whose scope
	 * list does not grant it, and an empty scope list grants nothing. A key with
	 * roles and no scopes authenticates and is then refused on every route it
	 * was minted for, with a 403 that says nothing about scopes.
	 *
	 * The one exception is a key carrying `admin` or `super_admin`, which is
	 * role-gated instead. Do not mint those for a customer.
	 */
	scopes: string[];
	roles?: string[];
	/** 0 means unlimited. Above 0 the usage plugin answers 429 once the month's count passes it. */
	monthly_limit?: number;
}

export async function mintApiKey(
	client: LyeveClient,
	tenantSlug: string,
	input: NewApiKey
): Promise<MintedApiKey> {
	return client.request<MintedApiKey>('admin', '/api/admin/api-keys', {
		method: 'POST',
		body: JSON.stringify({
			name: input.name,
			scopes: input.scopes,
			roles: input.roles ?? [],
			schemas: [],
			monthly_limit: input.monthly_limit ?? 0
		}),
		...asTenant(tenantSlug)
	});
}

/**
 * Disables a key without deleting it, so the audit trail keeps its name and id.
 * `DELETE /api/admin/api-keys/{id}` removes the row outright.
 */
export async function revokeApiKey(
	client: LyeveClient,
	tenantSlug: string,
	id: string
): Promise<void> {
	await client.request('admin', `/api/admin/api-keys/${id}/revoke`, {
		method: 'POST',
		...asTenant(tenantSlug)
	});
}

/** Returns null when the tenant has no quota row, which the engine reads as unlimited. */
export async function getQuota(client: LyeveClient, tenantSlug: string): Promise<Quota | null> {
	try {
		return await client.request<Quota>('admin', `/api/admin/quotas/${tenantSlug}`);
	} catch (err) {
		if (isStatus(err, 404)) return null;
		throw err;
	}
}

export interface QuotaLimits {
	requests_limit: number;
	storage_bytes_limit: number;
	bandwidth_bytes_limit: number;
	is_hard_limit: boolean;
	block_on_exceeded: boolean;
}

/** PUT is an upsert against the existing row, so seeding the same limits twice is a no-op. */
export async function upsertQuota(
	client: LyeveClient,
	tenantSlug: string,
	limits: QuotaLimits
): Promise<Quota> {
	return client.request<Quota>('admin', `/api/admin/quotas/${tenantSlug}`, {
		method: 'PUT',
		body: JSON.stringify(limits)
	});
}

export async function listQuotas(client: LyeveClient): Promise<Quota[]> {
	const page = await client.request<Page<Quota>>('admin', '/api/admin/quotas?limit=200');
	return page?.data ?? [];
}

/**
 * Live usage for one tenant.
 *
 * The engine decides whether a tenant exists here by asking whether it holds an
 * API key, so a tenant that has never been issued one answers 404 rather than a
 * row of zeros.
 */
export async function tenantUsage(
	client: LyeveClient,
	tenantSlug: string,
	period?: string
): Promise<TenantUsage | null> {
	const q = period ? `?period=${encodeURIComponent(period)}` : '';
	try {
		return await client.request<TenantUsage>('admin', `/api/admin/usage/tenant/${tenantSlug}${q}`);
	} catch (err) {
		if (isStatus(err, 404)) return null;
		throw err;
	}
}

/** Cross-tenant rollup. Never send X-Tenant-ID here: the point of the call is to span tenants. */
export async function allTenantUsage(
	client: LyeveClient,
	period?: string
): Promise<TenantUsage[]> {
	const q = period ? `?period=${encodeURIComponent(period)}` : '';
	const rows = await client.request<TenantUsage[]>('admin', `/api/admin/usage/tenants${q}`);
	return Array.isArray(rows) ? rows : [];
}

/** Freezes the period's live figures into sys_tenant_usage_snapshots. Rerunning a period overwrites it. */
export async function snapshotUsage(client: LyeveClient, period: string): Promise<number> {
	const res = await client.request<{ snapshots_created: number }>(
		'admin',
		`/api/admin/usage/snapshot?period=${encodeURIComponent(period)}`,
		{ method: 'POST', body: JSON.stringify({}) }
	);
	return res?.snapshots_created ?? 0;
}

export interface ProbeResult {
	status: number;
	verdict: string;
	rows: number | null;
}

/**
 * Spends one request from a key so the usage figures stop being theoretical.
 *
 * Metering is wired on the public router only and only for `X-API-Key` traffic:
 * the admin router never populates the key claims the meter reads, and a Bearer
 * request is not billed to any key. So a control panel cannot move its own
 * numbers by browsing, and this is the one call in the app that authenticates
 * as something other than the operator.
 *
 * `/api/v1/schemas` is the target because it is inside the scope-gated group
 * and carries no per-role permission check, which makes the answer a clean
 * statement about the key's scopes.
 */
export async function probeWithApiKey(apiUrl: string, rawKey: string): Promise<ProbeResult> {
	const res = await fetch(`${apiUrl}/api/v1/schemas`, { headers: { 'X-API-Key': rawKey } });

	let rows: number | null = null;
	if (res.ok) {
		const body = await res.json().catch(() => null);
		rows = Array.isArray(body) ? body.length : null;
	}

	return { status: res.status, rows, verdict: verdictFor(res.status) };
}

function verdictFor(status: number): string {
	switch (status) {
		case 200:
			return 'Accepted. The key authenticated, its scopes granted schemas:read, and the usage counter for this tenant moved by one.';
		case 401:
			return 'Rejected before any scope check. The key is unknown, revoked or past its expiry.';
		case 403:
			return 'Authenticated and then refused. No scope in the key grants schemas:read. Roles alone do not open a scoped route.';
		case 429:
			return 'The key spent its monthly request limit. Raise monthly_limit on the key or wait for the period to roll over.';
		default:
			return `The engine answered ${status}.`;
	}
}
