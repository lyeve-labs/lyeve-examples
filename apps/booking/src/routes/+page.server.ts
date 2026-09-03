import { isBookable, listPractitioners, listSlots, upcoming } from '$lib/server/booking';
import { dayLabel, timeLabel } from '$lib/schedule';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// One list of practitioners and one list of slots, joined here. The engine
	// has no aggregate and no reverse relation lookup, so "how many hours are
	// still open for each person" is a count the app does over rows it already
	// had to fetch.
	const [practitioners, slots] = await Promise.all([listPractitioners(), listSlots()]);

	const free = upcoming(slots).filter(isBookable);
	const openCount = new Map<string, number>();
	const nextFree = new Map<string, string>();

	for (const slot of free) {
		if (!slot.practitionerId) continue;
		openCount.set(slot.practitionerId, (openCount.get(slot.practitionerId) ?? 0) + 1);
		// `free` is already in schedule order, so the first one wins.
		if (!nextFree.has(slot.practitionerId)) nextFree.set(slot.practitionerId, slot.startsAt);
	}

	return {
		practitioners: practitioners.map((person) => {
			const next = nextFree.get(person.id);
			return {
				id: person.id,
				title: person.title,
				slug: person.slug,
				role: person.role,
				bio: person.bio,
				photoId: person.photoId,
				openCount: openCount.get(person.id) ?? 0,
				nextFree: next ? `${dayLabel(next)} at ${timeLabel(next)}` : null
			};
		})
	};
};
