import {
	createContent,
	getContentBySlug,
	listContent,
	relationId,
	related,
	type ContentEntry
} from '$lib/lyeve';
import { formatWhen } from '$lib/format';
import { lyeve, EVENTS, REGISTRATIONS } from './lyeve';

/**
 * Everything the site knows about capacity lives in this module.
 *
 * The engine stores content and nothing else. It has no ticket, no inventory
 * and no seat, so "capacity" here is a number on a content entry and "sold
 * out" is a comparison this file makes. Read the README before copying any of
 * it into something that takes money.
 */

/** The engine clamps a page to 200 rows and offers no sort, so a full pass is one page. */
const PAGE_MAX = 200;

interface EventData {
	title: string;
	slug: string;
	summary?: string;
	body?: string;
	starts_at?: string;
	venue?: string;
	capacity?: unknown;
	registered?: unknown;
	cover_media_id?: string;
}

interface RegistrationData {
	title: string;
	slug: string;
	attendee_name?: string;
	attendee_email?: string;
}

export interface EventSummary {
	id: string;
	title: string;
	slug: string;
	summary: string;
	venue: string;
	startsAt: string;
	startsAtMs: number;
	whenLabel: string;
	capacity: number;
	registered: number;
	remaining: number;
	soldOut: boolean;
	coverId: string | null;
}

export interface EventDetail extends EventSummary {
	body: string;
	/** The stored fields exactly as read back, kept so an update can echo them. */
	raw: EventData;
}

export interface RegistrationSummary {
	id: string;
	name: string;
	registeredAt: string;
	registeredLabel: string;
	eventTitle: string | null;
	eventSlug: string | null;
}

/**
 * A number field is a NUMERIC column, and what comes back for one depends on
 * the dialect: Postgres renders it as a JSON number, MySQL and MSSQL can hand
 * the same value back as a string. Both mean the same count.
 */
function toCount(value: unknown): number {
	const n = typeof value === 'string' ? Number(value) : value;
	if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
	return Math.max(0, Math.trunc(n));
}

function shape(row: ContentEntry<EventData>): EventDetail {
	const capacity = toCount(row.data.capacity);
	const registered = toCount(row.data.registered);
	const startsAt = typeof row.data.starts_at === 'string' ? row.data.starts_at : '';
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		summary: row.data.summary ?? '',
		body: row.data.body ?? '',
		venue: row.data.venue ?? 'Venue to be announced',
		startsAt,
		startsAtMs: startsAt ? Date.parse(startsAt) : Number.POSITIVE_INFINITY,
		whenLabel: formatWhen(startsAt),
		capacity,
		registered,
		remaining: Math.max(0, capacity - registered),
		soldOut: capacity > 0 && registered >= capacity,
		coverId: row.data.cover_media_id ?? null,
		raw: row.data
	};
}

/**
 * Upcoming events, soonest first.
 *
 * Both halves of that sentence are the app's work. The engine has no sort
 * parameter and always answers created_at DESC, and its filters are exact
 * equality only, so there is no way to ask it for "starts_at in the future".
 * One page holds every event this example has. A real calendar with more than
 * 200 of them would have to read every page before it could order any of them.
 */
export async function listUpcomingEvents(): Promise<EventSummary[]> {
	const rows = await listContent<EventData>(lyeve, EVENTS, { limit: PAGE_MAX });
	const now = Date.now();
	return rows
		.map(shape)
		.filter((event) => event.startsAtMs >= now)
		.sort((a, b) => a.startsAtMs - b.startsAtMs);
}

export async function loadEvent(slug: string): Promise<EventDetail | null> {
	const row = await getContentBySlug<EventData>(lyeve, EVENTS, slug);
	return row ? shape(row) : null;
}

/**
 * The registrations recorded against one event.
 *
 * `filters[event_id]` is the relation's stored column: a belongs_to written as
 * `event` is read back as `event_id`. relationId reads that same value from a
 * row, so the filter and the check below agree by construction.
 */
export async function registrationsForEvent(eventId: string): Promise<RegistrationSummary[]> {
	const rows = await listContent<RegistrationData>(lyeve, REGISTRATIONS, {
		filters: { event_id: eventId },
		limit: PAGE_MAX
	});
	return rows
		.filter((row) => relationId(row.data, 'event') === eventId)
		.map((row) => summarizeRegistration(row, null));
}

/** The door list across every event. `populate` resolves each relation in the same round trip. */
export async function listRegistrations(): Promise<RegistrationSummary[]> {
	const rows = await listContent<RegistrationData>(lyeve, REGISTRATIONS, {
		limit: PAGE_MAX,
		populate: ['event']
	});
	return rows.map((row) =>
		summarizeRegistration(row, related<{ title: string; slug: string }>(row.data, 'event'))
	);
}

