/**
 * Pure formatting, called from the server loads so a page ships finished
 * strings. Formatting in the component instead would render one string in Node
 * and another in the browser, because the two disagree about the local time
 * zone and the default locale.
 */
const when = new Intl.DateTimeFormat('en-US', {
	weekday: 'short',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	timeZone: 'UTC',
	timeZoneName: 'short'
});

export function formatWhen(iso: string): string {
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? 'Date to be confirmed' : when.format(ms);
}

export function placesLabel(remaining: number, capacity: number): string {
	if (capacity === 0) return 'Capacity not set';
	if (remaining <= 0) return 'Sold out';
	if (remaining === 1) return '1 place left';
	if (remaining <= 5) return `${remaining} places left`;
	return `${remaining} of ${capacity} places left`;
}
