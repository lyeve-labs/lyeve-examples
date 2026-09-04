import { LyeveError, type LyeveClient } from '$lib/lyeve';

/**
 * The API key lifecycle, as the apikey plugin actually exposes it.
 *
 * Every route here is on the admin router and needs an operator session, so
 * this module is server-only by construction. The published SDK covers three
 * of these calls and its create type has no `scopes` field at all, which is
 * why they are posted by hand: a key minted without scopes authenticates and
 * is then refused on every scope-gated route it was minted for.
 */

/** Plugin admin lists answer with this envelope. The public content route does not. */
interface Page<T> {
	data: T[];
	total_count: number;
	limit: number;
	offset: number;
}

export interface ApiKey {
	id: string;
	name: string;
	roles: string[];
	/** Stored and echoed back, and read by nothing. See the README. */
	schemas: string[];
	scopes: string[];
	tenant_id?: string;
	enabled: boolean;
	monthly_limit: number;
	created_at: string;
	expires_at?: string | null;
}

/** The only response that ever carries the secret. Every read returns the hash. */
export interface MintedApiKey extends ApiKey {
	raw_key: string;
}

export interface AuditEntry {
	id: string;
	api_key_id: string;
	method: string;
	path: string;
	status: number;
	ip: string;
	ts: string;
}

function isStatus(err: unknown, status: number): boolean {
	return err instanceof LyeveError && err.status === status;
}

/** Newest first, which is the order the store returns. */
export async function listKeys(client: LyeveClient, limit = 200): Promise<ApiKey[]> {
	const page = await client.request<Page<ApiKey>>('admin', `/api/admin/api-keys?limit=${limit}`);
	return page?.data ?? [];
}

/**
 * There is no get-by-id route for a key, so this filters the listing. The
 * listing is bounded: the plugin caps a page at 500 rows.
 */
export async function findKey(client: LyeveClient, id: string): Promise<ApiKey | null> {
	const keys = await listKeys(client, 500);
	return keys.find((k) => k.id === id) ?? null;
}

export interface MintInput {
	name: string;
	/**
	 * The whole credential. An empty list is fail-closed: the engine denies
	 * every scope-gated route rather than defaulting to read.
	 */
	scopes: string[];
	/** 0 is unlimited. Above 0 the usage plugin answers 429 past the month's count. */
	monthlyLimit?: number;
	/** RFC 3339, or null for a key that never expires. */
	expiresAt?: string | null;
}

/**
 * Mints a key with scopes and deliberately no roles.
 *
 * A role is not a smaller version of a scope. RequireScoped waves through any
 * key holding admin or super_admin, and requireRole waves through any key
 * holding no roles at all, so a role on a machine credential removes the scope
 * check instead of narrowing it. This console never offers one.
 */
export async function mintKey(client: LyeveClient, input: MintInput): Promise<MintedApiKey> {
	return client.request<MintedApiKey>('admin', '/api/admin/api-keys', {
		method: 'POST',
		body: JSON.stringify({
			name: input.name,
			roles: [],
			schemas: [],
			scopes: input.scopes,
			monthly_limit: input.monthlyLimit ?? 0,
			expires_at: input.expiresAt ?? null
		})
	});
}

/** Disables the key and keeps the row, so the audit trail keeps its name. */
export async function revokeKey(client: LyeveClient, id: string): Promise<void> {
	await client.request('admin', `/api/admin/api-keys/${id}/revoke`, {
		method: 'POST',
		body: JSON.stringify({})
	});
}

/**
 * Removes the row outright, and with it the history.
 *
 * Both sys_api_usage and sys_api_key_audit reference the key with ON DELETE
 * CASCADE, so deleting a key erases its meter rows and its request trail. The
 * tenant rollup joins usage to keys, so the tenant's recorded api_calls for
 * the period drops by whatever the deleted key had spent. Revoke keeps all of
 * it and is the right call for a credential that leaked.
 */
export async function deleteKey(client: LyeveClient, id: string): Promise<void> {
	await client.request('admin', `/api/admin/api-keys/${id}`, { method: 'DELETE' });
}

export async function setMonthlyLimit(
	client: LyeveClient,
	id: string,
	monthlyLimit: number
): Promise<ApiKey> {
	return client.request<ApiKey>('admin', `/api/admin/api-keys/${id}/monthly-limit`, {
		method: 'PATCH',
		body: JSON.stringify({ monthly_limit: monthlyLimit })
	});
}

/**
 * The per-request trail for one key, newest first.
 *
 * This route answers with a bare array while the sibling listing answers with
 * an envelope, so both shapes are accepted rather than assumed. Only requests
 * that got past the scope check appear here: the audit middleware is mounted
 * after RequireScoped, so a refusal is metered and never recorded.
 */
export async function keyAudit(
	client: LyeveClient,
	id: string,
	limit = 50
): Promise<AuditEntry[] | null> {
	try {
		const body = await client.request<AuditEntry[] | Page<AuditEntry>>(
			'admin',
			`/api/admin/api-keys/${id}/audit?limit=${limit}`
		);
		if (Array.isArray(body)) return body;
		return body?.data ?? [];
	} catch (err) {
		if (isStatus(err, 404)) return null;
		throw err;
	}
}
