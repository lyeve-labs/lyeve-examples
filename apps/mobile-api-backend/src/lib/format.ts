const NUMBER = new Intl.NumberFormat('en-US');

export function count(n: number): string {
	return NUMBER.format(n ?? 0);
}

export function bytes(n: number): string {
	if (!n) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = n;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Zero is unlimited everywhere in the engine, so it never renders as a number. */
export function limitLabel(n: number): string {
	return n > 0 ? count(n) : 'unlimited';
}

export function when(iso: string): string {
	return new Date(iso).toLocaleString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function day(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/** The engine's billing period is a UTC YYYY-MM string, not a date range. */
export function currentPeriod(): string {
	return new Date().toISOString().slice(0, 7);
}

export function shortId(id: string): string {
	return id.slice(0, 8);
}
