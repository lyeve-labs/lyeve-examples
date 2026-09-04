import { DSAR_ACTIONS, DSAR_RESOURCE_TYPE, isMasked, loadAudit } from '$lib/server/audit';
import type { PageServerLoad } from './$types';

const PAGE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const action = url.searchParams.get('action') ?? '';
	const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
	const known = (DSAR_ACTIONS as readonly string[]).includes(action) ? action : '';

	// resource_type is the filter that catches both DSAR actions in one read.
	// Naming an action as well narrows it further. Naming a parameter the route
	// does not know would return the whole log and look like a filter that
	// matched everything.
	const page = await loadAudit({
		resourceType: DSAR_RESOURCE_TYPE,
		action: known || undefined,
		limit: PAGE,
		offset
	});

	return {
		action: known,
		actions: DSAR_ACTIONS,
		resourceType: DSAR_RESOURCE_TYPE,
		total: page.total,
		limit: page.limit,
		offset: page.offset,
		pendingWrites: page.pendingWrites,
		entries: page.entries.map((e) => ({
			id: e.id,
			sequence: e.sequence,
			action: e.action,
			createdAt: e.createdAt,
			userId: e.userId,
			tenantId: e.tenantId,
			subject: e.resourceId,
			subjectMasked: isMasked(e.resourceId),
			ip: e.ip,
			ipMasked: isMasked(e.ip.split(':')[0] ?? ''),
			userAgent: e.userAgent,
			chainHash: e.chainHash
		}))
	};
};
