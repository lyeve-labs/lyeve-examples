import { error, fail } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { isTicketStatus } from '$lib/desk';
import { addReply, loadThread, loadTicket, setTicketStatus } from '$lib/server/tickets';
import type { Actions, PageServerLoad } from './$types';

/**
 * One shape for both actions, so the page reads `form?.replyError` without
 * narrowing a union of two unrelated payloads first.
 */
interface DeskForm {
	replyError?: string;
	replied?: boolean;
	statusError?: string;
	authorName?: string;
	body?: string;
}

export const load: PageServerLoad = async ({ params }) => {
	const ticket = await loadTicket(params.slug);
	if (!ticket) error(404, 'No such ticket');

	return { ticket, thread: await loadThread(ticket.id) };
};

export const actions: Actions = {
	reply: async ({ request, params }) => {
		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();
		const authorName = String(form.get('author_name') ?? '').trim();
		const role = form.get('role') === 'requester' ? 'requester' : 'agent';

		if (!authorName) return rejected(400, { replyError: 'Say who is replying.', body });
		if (!body) return rejected(400, { replyError: 'A reply needs a message.', authorName });

		const ticket = await loadTicket(params.slug);
		if (!ticket) error(404, 'No such ticket');

		try {
			await addReply(ticket, { body, authorName, role });
		} catch (err) {
			return rejected(502, {
				replyError: describe(err, 'The reply was not saved.'),
				authorName,
				body
			});
		}

		return accepted({ replied: true });
	},

	status: async ({ request, params }) => {
		const form = await request.formData();
		const next = form.get('status');
		if (!isTicketStatus(next)) return rejected(400, { statusError: 'Unknown status.' });

		const ticket = await loadTicket(params.slug);
		if (!ticket) error(404, 'No such ticket');
		if (ticket.status === next) return accepted({});

		try {
			await setTicketStatus(ticket, next);
		} catch (err) {
			return rejected(502, { statusError: describe(err, 'The status was not changed.') });
		}

		return accepted({});
	}
};

const accepted = (result: DeskForm): DeskForm => result;
const rejected = (status: number, result: DeskForm) => fail(status, result);

/**
 * A rejected write comes back as a 422 carrying field errors and no top-level
 * message, and everything else as a message with a request id. An agent can act
 * on the field error, so it wins when there is one.
 */
function describe(err: unknown, fallback: string): string {
	if (!(err instanceof LyeveError)) return fallback;
	return err.fieldErrors[0]?.message || err.message || fallback;
}
