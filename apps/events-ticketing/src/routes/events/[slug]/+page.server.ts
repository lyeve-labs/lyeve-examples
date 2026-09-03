import { error, fail } from '@sveltejs/kit';
import { loadEvent, register, registrationsForEvent } from '$lib/server/events';
import { placesLabel } from '$lib/format';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const event = await loadEvent(params.slug);
	if (!event) error(404, 'No such event');

	const signUps = await registrationsForEvent(event.id);

	return {
		event: {
			title: event.title,
			slug: event.slug,
			summary: event.summary,
			body: event.body,
			venue: event.venue,
			startsAt: event.startsAt,
			whenLabel: event.whenLabel,
			coverId: event.coverId,
			capacity: event.capacity,
			registered: event.registered,
			remaining: event.remaining,
			soldOut: event.soldOut,
			places: placesLabel(event.remaining, event.capacity),
			closed: event.startsAtMs < Date.now()
		},
		signUps: signUps.map((row) => ({
			id: row.id,
			name: row.name,
			registeredAt: row.registeredAt,
			registeredLabel: row.registeredLabel
		})),
		// The counter can only fall behind the rows when an increment was lost, so
		// this is the read-modify-write hole showing through. The other direction
		// means nothing: the seed starts each event with places already sold and no
		// rows behind them.
		counterBehind: signUps.length > event.registered
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();

		const outcome = await register(params.slug, name, email);
		if (!outcome.ok) {
			return fail(outcome.status, { name, email, error: outcome.message });
		}

		return {
			name,
			remaining: outcome.remaining,
			counterUpdated: outcome.counterUpdated
		};
	}
};
