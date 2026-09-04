/** Display helpers. Pure, so the pages stay free of formatting logic. */

export function money(cents: number, currency = 'GBP'): string {
	return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);
}

export function clock(iso: string | null | undefined): string {
	if (!iso) return '';
	const at = new Date(iso);
	if (Number.isNaN(at.getTime())) return String(iso);
	return at.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });
}

export function ago(iso: string | null | undefined): string {
	if (!iso) return '';
	const at = new Date(iso).getTime();
	if (Number.isNaN(at)) return String(iso);
	const seconds = Math.round((Date.now() - at) / 1000);
	if (seconds < 60) return `${Math.max(seconds, 0)}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}

export function millis(value: number | null | undefined): string {
	return typeof value === 'number' ? `${value} ms` : '';
}

export function percent(rate: number): string {
	return `${Math.round(rate * 10) / 10}%`;
}

/** Shows a secret's shape without showing the secret. */
export function fingerprint(secret: string): string {
	if (!secret) return 'none';
	return `${secret.slice(0, 3)}...${secret.slice(-3)} (${secret.length} chars)`;
}
