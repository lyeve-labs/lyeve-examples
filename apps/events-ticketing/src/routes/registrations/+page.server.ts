import { listRegistrations } from '$lib/server/events';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Newest first, which is the one order the engine does give you: rows come
	// back created_at DESC and there is no sort parameter to ask for another.
	const registrations = await listRegistrations();

	return {
		registrations: registrations.map((row) => ({
			id: row.id,
			name: row.name,
			registeredAt: row.registeredAt,
			registeredLabel: row.registeredLabel,
			eventTitle: row.eventTitle,
			eventSlug: row.eventSlug
		}))
	};
};
