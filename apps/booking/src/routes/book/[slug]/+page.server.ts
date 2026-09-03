import { error, fail, redirect } from '@sveltejs/kit';
import { createContent } from '$lib/lyeve';
import { APPOINTMENTS, lyeve } from '$lib/server/lyeve';
import {
	getPractitioner,
	getSlotBySlug,
	isBookable,
	writeSlotState
} from '$lib/server/booking';
import { dayLabel, endTimeLabel, timeLabel } from '$lib/schedule';
import type { Actions, PageServerLoad } from './$types';

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;
// The engine caps an entry title at 255 characters and the title below is built
// from the name, so the name is bounded here rather than discovered as a 422.
const NAME_LIMIT = 120;
const EMAIL_LIMIT = 254;
const NOTES_LIMIT = 1000;

export const load: PageServerLoad = async ({ params }) => {
	const slot = await getSlotBySlug(params.slug);
	if (!slot) error(404, 'No such appointment time');

	const person = slot.practitionerId ? await getPractitioner(slot.practitionerId) : null;

	return {
		slot: {
			slug: slot.slug,
			bookable: isBookable(slot),
			state: slot.state,
			day: dayLabel(slot.startsAt),
			start: timeLabel(slot.startsAt),
			end: endTimeLabel(slot.startsAt, slot.durationMinutes),
			durationMinutes: slot.durationMinutes
		},
		practitioner: person
			? { title: person.title, role: person.role, slug: person.slug }
			: null
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('customer_name') ?? '').trim();
		const email = String(form.get('customer_email') ?? '').trim();
		const notes = String(form.get('notes') ?? '').trim();
		const values = { name, email, notes };

		if (!name) {
			return fail(400, { values, message: 'Tell us who the appointment is for.' });
		}
		if (name.length > NAME_LIMIT) {
			return fail(400, { values, message: `Keep the name under ${NAME_LIMIT} characters.` });
		}
		if (!EMAIL.test(email) || email.length > EMAIL_LIMIT) {
			return fail(400, { values, message: 'We need an email address to send the confirmation to.' });
		}
		if (notes.length > NOTES_LIMIT) {
			return fail(400, { values, message: `Keep the notes under ${NOTES_LIMIT} characters.` });
		}

		// Re-read rather than trusting the page the form was rendered from. The
		// page may have been open for an hour.
		const slot = await getSlotBySlug(params.slug);
		if (!slot) {
			return fail(404, { values, message: 'That appointment time no longer exists.' });
		}

		// This check and the write below it are a race, not a guarantee.
		//
		// The engine has no booking, availability or reservation concept, no
		// transaction spanning two content writes, and no conditional update.
		// Two requests can read this slot as open in the same instant, both pass
		// this check, and both go on to book it. Marking the appointment's slot
		// relation `unique` would not close the gap either: the constraint lands
		// on the dead `slot` column rather than the `slot_id` the write path
		// fills, so it never sees a duplicate.
		//
		// The window is short and it is real. The README sets out what a system
		// that has to be right, rather than illustrative, would need instead.
		if (!isBookable(slot)) {
			return fail(409, {
				values,
				message: 'Someone took that time while you were filling this in. Pick another.'
			});
		}

		// Claim the slot first, so a failure part-way through loses an hour
		// rather than selling it twice.
		try {
			await writeSlotState(slot, 'booked');
		} catch (err) {
			console.error('could not claim the slot', err);
			return fail(502, {
				values,
				message: 'We could not hold that time. Nothing was booked, so please try again.'
			});
		}

		const reference = crypto.randomUUID().slice(0, 8);
		const slug = `booking-appointment-${reference}`;

		try {
			await createContent(lyeve, {
				schema: APPOINTMENTS,
				slug,
				title: `${name}, ${dayLabel(slot.startsAt)} at ${timeLabel(slot.startsAt)}`,
				body: {
					slug,
					customer_name: name,
					customer_email: email,
					notes,
					// A relation is written under its field name. It comes back
					// as `slot_id`.
					slot: slot.id
				}
			});
		} catch (err) {
			// A compensating write, not a rollback. If this process dies between
			// the two calls the slot stays booked with no appointment against
			// it, and only an operator looking at the data can tell.
			await writeSlotState(slot, 'open').catch(() => {});
			console.error('appointment write failed, released the slot', err);
			return fail(502, {
				values,
				message: 'We could not save that booking. The time is free again, so please try once more.'
			});
		}

		redirect(303, `/appointments/${slug}`);
	}
};
