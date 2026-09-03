/**
 * Creates the booking content types and seeds a week of consultations.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the diary already has slots in it.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';
import { dayLabel, timeLabel } from '../src/lib/schedule.ts';

const client = lyeveFromEnv();

const PRACTITIONERS = 'booking_practitioners';
const SLOTS = 'booking_slots';
const APPOINTMENTS = 'booking_appointments';

// Order matters: a relation emits a foreign key against the target's generated
// table, so a type has to exist before another one points at it.
await applySchemas(client, [
	{
		name: PRACTITIONERS,
		display_name: 'Practitioners',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'role', field_type: 'text' },
			{ name: 'bio', field_type: 'text' },
			{ name: 'photo_media_id', field_type: 'text' }
		]
	},
	{
		name: SLOTS,
		display_name: 'Slots',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'starts_at', field_type: 'datetime', indexed: true },
			{ name: 'duration_minutes', field_type: 'number' },
			// Plain indexed text. The engine has no enum column and no check
			// constraint, so open/held/booked is a convention the application
			// keeps, not a rule the database enforces.
			{ name: 'state', field_type: 'text', indexed: true },
			belongsTo('practitioner', PRACTITIONERS)
		]
	},
	{
		name: APPOINTMENTS,
		display_name: 'Appointments',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'customer_name', field_type: 'text' },
			{ name: 'customer_email', field_type: 'email' },
			{ name: 'notes', field_type: 'text' },
			// Not marked unique, and marking it unique would not help. A
			// belongs_to generates two columns: a dead `slot` that nothing ever
			// writes, and the real `slot_id` the write path fills. `unique`
			// indexes the field name, so the constraint would land on the dead
			// column, which is NULL in every row and therefore never in
			// conflict. See the README.
			belongsTo('slot', SLOTS)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, SLOTS, { limit: 25 })).length > 0) {
	console.log('diary already seeded, nothing to do');
	process.exit(0);
}

const practitioners = [
	{
		key: 'lena-okafor',
		title: 'Lena Okafor',
		role: 'Physiotherapist',
		bio: 'Fifteen years in sports rehabilitation, most of it with runners and cyclists. Takes people through the whole arc, from the first assessment to the last session before they race again.',
		durationMinutes: 45,
		times: ['09:00', '11:30']
	},
	{
		key: 'tomas-brandt',
		title: 'Tomas Brandt',
		role: 'Clinical Nutritionist',
		bio: 'Works with people managing type 2 diabetes and long-term gut conditions. Starts from a food diary rather than a plan, on the grounds that a plan nobody keeps is worse than no plan at all.',
		durationMinutes: 60,
		times: ['10:00', '15:00']
	},
	{
		key: 'priya-raghunathan',
		title: 'Priya Raghunathan',
		role: 'Sleep and Fatigue Specialist',
		bio: 'Runs the practice sleep clinic. Most referrals arrive convinced they need medication and leave with a fixed wake time and a light schedule.',
		durationMinutes: 50,
		times: ['08:30', '13:00']
	},
	{
		key: 'callum-wright',
		title: 'Callum Wright',
		role: 'Occupational Therapist',
		bio: 'Assesses workplaces and home setups after injury or surgery. Half the job is equipment and the other half is convincing employers that a phased return costs less than a relapse.',
		durationMinutes: 30,
		times: ['11:00', '16:30']
	}
];

const customers = [
	{ name: 'Rosa Delgado', email: 'rosa.delgado@example.com', notes: 'Right knee, six weeks after meniscus surgery. Cleared to load but still swelling after stairs.' },
	{ name: 'Marcus Ilori', email: 'm.ilori@example.com', notes: 'Blood sugar readings all over the place since switching to shift work.' },
	{ name: 'Hana Sato', email: 'hana.sato@example.com', notes: 'Waking at 3am most nights for the past four months.' },
	{ name: 'Eoin Brennan', email: 'eoin.brennan@example.com', notes: 'Returning to a warehouse role after a shoulder repair. Employer wants a written assessment.' },
	{ name: 'Farida Haddad', email: 'farida.haddad@example.com', notes: 'Marathon in eleven weeks, calf tightening from mile eight onward.' },
	{ name: 'Peter Lindqvist', email: 'p.lindqvist@example.com', notes: 'Follow-up on the elimination diet. Reintroduced dairy last week.' },
	{ name: 'Aisha Rahman', email: 'aisha.rahman@example.com', notes: '' },
	{ name: 'Danny Whitfield', email: 'danny.whitfield@example.com', notes: 'Desk setup review. New role, two screens, laptop on a stack of books.' },
	{ name: 'Ingrid Vogel', email: 'ingrid.vogel@example.com', notes: 'Achilles pain on the left, worst on the first few steps in the morning.' },
	{ name: 'Sam Achebe', email: 'sam.achebe@example.com', notes: 'Wants to come off the evening snack habit without losing training weight.' },
	{ name: 'Clara Mendez', email: 'clara.mendez@example.com', notes: 'Sleeps well on holiday, badly at home. Suspects the commute.' },
	{ name: 'Owen Pritchard', email: 'owen.pritchard@example.com', notes: 'Wrist splint fitted last month, checking whether it is still the right one.' }
];

const DAY_COUNT = 5;

/** The next weekdays after today, at UTC midnight. */
function upcomingWeekdays(count: number): Date[] {
	const days: Date[] = [];
	const cursor = new Date();
	cursor.setUTCHours(0, 0, 0, 0);
	while (days.length < count) {
		cursor.setUTCDate(cursor.getUTCDate() + 1);
		const weekday = cursor.getUTCDay();
		if (weekday !== 0 && weekday !== 6) days.push(new Date(cursor));
	}
	return days;
}

