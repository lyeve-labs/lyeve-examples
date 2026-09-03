/**
 * Formatting and day grouping for the schedule.
 *
 * Everything here is pure. It holds no credential and touches no engine, so
 * pages and the seed script can both use it.
 */

/**
 * Times are stored and displayed in UTC.
 *
 * A datetime field is a TIMESTAMPTZ, which records an instant and not the
 * timezone a clinic keeps its diary in. Rendering in the viewer's zone would
 * also make the server render and the hydrated client render disagree whenever
 * the two sit in different zones, which shows up as a hydration mismatch rather
 * than as a wrong time. Pinning both ends to UTC gives one answer everywhere.
 *
 * A real practice would carry its own timezone on the practitioner record and
 * format against that. The engine has no opinion either way.
 */
export const DISPLAY_ZONE = 'UTC';

const dayFormat = new Intl.DateTimeFormat('en-US', {
	weekday: 'long',
	month: 'long',
	day: 'numeric',
	timeZone: DISPLAY_ZONE
});

const timeFormat = new Intl.DateTimeFormat('en-US', {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
	timeZone: DISPLAY_ZONE
});

/** Stable per-day key, used to group slots and as a list key in the markup. */
export function dayKey(iso: string): string {
	return new Date(iso).toISOString().slice(0, 10);
}

export function dayLabel(iso: string): string {
	return dayFormat.format(new Date(iso));
}

export function timeLabel(iso: string): string {
	return timeFormat.format(new Date(iso));
}

/** The time a slot ends, derived rather than stored. */
export function endTimeLabel(iso: string, durationMinutes: number): string {
	return timeFormat.format(new Date(Date.parse(iso) + durationMinutes * 60_000));
}

export interface Day<T> {
	key: string;
	label: string;
	items: T[];
}

/**
 * Groups already-sorted items into consecutive days.
 *
 * The engine has no sort parameter and always answers created_at DESC, so
 * callers put the list in schedule order before this runs.
 */
export function groupByDay<T extends { startsAt: string }>(items: T[]): Day<T>[] {
	const days: Day<T>[] = [];
	for (const item of items) {
		const key = dayKey(item.startsAt);
		const current = days.at(-1);
		if (current?.key === key) {
			current.items.push(item);
		} else {
			days.push({ key, label: dayLabel(item.startsAt), items: [item] });
		}
	}
	return days;
}

/** Initials for a practitioner with no photo uploaded. */
export function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('');
}
