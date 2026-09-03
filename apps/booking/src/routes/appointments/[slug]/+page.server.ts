import { error } from '@sveltejs/kit';
import { getAppointmentBySlug, getPractitioner } from '$lib/server/booking';
import { dayLabel, endTimeLabel, timeLabel } from '$lib/schedule';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const appointment = await getAppointmentBySlug(params.slug);
	if (!appointment) error(404, 'No such appointment');

	const slot = appointment.slot;
	// populate walks one hop, so the slot came back inflated and its own
	// practitioner did not. This is the second hop, asked for explicitly.
	const person = slot?.practitionerId ? await getPractitioner(slot.practitionerId) : null;

	return {
		appointment: {
			reference: appointment.slug.replace('booking-appointment-', ''),
			customerName: appointment.customerName,
			customerEmail: appointment.customerEmail,
			notes: appointment.notes,
			state: slot?.state ?? null,
			day: slot ? dayLabel(slot.startsAt) : null,
			start: slot ? timeLabel(slot.startsAt) : null,
			end: slot ? endTimeLabel(slot.startsAt, slot.durationMinutes) : null,
			durationMinutes: slot?.durationMinutes ?? null
		},
		practitioner: person ? { title: person.title, role: person.role, slug: person.slug } : null
	};
};