function summarizeRegistration(
	row: ContentEntry<RegistrationData>,
	event: { title: string; slug: string } | null
): RegistrationSummary {
	return {
		id: row.id,
		name: row.data.attendee_name ?? row.data.title,
		registeredAt: row.created_at,
		registeredLabel: formatWhen(row.created_at),
		eventTitle: event?.title ?? null,
		eventSlug: event?.slug ?? null
	};
}

export type RegisterOutcome =
	| { ok: true; remaining: number; counterUpdated: boolean }
	| { ok: false; status: number; message: string };

/**
 * Takes one place on an event.
 *
 * The refusal cases are checked here because the engine enforces none of them.
 * A content type cannot express "registered may not exceed capacity", cannot
 * make (event, email) unique, and will happily store a registration for an
 * event that finished last year.
 */
export async function register(
	slug: string,
	rawName: string,
	rawEmail: string
): Promise<RegisterOutcome> {
	const name = rawName.trim();
	// Filters are exact equality, so the duplicate check below only finds a
	// second sign-up if both rows spell the address the same way.
	const email = rawEmail.trim().toLowerCase();

	if (name.length < 2 || name.length > 120) {
		return { ok: false, status: 400, message: 'Enter the name that should appear on the door list.' };
	}
	// The address is checked here rather than left to the engine. An email
	// field becomes a column with a format CHECK on it, but the write that
	// trips it is the projection into the generated table, and that projection
	// is best-effort: the entry is stored, the projection is dropped, and the
	// registration is missing from every read with no error anywhere.
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || email.length > 200) {
		return { ok: false, status: 400, message: 'Enter an email address we can send the ticket to.' };
	}

	const event = await loadEvent(slug);
	if (!event) return { ok: false, status: 404, message: 'That event is no longer listed.' };

	if (event.startsAtMs < Date.now()) {
		return { ok: false, status: 409, message: 'Registration for this event has closed.' };
	}
	if (event.remaining <= 0) {
		return { ok: false, status: 409, message: `${event.title} is sold out.` };
	}
	if (await alreadyRegistered(event.id, email)) {
		return {
			ok: false,
			status: 409,
			message: 'That email address is already registered for this event.'
		};
	}

	// One slug, used in both places. The admin write takes it at the top level
	// and again inside the body, and a mismatch stores two different values.
	const slugForRow = registrationSlug(event.slug);

	await createContent(lyeve, {
		schema: REGISTRATIONS,
		slug: slugForRow,
		title: `${name} (${event.title})`,
		body: {
			slug: slugForRow,
			attendee_name: name,
			attendee_email: email,
			// A relation is written under its field name and read back as
			// `<field>_id`. Writing `event_id` here stores nothing.
			event: event.id
		}
	});

	const counterUpdated = await incrementRegistered(event);
	return { ok: true, remaining: event.remaining - 1, counterUpdated };
}

async function alreadyRegistered(eventId: string, email: string): Promise<boolean> {
	const rows = await listContent<RegistrationData>(lyeve, REGISTRATIONS, {
		filters: { event_id: eventId, attendee_email: email },
		limit: 25
	});
	return rows.length > 0;
}

/**
 * Adds one to the event's registered count.
 *
 * READ-MODIFY-WRITE, AND NOTHING HERE IS ATOMIC. The count was read in
 * loadEvent, one is added in this process, and the whole entry is written
 * back. Two requests that read 57 both write 58, and the event quietly sells
 * one place too many. The engine offers no increment, no compare-and-set and
 * no way to make this update conditional on the value that was read, so the
 * only real fixes are outside it: serialize registrations for an event behind
 * a lock the app owns, or keep the counter in a database the app controls and
 * leave the engine holding the description.
 *
 * The registration row is written first, so a failure here loses a seat from
 * the count rather than losing the attendee. Nothing joins the two writes into
 * a transaction, which is why the event page reconciles the counter against
 * the rows and says so when they disagree.
 */
async function incrementRegistered(event: EventDetail): Promise<boolean> {
	try {
		// PUT replaces the body outright, so every stored field goes back with
		// the request. The shared client has no update helper, and this is the
		// admin content route the recipe insists on for writes.
		await lyeve.request('admin', `/api/admin/content/${event.id}`, {
			method: 'PUT',
			body: JSON.stringify({
				body: { ...event.raw, registered: event.registered + 1 },
				change_note: 'registration added'
			})
		});
		return true;
	} catch {
		return false;
	}
}

function registrationSlug(eventSlug: string): string {
	return `${eventSlug}-${crypto.randomUUID().slice(0, 12)}`;
}
