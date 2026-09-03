/**
 * Pure helpers shared by the server loads and the pages.
 *
 * Nothing here touches the engine, so it is safe to import from a component.
 * Anything that needs the credential belongs in `src/lib/server/`.
 */

/**
 * The stored value is a fixed token, not the label.
 *
 * `filters[]` on the engine is exact string equality, so a filter can only ever
 * match what was written. Storing "Full time" would make the filter depend on
 * the exact wording of the seed, and on nobody ever editing it in the admin UI.
 */
export const EMPLOYMENT_TYPES = [
	{ value: 'full_time', label: 'Full time' },
	{ value: 'part_time', label: 'Part time' },
	{ value: 'contract', label: 'Contract' },
	{ value: 'internship', label: 'Internship' }
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]['value'];

export function employmentLabel(value: unknown): string {
	const match = EMPLOYMENT_TYPES.find((t) => t.value === value);
	return match ? match.label : 'Not stated';
}

export function isEmploymentType(value: string): value is EmploymentType {
	return EMPLOYMENT_TYPES.some((t) => t.value === value);
}

/**
 * A `number` field generates a NUMERIC column, and a NUMERIC can come back as a
 * JSON string rather than a JSON number depending on the driver. Read it
 * through here instead of assuming either shape.
 */
export function toNumber(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export function formatSalary(min: unknown, max: unknown): string {
	const low = toNumber(min);
	const high = toNumber(max);
	if (low === null && high === null) return 'Salary not stated';
	if (low !== null && high !== null) {
		return low === high ? gbp(low) : `${gbp(low)} to ${gbp(high)}`;
	}
	return gbp((low ?? high) as number);
}

function gbp(amount: number): string {
	return new Intl.NumberFormat('en-GB', {
		style: 'currency',
		currency: 'GBP',
		maximumFractionDigits: 0
	}).format(amount);
}

/** Restricted alphabet: the engine normalizes slugs and rejects control characters and %. */
export function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

export function paragraphs(text: string): string[] {
	return text
		.split('\n\n')
		.map((p) => p.trim())
		.filter(Boolean);
}
