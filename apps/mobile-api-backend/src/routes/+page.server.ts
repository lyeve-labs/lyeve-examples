import { fail } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { lyeve, PUBLIC_API_URL, TENANT } from '$lib/server/lyeve';
import { deleteKey, listKeys, mintKey, revokeKey } from '$lib/server/keys';
import { keyUsage } from '$lib/server/metering';
import { SCOPE_CHOICES } from '$lib/scopes';
import { currentPeriod } from '$lib/format';
import type { Actions, PageServerLoad } from './$types';

const KNOWN_SCOPES = new Set(SCOPE_CHOICES.map((c) => c.scope));

export const load: PageServerLoad = async () => {
	const period = currentPeriod();
	const keys = await listKeys(lyeve);

	// Per-key metering is a separate route per key, so this fans out. The
	// listing itself carries no counters at all.
	const usage = await Promise.all(keys.map((k) => keyUsage(lyeve, k.id, period).catch(() => null)));
	const now = Date.now();

	return {
		period,
		tenant: TENANT,
		apiUrl: PUBLIC_API_URL,
		scopeChoices: SCOPE_CHOICES,
		keys: keys.map((key, i) => ({
			id: key.id,
			name: key.name,
			scopes: key.scopes ?? [],
			roles: key.roles ?? [],
			enabled: key.enabled,
			monthlyLimit: key.monthly_limit,
			createdAt: key.created_at,
			expiresAt: key.expires_at ?? null,
			expired: Boolean(key.expires_at && new Date(key.expires_at).getTime() < now),
			requests: usage[i]?.requests ?? 0,
			bytesOut: usage[i]?.bytes_out ?? 0
		}))
	};
};

function engineMessage(err: unknown, fallback: string): string {
	return err instanceof LyeveError ? err.message : fallback;
}

export const actions = {
	/**
	 * Mints a key and hands the secret back exactly once.
	 *
	 * The raw key is in the action's return value and nowhere else. It is not
	 * written to the database, not kept in a cookie and not recoverable: the
	 * engine stores a peppered HMAC of it and the create response is the only
	 * time the plaintext exists outside the phone.
	 */
	mint: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const scopes = form.getAll('scopes').map(String).filter((s) => KNOWN_SCOPES.has(s));
		const rawLimit = String(form.get('monthly_limit') ?? '0').trim();
		const expiryDays = String(form.get('expiry_days') ?? '').trim();

		if (!name) return fail(400, { mintError: 'The key needs a name. It is what the audit trail shows.' });
		if (name.length > 200) return fail(400, { mintError: 'Keep the name under 200 characters.' });
		if (scopes.length === 0) {
			return fail(400, {
				mintError:
					'Pick at least one scope. An empty scope list is fail-closed: the key would authenticate and then be refused on every route it was minted for.'
			});
		}

		const monthlyLimit = Number(rawLimit);
		if (!Number.isInteger(monthlyLimit) || monthlyLimit < 0) {
			return fail(400, { mintError: 'The monthly limit must be a whole number. Zero means unlimited.' });
		}

		let expiresAt: string | null = null;
		if (expiryDays) {
			const days = Number(expiryDays);
			if (!Number.isInteger(days) || days < 1 || days > 3650) {
				return fail(400, { mintError: 'An expiry is between 1 and 3650 days, or blank for none.' });
			}
			expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
		}

		try {
			const key = await mintKey(lyeve, { name, scopes, monthlyLimit, expiresAt });
			return {
				minted: {
					id: key.id,
					name: key.name,
					rawKey: key.raw_key,
					scopes: key.scopes ?? scopes,
					monthlyLimit: key.monthly_limit,
					expiresAt: key.expires_at ?? null
				}
			};
		} catch (err) {
			return fail(502, { mintError: engineMessage(err, 'The engine refused to mint the key.') });
		}
	},

	revoke: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { rowError: 'No key id was submitted.' });

		try {
			await revokeKey(lyeve, id);
			return { revoked: id };
		} catch (err) {
			return fail(502, { rowError: engineMessage(err, 'The engine refused to revoke the key.') });
		}
	},

	remove: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { rowError: 'No key id was submitted.' });

		try {
			await deleteKey(lyeve, id);
			return { removed: id };
		} catch (err) {
			return fail(502, { rowError: engineMessage(err, 'The engine refused to delete the key.') });
		}
	}
} satisfies Actions;
