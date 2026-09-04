import { error, fail } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { lyeve, NOTICES } from '$lib/server/lyeve';
import { findKey, keyAudit, setMonthlyLimit } from '$lib/server/keys';
import { keyUsage } from '$lib/server/metering';
import { grants, requiredScope } from '$lib/scopes';
import { currentPeriod } from '$lib/format';
import type { Actions, PageServerLoad } from './$types';

/**
 * The routes worth checking a key against, with the scope each one derives.
 *
 * `scopeGated: false` marks a route the engine authenticates and then does not
 * scope-check. The quota status route is declared in the plugin's
 * authenticated group rather than its scoped one, so a key with no scopes at
 * all gets an answer there while being refused on content. Nothing in the
 * response says so, which is why it is stated here.
 */
const PROBES = [
	{ method: 'GET', path: `/api/v1/content/${NOTICES}`, scopeGated: true },
	{ method: 'GET', path: `/api/v1/content/${NOTICES}/cursor`, scopeGated: true },
	{ method: 'GET', path: '/api/v1/schemas', scopeGated: true },
	{ method: 'GET', path: '/api/v1/quotas/status', scopeGated: false },
	{ method: 'POST', path: `/api/v1/content/${NOTICES}`, scopeGated: true },
	{ method: 'DELETE', path: `/api/v1/content/${NOTICES}/{id}`, scopeGated: true },
	{ method: 'GET', path: '/api/admin/media', scopeGated: true },
	{ method: 'GET', path: '/api/admin/api-keys', scopeGated: true }
];

export const load: PageServerLoad = async ({ params }) => {
	const period = currentPeriod();
	const key = await findKey(lyeve, params.id);
	if (!key) error(404, 'No key with that id in this tenant');

	const [usage, audit] = await Promise.all([
		keyUsage(lyeve, key.id, period).catch(() => null),
		keyAudit(lyeve, key.id, 50).catch(() => null)
	]);

	const scopes = key.scopes ?? [];

	return {
		period,
		key: {
			id: key.id,
			name: key.name,
			scopes,
			roles: key.roles ?? [],
			schemas: key.schemas ?? [],
			enabled: key.enabled,
			monthlyLimit: key.monthly_limit,
			createdAt: key.created_at,
			expiresAt: key.expires_at ?? null,
			tenant: key.tenant_id ?? ''
		},
		usage: usage && {
			requests: usage.requests,
			bytesIn: usage.bytes_in,
			bytesOut: usage.bytes_out
		},
		// Null means the engine answered 404 for the trail, which happens when
		// the key was deleted between the two calls.
		audit:
			audit &&
			audit.map((entry) => ({
				id: entry.id,
				method: entry.method,
				path: entry.path,
				status: entry.status,
				ip: entry.ip,
				ts: entry.ts
			})),
		probes: PROBES.map((probe) => {
			const required = requiredScope(probe.method, probe.path);
			return {
				method: probe.method,
				path: probe.path,
				required,
				scopeGated: probe.scopeGated,
				allowed: probe.scopeGated ? grants(scopes, required) : true
			};
		})
	};
};

export const actions = {
	/**
	 * Changes the key's monthly cap.
	 *
	 * This is the recovery path once a key has spent its month: the counter is
	 * not resettable through any route, so raising the limit is how a key comes
	 * back before the period rolls over.
	 */
	limit: async ({ request, params }) => {
		const form = await request.formData();
		const raw = String(form.get('monthly_limit') ?? '').trim();
		const monthlyLimit = Number(raw);

		if (!Number.isInteger(monthlyLimit) || monthlyLimit < 0) {
			return fail(400, { limitError: 'The monthly limit must be a whole number. Zero means unlimited.' });
		}

		try {
			const updated = await setMonthlyLimit(lyeve, params.id, monthlyLimit);
			return { limitSet: updated.monthly_limit };
		} catch (err) {
			return fail(502, {
				limitError:
					err instanceof LyeveError ? err.message : 'The engine refused to change the limit.'
			});
		}
	}
} satisfies Actions;
