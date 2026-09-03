import { fail } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { lyeve } from '$lib/server/lyeve';
import { TENANT_PREFIX } from '$lib/schemas';
import { allTenantUsage, listQuotas, listTenants, snapshotUsage } from '$lib/server/platform';
import { listProfiles } from '$lib/server/profiles';
import { currentPeriod } from '$lib/format';
import type { Actions, PageServerLoad } from './$types';

const PERIOD = /^\d{4}-\d{2}$/;

export const load: PageServerLoad = async ({ url }) => {
	const requested = url.searchParams.get('period') ?? '';
	const period = PERIOD.test(requested) ? requested : currentPeriod();

	const [usage, quotas, tenants, profiles] = await Promise.all([
		allTenantUsage(lyeve, period),
		listQuotas(lyeve),
		listTenants(lyeve, 500),
		listProfiles(lyeve)
	]);

	const quotaBySlug = new Map(quotas.map((q) => [q.tenant_id, q]));
	const nameBySlug = new Map(tenants.map((t) => [t.slug, t.name]));
	const planBySlug = new Map(profiles.map((p) => [p.tenantSlug, p.planTitle]));

	// The rollup's roster is whatever holds billable data, so it includes the
	// implicit "default" tenant every unscoped request runs as. On this stack
	// that is where every other example's content lives.
	const rows = usage
		.map((row) => {
			const quota = quotaBySlug.get(row.tenant_id);
			return {
				slug: row.tenant_id,
				name: nameBySlug.get(row.tenant_id) ?? null,
				plan: planBySlug.get(row.tenant_id) ?? null,
				mine: row.tenant_id.startsWith(TENANT_PREFIX),
				implicit: row.tenant_id === 'default',
				apiCalls: row.api_calls,
				bandwidthBytes: row.bandwidth_bytes,
				storageBytes: row.storage_bytes,
				contentCount: row.content_count,
				mediaCount: row.media_count,
				requestsLimit: quota?.requests_limit ?? 0,
				storageLimit: quota?.storage_bytes_limit ?? 0,
				blocked: Boolean(quota?.blocked_at)
			};
		})
		// No sort parameter exists on the engine, so the ordering an operations
		// view wants is applied here: the biggest bill first.
		.sort((a, b) => b.apiCalls - a.apiCalls || a.slug.localeCompare(b.slug));

	return {
		period,
		rows,
		totals: {
			apiCalls: rows.reduce((sum, r) => sum + r.apiCalls, 0),
			bandwidthBytes: rows.reduce((sum, r) => sum + r.bandwidthBytes, 0),
			storageBytes: rows.reduce((sum, r) => sum + r.storageBytes, 0),
			contentCount: rows.reduce((sum, r) => sum + r.contentCount, 0)
		}
	};
};

export const actions = {
	/**
	 * Freezes the period's live figures into a billing snapshot.
	 *
	 * The live view recomputes from the counters on every read, so it moves
	 * after an invoice is cut. A snapshot is the row a bill can be argued
	 * against. Rerunning a period overwrites its snapshots rather than adding
	 * to them, so this is safe to press twice.
	 */
	snapshot: async ({ request }) => {
		const form = await request.formData();
		const period = String(form.get('period') ?? '');
		if (!PERIOD.test(period)) return fail(400, { snapshotError: 'The period must be YYYY-MM.' });

		try {
			const created = await snapshotUsage(lyeve, period);
			return { snapshotCount: created, snapshotPeriod: period };
		} catch (err) {
			return fail(502, {
				snapshotError:
					err instanceof LyeveError ? err.message : 'The engine refused to write the snapshots.'
			});
		}
	}
} satisfies Actions;
