import { lyeve, TENANT } from '$lib/server/lyeve';
import { listKeys } from '$lib/server/keys';
import { getQuota, keyUsage, quotaStatus, tenantUsage } from '$lib/server/metering';
import { currentPeriod } from '$lib/format';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const period = currentPeriod();

	const [quota, status, rollup, keys] = await Promise.all([
		getQuota(lyeve, TENANT),
		quotaStatus(lyeve),
		tenantUsage(lyeve, TENANT, period),
		listKeys(lyeve)
	]);

	const perKey = await Promise.all(keys.map((k) => keyUsage(lyeve, k.id, period).catch(() => null)));

	return {
		period,
		tenant: TENANT,
		quota: quota && {
			requestsLimit: quota.requests_limit,
			storageLimit: quota.storage_bytes_limit,
			bandwidthLimit: quota.bandwidth_bytes_limit,
			isHardLimit: quota.is_hard_limit,
			blockOnExceeded: quota.block_on_exceeded,
			gracePeriodHours: quota.grace_period_hours,
			blockedAt: quota.blocked_at,
			updatedAt: quota.updated_at
		},
		status: status.status && {
			requestsUsed: status.status.requests_used,
			requestsLimit: status.status.requests_limit,
			requestsPct: status.status.requests_pct,
			isBlocked: status.status.is_blocked,
			isExceeded: status.status.is_exceeded,
			isWarning80: status.status.is_warning_80,
			isWarning90: status.status.is_warning_90
		},
		headers: status.headers,
		rollup: rollup && {
			apiCalls: rollup.api_calls,
			bandwidthBytes: rollup.bandwidth_bytes,
			storageBytes: rollup.storage_bytes,
			contentCount: rollup.content_count,
			mediaCount: rollup.media_count
		},
		keys: keys
			.map((key, i) => ({
				id: key.id,
				name: key.name,
				enabled: key.enabled,
				monthlyLimit: key.monthly_limit,
				requests: perKey[i]?.requests ?? 0,
				bytesOut: perKey[i]?.bytes_out ?? 0
			}))
			// The engine has no sort parameter, so the order an operator wants
			// is applied here: the busiest key first.
			.sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name))
	};
};
