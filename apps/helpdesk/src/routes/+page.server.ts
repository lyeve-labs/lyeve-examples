import { loadInbox, loadReplyCounts, sortForQueue } from '$lib/server/tickets';
import type { PageServerLoad } from './$types';

const VIEWS = ['active', 'open', 'pending', 'closed'] as const;
type View = (typeof VIEWS)[number];

export const load: PageServerLoad = async ({ url }) => {
	const requested = url.searchParams.get('view') ?? '';
	const view: View = (VIEWS as readonly string[]).includes(requested)
		? (requested as View)
		: 'active';

	const [inbox, replies] = await Promise.all([loadInbox(), loadReplyCounts()]);

	// "Active" is the view the engine cannot express. filters[] does equality
	// and nothing else, so open and pending are two exact queries stitched back
	// together here.
	const queue = view === 'active' ? sortForQueue([...inbox.open, ...inbox.pending]) : inbox[view];

	return {
		view,
		tickets: queue.map((ticket) => ({ ...ticket, replies: replies[ticket.id] ?? 0 })),
		counts: {
			active: inbox.open.length + inbox.pending.length,
			open: inbox.open.length,
			pending: inbox.pending.length,
			closed: inbox.closed.length
		}
	};
};
