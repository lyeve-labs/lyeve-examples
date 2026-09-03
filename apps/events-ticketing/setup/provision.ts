/**
 * Creates the events content types and seeds a season.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the calendar already has events.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const EVENTS = 'events_events';
const REGISTRATIONS = 'events_registrations';

// Order matters: the relation emits a foreign key against the events table, so
// events must exist before registrations references it.
await applySchemas(client, [
	{
		name: EVENTS,
		display_name: 'Events',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			{ name: 'starts_at', field_type: 'datetime', indexed: true },
			{ name: 'venue', field_type: 'text' },
			// Capacity and the running total are ordinary numbers. The engine has
			// no seat, no hold and no counter, so nothing below the app enforces
			// the relationship between these two fields.
			{ name: 'capacity', field_type: 'number' },
			{ name: 'registered', field_type: 'number' },
			{ name: 'cover_media_id', field_type: 'text' }
		]
	},
	{
		name: REGISTRATIONS,
		display_name: 'Registrations',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'attendee_name', field_type: 'text' },
			{ name: 'attendee_email', field_type: 'email' },
			belongsTo('event', EVENTS)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, EVENTS, { limit: 25 })).length > 0) {
	console.log('events already seeded, nothing to do');
	process.exit(0);
}

/**
 * Seed dates are relative to the run. A fixed calendar date would look right
 * this week and leave the site with an empty upcoming list by next month.
 */
function daysFromNow(days: number, hour: number, minute = 0): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + days);
	d.setUTCHours(hour, minute, 0, 0);
	return d.toISOString();
}

const events = [
	{
		slug: 'postgres-performance-clinic',
		title: 'The Postgres Performance Clinic',
		venue: 'Rope Walk Studios, Bristol',
		startsAt: daysFromNow(14, 18, 30),
		capacity: 60,
		registered: 57,
		summary: 'Bring a slow query. Leave with an execution plan you can read.',
		body: 'Three hours, one projector and a queue of real queries from the room. We read the plan together, find the sequential scan nobody meant to ship, and argue about whether the index is worth its write cost.\n\nBring a laptop with a copy of a database you are allowed to show other people, and a query that has been annoying you. Anonymized schemas are fine. We will not fix everything, but you will leave able to tell a bad plan from a slow disk.\n\nDoors at six, first query at six thirty, out by half nine.'
	},
	{
		slug: 'type-systems-in-practice',
		title: 'Type Systems in Practice',
		venue: 'Kelvin Hall Lecture Theater, Glasgow',
		startsAt: daysFromNow(21, 18, 0),
		capacity: 120,
		registered: 41,
		summary: 'Four short talks on what a type system buys you once the codebase is old.',
		body: 'Every talk is twenty minutes and every speaker has maintained the code they are talking about for at least two years. The theme is what survives contact with a large codebase: which guarantees still hold, which ones turned into ceremony, and what people actually reach for when the deadline is close.\n\nSpeakers so far cover a Rust rewrite that was abandoned halfway and shipped anyway, a decade-old Scala service, gradual typing in a Python monolith, and what happens to a TypeScript codebase when the strict flag goes on late.\n\nThe bar in the foyer stays open until eleven.'
	},
	{
		slug: 'shipping-on-fridays',
		title: 'Shipping on Fridays',
		venue: 'The Grainstore, Leeds',
		startsAt: daysFromNow(28, 19, 0),
		capacity: 80,
		registered: 80,
		summary: 'A release engineering night for teams who deploy when the work is ready.',
		body: 'The Friday deploy ban is a proxy for something else: nobody trusts the rollback. This evening is about the machinery that makes the day of the week irrelevant, and about the teams who removed the ban and what it cost them to get there.\n\nTwo talks, then an hour of open floor. Previous rooms have produced a genuinely useful argument about whether feature flags are a rollback strategy or a way of shipping four code paths and testing none of them.\n\nThis session is full. Places open up when people cancel, and the page will say so when they do.'
	},
	{
		slug: 'observability-without-a-vendor',
		title: 'Observability Without a Vendor',
		venue: 'Tramshed Tech, Cardiff',
		startsAt: daysFromNow(35, 18, 30),
		capacity: 45,
		registered: 44,
		summary: 'What you can see with open tooling, and where the bill starts anyway.',
		body: 'A working session on tracing, metrics and logs assembled from parts you host. We build the same picture twice, once on open tooling and once on a hosted platform, and compare what each one shows and what each one costs at a hundred million spans a month.\n\nThe honest conclusion is usually that storage is the bill and everything else is a preference. Come and disagree.\n\nSmall room, hands on keyboards, forty-five places.'
	},
	{
		slug: 'a-weekend-of-small-databases',
		title: 'A Weekend of Small Databases',
		venue: 'Whitworth Locke, Manchester',
		startsAt: daysFromNow(45, 10, 0),
		capacity: 30,
		registered: 12,
		summary: 'Two days building a storage engine that fits in one head.',
		body: 'A write-ahead log, a memtable, an on-disk table format and a compaction loop, written from scratch over a weekend. By Sunday afternoon every attendee has something that survives a kill signal and can read back what it wrote.\n\nNo prior database work is assumed, but you should be comfortable in a systems language and unafraid of a hex dump. We provide the test suite, the coffee and one very opinionated review of your file format.\n\nSaturday and Sunday, ten until five, lunch included.'
	},
	{
		slug: 'migrations-rollbacks-and-regret',
		title: 'Migrations, Rollbacks and Regret',
		venue: 'Cargo Works, London',
		startsAt: daysFromNow(56, 18, 30),
		capacity: 150,
		registered: 96,
		summary: 'Schema changes that ran for eleven hours, and the ones that could not be undone.',
		body: 'Six speakers, six migrations that went wrong, and the postmortem for each. A column rename that took a table lock on the busiest table in the company. A backfill that ran to completion twice. A down migration that had never been executed against anything with data in it.\n\nThe point is not the war stories. It is the small number of habits that separate the teams who deploy schema changes calmly from the teams who schedule them for a bank holiday.\n\nLightning talks welcome. Mail the organizers if you have five minutes of regret to share.'
	}
];

