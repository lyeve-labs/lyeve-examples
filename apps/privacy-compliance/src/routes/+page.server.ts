import { loadRecentActions, loadRequests } from '$lib/server/requests';
import { loadDsarCounts } from '$lib/server/audit';
import { whoami } from '$lib/server/operator';
import { REQUEST_STATES, REQUEST_TYPES, daysBetween, isOpen } from '$lib/desk';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// The counts come from three separate audit reads because `action` is exact
	// equality with no group-by. They are cheap enough to run beside the
	// register read and they are the only place the engine's own view of this
	// desk's work is visible.
	const [requests, actions, dsarCounts, operator] = await Promise.all([
		loadRequests(),
		loadRecentActions(6),
		loadDsarCounts(),
		whoami()
	]);

	const now = new Date().toISOString();
	const open = requests.filter((r) => isOpen(r.state));

	return {
		operator: { email: operator.email, roles: operator.roles },
		totals: {
			all: requests.length,
			open: open.length,
			overdue: open.filter((r) => Date.parse(r.dueAt) < Date.now()).length
		},
		byState: REQUEST_STATES.map((state) => ({
			state,
			count: requests.filter((r) => r.state === state).length
		})),
		byType: REQUEST_TYPES.map((type) => ({
			type,
			count: requests.filter((r) => r.type === type).length
		})),
		dsarCounts,
		queue: open.slice(0, 6).map((r) => ({
			slug: r.slug,
			title: r.title,
			type: r.type,
			state: r.state,
			handlerName: r.handlerName,
			daysLeft: daysBetween(now, r.dueAt)
		})),
		actions: actions.map((a) => ({
			id: a.id,
			kind: a.kind,
			outcome: a.outcome,
			subjectDigest: a.subjectDigest,
			rowsAffected: a.rowsAffected,
			recordCount: a.recordCount,
			ranAt: a.ranAt
		}))
	};
};
