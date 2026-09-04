import { fail } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { isIncidentState, isSeverity, type IncidentState } from '$lib/board';
import {
	addUpdate,
	findIncidentBySlug,
	listServices,
	loadBoard,
	openIncident
} from '$lib/server/board';
import type { Actions, PageServerLoad } from './$types';

/**
 * One shape for all three actions, so the page reads `form?.error` without
 * narrowing a union of three unrelated payloads first.
 */
interface OpsForm {
	error?: string;
	done?: string;
	title?: string;
	summary?: string;
}

const accepted = (result: OpsForm): OpsForm => result;
const rejected = (status: number, result: OpsForm) => fail(status, result);

export const load: PageServerLoad = async () => {
	const board = await loadBoard();
	return {
		services: board.services,
		open: board.incidents.filter((i) => i.state !== 'resolved')
	};
};

export const actions: Actions = {
	/**
	 * Opens an incident.
	 *
	 * Nothing here notifies the board. The write goes to the admin router, the
	 * engine publishes the lifecycle event on its own hook bus, and every
	 * connected browser's stream picks it up. That is the point of the example:
	 * this action does not know that anyone is watching.
	 */
	open: async ({ request }) => {
		const form = await request.formData();
		const serviceId = String(form.get('service_id') ?? '');
		const title = String(form.get('title') ?? '').trim();
		const summary = String(form.get('summary') ?? '').trim();
		const severity = form.get('severity');

		if (!isSeverity(severity)) return rejected(400, { error: 'Pick a severity.' });
		if (!title) return rejected(400, { error: 'An incident needs a headline.', summary });
		if (!summary) return rejected(400, { error: 'Say what is happening.', title });

		const services = await listServices();
		if (!services.some((s) => s.id === serviceId)) {
			return rejected(400, { error: 'Pick a service.', title, summary });
		}

		try {
			await openIncident({ serviceId, title, summary, severity });
		} catch (err) {
			return rejected(502, {
				error: describe(err, 'The incident was not opened.'),
				title,
				summary
			});
		}
		return accepted({ done: 'Incident opened.' });
	},

	update: async ({ request }) => post(request, false),

	resolve: async ({ request }) => post(request, true)
};

/**
 * Files a timeline entry and moves the incident to that state.
 *
 * Resolving is the same operation with the state fixed, because a status page
 * that lets an incident close without a closing sentence is a status page
 * nobody trusts.
 */
async function post(request: Request, resolving: boolean) {
	const form = await request.formData();
	const slug = String(form.get('slug') ?? '');
	const summary = String(form.get('summary') ?? '').trim();
	const requested = form.get('state');
	const state: IncidentState | null = resolving
		? 'resolved'
		: isIncidentState(requested)
			? requested
			: null;

	if (!state) return rejected(400, { error: 'Pick a state.' });
	if (!summary) return rejected(400, { error: 'An update needs a sentence.' });

	const incident = await findIncidentBySlug(slug);
	if (!incident) return rejected(404, { error: 'That incident is gone.' });

	try {
		await addUpdate(incident, state, summary);
	} catch (err) {
		return rejected(502, { error: describe(err, 'The update was not saved.') });
	}
	return accepted({ done: resolving ? 'Incident resolved.' : 'Update posted.' });
}

/**
 * A rejected write comes back as a 422 carrying field errors and no top-level
 * message, and everything else as a message with a request id. The field error
 * is the one an operator can act on, so it wins when there is one.
 */
function describe(err: unknown, fallback: string): string {
	if (!(err instanceof LyeveError)) return fallback;
	return err.fieldErrors[0]?.message || err.message || fallback;
}
