import {
	getContent,
	getContentBySlug,
	listContent,
	related,
	relationId,
	type ContentEntry
} from '$lib/lyeve';
import { lyeve, APPOINTMENTS, PRACTITIONERS, SLOTS } from './lyeve';

/**
 * The three states a slot moves through.
 *
 * They are an application convention. The engine stores the field as text and
 * accepts any string in it, so nothing but the code in this repo keeps the set
 * closed.
 */
export type SlotState = 'open' | 'held' | 'booked';

type PractitionerRow = {
	title: string;
	slug: string;
	bio?: string;
	role?: string;
	photo_media_id?: string;
};

type SlotRow = {
	title: string;
	slug: string;
	starts_at?: string;
	duration_minutes?: unknown;
	state?: unknown;
};

type AppointmentRow = {
	title: string;
	slug: string;
	customer_name?: string;
	customer_email?: string;
	notes?: string;
};

export interface Practitioner {
	id: string;
	title: string;
	slug: string;
	role: string;
	bio: string;
	photoId: string | null;
}

export interface Slot {
	id: string;
	title: string;
	slug: string;
	startsAt: string;
	durationMinutes: number;
	state: SlotState;
	practitionerId: string | null;
}

export interface Appointment {
	id: string;
	slug: string;
	customerName: string;
	customerEmail: string;
	notes: string;
	bookedAt: string;
	slot: Slot | null;
}

/** A slot the app is willing to sell. Anything else is unavailable. */
export function isBookable(slot: Slot): boolean {
	return slot.state === 'open';
}

/**
 * A `number` field generates a NUMERIC column, and NUMERIC arrives as a JSON
 * string on some drivers and a JSON number on others. Coercing once here stops
 * the arithmetic downstream from silently concatenating.
 */
function minutes(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) && n > 0 ? n : 30;
}

/**
 * An unrecognized state is treated as held rather than open. Guessing open is
 * the guess that sells the same hour twice.
 */
function slotState(value: unknown): SlotState {
	return value === 'open' || value === 'booked' || value === 'held' ? value : 'held';
}

function toPractitioner(row: ContentEntry<PractitionerRow>): Practitioner {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		role: row.data.role ?? '',
		bio: row.data.bio ?? '',
		photoId: row.data.photo_media_id ?? null
	};
}

/**
 * Builds a slot from a row's data map.
 *
 * It takes the id separately because a populated relation and a listed entry
 * carry it in different places: an entry has it alongside `data`, an inflated
 * relation has it inside the same map as the fields.
 */
function toSlot(id: string, data: Record<string, unknown>, fallbackStart: string): Slot {
	const row = data as SlotRow;
	return {
		id,
		title: row.title,
		slug: row.slug,
		startsAt: row.starts_at ?? fallbackStart,
		durationMinutes: minutes(row.duration_minutes),
		state: slotState(row.state),
		// A relation is written under its field name and read back under
		// `<field>_id`. Reading `data.practitioner` gives null unless the
		// request populated it.
		practitionerId: relationId(data, 'practitioner')
	};
}

export async function listPractitioners(): Promise<Practitioner[]> {
	const rows = await listContent<PractitionerRow>(lyeve, PRACTITIONERS, { limit: 25 });
	return rows.map(toPractitioner).sort((a, b) => a.title.localeCompare(b.title));
}

export async function getPractitionerBySlug(slug: string): Promise<Practitioner | null> {
	const row = await getContentBySlug<PractitionerRow>(lyeve, PRACTITIONERS, slug);
	return row ? toPractitioner(row) : null;
}

export async function getPractitioner(id: string): Promise<Practitioner | null> {
	const row = await getContent<PractitionerRow>(lyeve, PRACTITIONERS, id);
	return row ? toPractitioner(row) : null;
}

/**
 * Lists slots, newest-created first, because that is the only order the engine
 * offers. Callers that want schedule order run the result through `upcoming`.
 *
 * 200 is the engine's ceiling on `limit`. A practice with a longer diary than
 * that pages with `offset`, which is the only other lever there is.
 */
export async function listSlots(practitionerId?: string): Promise<Slot[]> {
	const rows = await listContent<SlotRow>(lyeve, SLOTS, {
		limit: 200,
		// filters[] is exact equality against a column, so the physical FK
		// column name goes here, not the field name.
		filters: practitionerId ? { practitioner_id: practitionerId } : undefined
	});
	return rows.map((row) => toSlot(row.id, row.data, row.created_at));
}

/** Future slots in schedule order. The sort is here because the engine has none. */
export function upcoming(slots: Slot[], now = Date.now()): Slot[] {
	return slots
		.filter((slot) => Date.parse(slot.startsAt) > now)
		.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export async function getSlotBySlug(slug: string): Promise<Slot | null> {
	const row = await getContentBySlug<SlotRow>(lyeve, SLOTS, slug);
	return row ? toSlot(row.id, row.data, row.created_at) : null;
}

export async function getAppointmentBySlug(slug: string): Promise<Appointment | null> {
	// populate inflates the relation into the whole related record in one round
	// trip. It resolves one hop, so the slot's own practitioner is a second
	// request rather than a deeper populate.
	const row = await getContentBySlug<AppointmentRow>(lyeve, APPOINTMENTS, slug, {
		populate: ['slot']
	});
	if (!row) return null;

	const inflated = related<Record<string, unknown>>(row.data, 'slot');

	return {
		id: row.id,
		slug: row.data.slug,
		customerName: row.data.customer_name ?? '',
		customerEmail: row.data.customer_email ?? '',
		notes: row.data.notes ?? '',
		bookedAt: row.created_at,
		slot: inflated
			? toSlot(String(inflated.id ?? ''), inflated, String(inflated.created_at ?? row.created_at))
			: null
	};
}

/**
 * Rewrites a slot's state.
 *
 * `PUT /api/admin/content/{id}` replaces the entry body rather than merging
 * into it, so every field the slot carries has to be sent back or it is
 * dropped. The body is rebuilt from typed values instead of echoing the row
 * that was read, because a read carries the engine's own `id` and `created_at`
 * plus a dead `practitioner: null` key, and writing that back would blank the
 * relation.
 */
export async function writeSlotState(slot: Slot, state: SlotState): Promise<void> {
	await lyeve.request('admin', `/api/admin/content/${slot.id}`, {
		method: 'PUT',
		body: JSON.stringify({
			body: {
				// The body is validated against the schema, which declares
				// title and slug required, so omitting either is a 422.
				title: slot.title,
				slug: slot.slug,
				starts_at: slot.startsAt,
				duration_minutes: slot.durationMinutes,
				state,
				practitioner: slot.practitionerId
			},
			change_note: `state set to ${state}`
		})
	});
}
