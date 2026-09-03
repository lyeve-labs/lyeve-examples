import { error, fail } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { API_URL, lyeve } from '$lib/server/lyeve';
import {
	getQuota,
	getTenantBySlug,
	listApiKeys,
	mintApiKey,
	probeWithApiKey,
	revokeApiKey,
	tenantUsage
} from '$lib/server/platform';
import { getProfile } from '$lib/server/profiles';
import type { Actions, PageServerLoad } from './$types';

/**
 * The scopes this console offers when minting a key.
 *
 * There is no scope catalog on the engine to read this from. A scope is a
 * `resource:action` pair derived from the request path, so the list of scopes
 * that matter is the list of routes the customer is meant to call.
 */
const OFFERED_SCOPES = [
	{ value: 'content:read', label: 'Read content', hint: 'GET /api/v1/content/...' },
	{ value: 'content:write', label: 'Write content', hint: 'POST and PUT /api/v1/content/...' },
	{ value: 'schemas:read', label: 'Read schemas', hint: 'GET /api/v1/schemas' },
	{ value: 'media:read', label: 'Read media', hint: 'GET /api/v1/media/...' }
];

export const load: PageServerLoad = async ({ params }) => {
	const tenant = await getTenantBySlug(lyeve, params.slug);
	if (!tenant) error(404, 'No such tenant');

	const [profile, keys, quota, usage] = await Promise.all([
		getProfile(lyeve, tenant.slug),
		listApiKeys(lyeve, tenant.slug),
		getQuota(lyeve, tenant.slug),
		tenantUsage(lyeve, tenant.slug)
	]);

	return {
		tenant: {
			id: tenant.id,
			slug: tenant.slug,
			name: tenant.name,
			plan: tenant.plan,
			enabled: tenant.enabled,
			archived: tenant.archived,
			createdAt: tenant.created_at
		},
		profile,
		scopeOptions: OFFERED_SCOPES,
		keys: keys.map((key) => ({
			id: key.id,
			name: key.name,
			scopes: key.scopes ?? [],
			roles: key.roles ?? [],
			enabled: key.enabled,
			monthlyLimit: key.monthly_limit,
			createdAt: key.created_at,
			expiresAt: key.expires_at ?? null,
			// Worth showing: a key whose tenant_id is not this tenant would be
			// invisible on this page, because the column is the isolation.
			tenantId: key.tenant_id
		})),
		quota: quota
			? {
					requestsLimit: quota.requests_limit,
					storageLimit: quota.storage_bytes_limit,
					bandwidthLimit: quota.bandwidth_bytes_limit,
					isHardLimit: quota.is_hard_limit,
					blockOnExceeded: quota.block_on_exceeded,
					blockedAt: quota.blocked_at
				}
			: null,
		usage: usage
			? {
					period: usage.billing_period,
					apiCalls: usage.api_calls,
					storageBytes: usage.storage_bytes,
					bandwidthBytes: usage.bandwidth_bytes,
					contentCount: usage.content_count,
					mediaCount: usage.media_count
				}
			: null
	};
};

export const actions = {
	/**
	 * Mints a key for this tenant.
	 *
	 * Two things decide where the key lands and what it can do, and neither is
	 * in the request body. The tenant comes from the X-Tenant-ID header the
	 * helper sets, because the engine stamps the key with the tenant the request
	 * resolved to. The reach comes from the scopes: a key with roles and an
	 * empty scope list authenticates and is then refused on every scoped route,
	 * with a 403 that never mentions scopes.
	 */
	mint: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const scopes = form.getAll('scopes').map(String).filter(Boolean);
		const monthlyLimit = Number(form.get('monthly_limit') ?? 0);

		if (!name) return fail(400, { mintError: 'Name the key after the integration that will hold it.' });
		if (scopes.length === 0) {
			return fail(400, {
				mintError:
					'Choose at least one scope. A key with no scopes authenticates and is then refused everywhere.'
			});
		}
		if (!Number.isInteger(monthlyLimit) || monthlyLimit < 0) {
			return fail(400, { mintError: 'The monthly request limit must be zero or a positive whole number.' });
		}

		try {
			const key = await mintApiKey(lyeve, params.slug, {
				name,
				scopes,
				monthly_limit: monthlyLimit
			});
			return {
				minted: {
					id: key.id,
					name: key.name,
					scopes: key.scopes ?? scopes,
					// The engine returns the secret exactly once. Every later read
					// answers with the hash, so this is the only moment it exists
					// outside the customer's own configuration.
					rawKey: key.raw_key
				}
			};
		} catch (err) {
			return fail(502, {
				mintError: err instanceof LyeveError ? err.message : 'The engine refused to mint the key.'
			});
		}
	},

	/** Disables the key and keeps the row, so the name and id survive in the audit trail. */
	revoke: async ({ request, params }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { revokeError: 'Which key?' });

		try {
			await revokeApiKey(lyeve, params.slug, id);
		} catch (err) {
			return fail(502, {
				revokeError: err instanceof LyeveError ? err.message : 'The engine refused to revoke the key.'
			});
		}
		return { revoked: id };
	},

	/**
	 * Spends one request from a key the operator pastes in.
	 *
	 * The key is used once and never stored or logged. This is the only way to
	 * move the usage figures: metering runs on the public router for X-API-Key
	 * traffic alone, so nothing this console does with its own session is ever
	 * billed to a tenant.
	 */
	probe: async ({ request }) => {
		const form = await request.formData();
		const rawKey = String(form.get('key') ?? '').trim();
		if (!rawKey) return fail(400, { probeError: 'Paste a key to send one request with it.' });

		try {
			return { probe: await probeWithApiKey(API_URL, rawKey) };
		} catch {
			return fail(502, { probeError: 'The public API did not answer.' });
		}
	}
} satisfies Actions;
