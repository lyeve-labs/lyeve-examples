import { fail, redirect } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { isTicketPriority, type TicketPriority } from '$lib/desk';
import { createTicket } from '$lib/server/tickets';
import type { Actions } from './$types';

// The engine stores requester_email in a text column, so the address is only
// as good as this check. Matching the shape the engine's own email columns
// enforce keeps a ticket portable if the field is ever retyped.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const values = {
			requesterName: String(form.get('requester_name') ?? '').trim(),
			requesterEmail: String(form.get('requester_email') ?? '').trim(),
			subject: String(form.get('subject') ?? '').trim(),
			body: String(form.get('body') ?? '').trim(),
			priority: String(form.get('priority') ?? 'normal')
		};

		if (!values.requesterName) return fail(400, { ...values, message: 'Tell us who you are.' });
		if (!EMAIL.test(values.requesterEmail))
			return fail(400, { ...values, message: 'That email address does not look right.' });
		if (!values.subject) return fail(400, { ...values, message: 'A ticket needs a subject.' });
		if (!values.body) return fail(400, { ...values, message: 'Describe what went wrong.' });

		const priority: TicketPriority = isTicketPriority(values.priority) ? values.priority : 'normal';

		let slug: string;
		try {
			slug = await createTicket({ ...values, priority });
		} catch (err) {
			const message =
				err instanceof LyeveError
					? (err.fieldErrors[0]?.message ?? err.message)
					: 'The ticket was not saved.';
			return fail(502, { ...values, message });
		}

		redirect(303, `/tickets/${slug}`);
	}
};