/**
 * Scatters taken and held hours through the diary so it does not read as a wall
 * of availability. Deterministic, so two databases seeded from this script hold
 * the same schedule.
 */
function seedState(n: number): 'open' | 'held' | 'booked' {
	if (n % 11 === 0) return 'held';
	if (n % 3 === 0) return 'booked';
	return 'open';
}

const practitionerIds: Record<string, string> = {};
for (const person of practitioners) {
	// Slugs are unique per tenant across every content type, not per type, and
	// every example in this repo shares one engine. Hence the prefix on all
	// three of them.
	const slug = `booking-${person.key}`;
	const { id } = await createContent(client, {
		schema: PRACTITIONERS,
		slug,
		title: person.title,
		body: { slug, role: person.role, bio: person.bio }
	});
	practitionerIds[person.key] = id;
}

const days = upcomingWeekdays(DAY_COUNT);
let counter = 0;
let bookedCount = 0;
let heldCount = 0;

for (const person of practitioners) {
	for (const day of days) {
		for (const time of person.times) {
			const [hour, minute] = time.split(':').map(Number);
			const startsAt = new Date(
				Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute)
			);
			const iso = startsAt.toISOString();
			// 2026-09-04T09:00:00.000Z -> 20260904T0900
			const stamp = iso.replace(/[-:]/g, '').slice(0, 13);
			const slotSlug = `booking-slot-${person.key}-${stamp}`;
			const state = seedState(counter);

			const slot = await createContent(client, {
				schema: SLOTS,
				slug: slotSlug,
				title: `${person.title}, ${dayLabel(iso)} at ${timeLabel(iso)}`,
				body: {
					slug: slotSlug,
					// A datetime field is a TIMESTAMPTZ. RFC 3339 is what it takes.
					starts_at: iso,
					duration_minutes: person.durationMinutes,
					state,
					// Relations are written under the field name and read back
					// as `<field>_id`.
					practitioner: practitionerIds[person.key]
				}
			});

			if (state === 'booked') {
				const customer = customers[bookedCount % customers.length];
				// Same shape the booking form generates, so a seeded confirmation
				// page and a freshly booked one read alike.
				const appointmentSlug = `booking-appointment-${crypto.randomUUID().slice(0, 8)}`;
				await createContent(client, {
					schema: APPOINTMENTS,
					slug: appointmentSlug,
					title: `${customer.name}, ${dayLabel(iso)} at ${timeLabel(iso)}`,
					body: {
						slug: appointmentSlug,
						customer_name: customer.name,
						customer_email: customer.email,
						notes: customer.notes,
						slot: slot.id
					}
				});
				bookedCount++;
			}
			if (state === 'held') heldCount++;
			counter++;
		}
	}
}

console.log(
	`seeded ${practitioners.length} practitioners and ${counter} slots ` +
		`(${bookedCount} booked, ${heldCount} held, ${counter - bookedCount - heldCount} open)`
);