const eventIds: Record<string, string> = {};
const eventTitles: Record<string, string> = {};
for (const event of events) {
	eventTitles[event.slug] = event.title;
	const { id } = await createContent(client, {
		schema: EVENTS,
		slug: event.slug,
		title: event.title,
		body: {
			slug: event.slug,
			summary: event.summary,
			body: event.body,
			starts_at: event.startsAt,
			venue: event.venue,
			capacity: event.capacity,
			registered: event.registered
		}
	});
	eventIds[event.slug] = id;
}

// A handful of named registrations so the door list has something in it. The
// counts above already include them, and they are deliberately fewer than the
// count: the rest of those places were sold before this site existed.
const registrations = [
	{ event: 'type-systems-in-practice', name: 'Nadia Okonkwo', email: 'nadia.okonkwo@example.com' },
	{ event: 'type-systems-in-practice', name: 'Tomas Lindqvist', email: 'tomas.lindqvist@example.com' },
	{ event: 'a-weekend-of-small-databases', name: 'Priya Raghunathan', email: 'priya.raghunathan@example.com' },
	{ event: 'a-weekend-of-small-databases', name: 'Eleanor Whitfield', email: 'eleanor.whitfield@example.com' },
	{ event: 'migrations-rollbacks-and-regret', name: 'Marcus Adeyemi', email: 'marcus.adeyemi@example.com' },
	{ event: 'migrations-rollbacks-and-regret', name: 'Sofia Bergstrom', email: 'sofia.bergstrom@example.com' }
];

for (const registration of registrations) {
	const handle = registration.email.slice(0, registration.email.indexOf('@')).replace(/\./g, '-');
	const slug = `${registration.event}-${handle}`;
	await createContent(client, {
		schema: REGISTRATIONS,
		slug,
		title: `${registration.name} (${eventTitles[registration.event]})`,
		body: {
			slug,
			attendee_name: registration.name,
			attendee_email: registration.email,
			// Relations are written under the field name and read back as
			// `<field>_id`. See docs/VERIFIED-RECIPE.md section 6.
			event: eventIds[registration.event]
		}
	});
}

console.log(`seeded ${events.length} events and ${registrations.length} registrations`);
