import { quotaRequestCount, quotaStatus, quotas, tenantBreakdown, tenantUsage } from '$lib/server/telemetry';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [usage, quotaRows, status, requests, traffic] = await Promise.all([
		tenantUsage(),
		quotas(),
		quotaStatus(),
		quotaRequestCount(),
		tenantBreakdown(25)
	]);

	// The usage plugin's api_calls counter is written only for API-key traffic,
	// while apianalytics records every request. Pairing them per tenant is what
	// makes the gap visible instead of leaving api_calls looking like an outage.
	const measured = new Map(traffic.value.map((row) => [row.key, row.request_count]));

	return {
		usage: usage.value.map((row) => ({
			...row,
			requestsMeasured: measured.get(row.tenant_id) ?? 0
		})),
		liveProvenance: usage.live,
		meteredProvenance: usage.metered,
		quotas: quotaRows.value,
		quotasProvenance: quotaRows.provenance,
		status: status.value,
		statusProvenance: status.provenance,
		requestCount: requests.value,
		requestProvenance: requests.provenance
	};
};
