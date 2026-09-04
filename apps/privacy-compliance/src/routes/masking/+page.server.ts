import { loadAccessLog, loadRules, summarizePiiTypes } from '$lib/server/masking';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);

	const [ruleSet, log] = await Promise.all([loadRules(), loadAccessLog(25, offset)]);

	return {
		rules: ruleSet.rules,
		tags: ruleSet.tags,
		selfMasked: ruleSet.selfMasked,
		log: {
			total: log.total,
			limit: log.limit,
			offset: log.offset,
			entries: log.entries.map((e) => ({
				id: e.id,
				viewerRole: e.viewerRole,
				viewerUserId: e.viewerUserId,
				accessedAt: e.accessedAt,
				tenantId: e.tenantId,
				types: summarizePiiTypes(e.piiTypes),
				matches: e.piiTypes.length
			}))
		}
	};
};
