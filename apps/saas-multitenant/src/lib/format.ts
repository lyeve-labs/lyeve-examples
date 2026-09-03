const NUMBER = new Intl.NumberFormat('en-US');

export function count(n: number): string {
	return NUMBER.format(n ?? 0);
}

export function bytes(n: number): string {
	if (!n) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = n;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** A limit of 0 means unlimited everywhere in the engine, so it never renders as a number. */
export function limit(n: number): string {
	return n > 0 ? count(n) : 'unlimited';
}

export function percent(used: number, of: number): number | null {
	if (!of || of <= 0) return null;
	return Math.min(100, Math.round((used / of) * 100));
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

export function periodLabel(period: string): string {
	const [year, month] = period.split('-');
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
	return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
}
