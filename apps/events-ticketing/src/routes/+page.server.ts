import { listUpcomingEvents } from '$lib/server/events';
import { placesLabel } from '$lib/format';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const events = await listUpcomingEvents();

	return {
		events: events.map((event) => ({
			id: event.id,
			title: event.title,
			slug: event.slug,
			summary: event.summary,
			venue: event.venue,
			whenLabel: event.whenLabel,
			startsAt: event.startsAt,
			coverId: event.coverId,
			capacity: event.capacity,
			registered: event.registered,
			remaining: event.remaining,
			soldOut: event.soldOut,
			places: placesLabel(event.remaining, event.capacity)
		}))
	};
};
