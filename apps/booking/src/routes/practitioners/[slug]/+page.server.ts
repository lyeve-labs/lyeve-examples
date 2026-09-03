import { error } from '@sveltejs/kit';
import { getPractitionerBySlug, isBookable, listSlots, upcoming } from '$lib/server/booking';
import { endTimeLabel, groupByDay, timeLabel } from '$lib/schedule';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const person = await getPractitionerBySlug(params.slug);
	if (!person) error(404, 'No such practitioner');

	// Filtering by the FK column keeps the whole diary off the wire. It is exact
	// equality, which is all a relation lookup needs, and the only filter the
	// engine has: there is no range operator, so "this week only" is decided
	// here rather than in the query.
	const slots = upcoming(await listSlots(person.id));

	return {
		practitioner: {
			title: person.title,
			role: person.role,
			bio: person.bio,
			photoId: person.photoId
		},
		days: groupByDay(slots).map((day) => ({
			key: day.key,
			label: day.label,
			slots: day.items.map((slot) => ({
				id: slot.id,
				slug: slot.slug,
				state: slot.state,
				bookable: isBookable(slot),
				durationMinutes: slot.durationMinutes,
				start: timeLabel(slot.startsAt),
				end: endTimeLabel(slot.startsAt, slot.durationMinutes)
			}))
		}))
	};
};
