import { loadRequests } from '$lib/server/requests';
import { REQUEST_STATES, daysBetween } from '$lib/desk';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const requests = await loadRequests();
	const now = new Date().toISOString();

	// The engine returns rows created_at DESC and offers no sort parameter, so
	// grouping and ordering by deadline both happen here. One read covers every
	// column. Asking per state would be one request per column and the same
	// rows.
	return {
		columns: REQUEST_STATES.map((state) => ({
			state,
			requests: requests
				.filter((r) => r.state === state)
				.map((r) => ({
					slug: r.slug,
					title: r.title,
					type: r.type,
					subjectName: r.subjectName,
					handlerName: r.handlerName,
					daysLeft: daysBetween(now, r.dueAt),
					receivedAt: r.receivedAt
				}))
		}))
	};
};
