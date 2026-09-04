/**
 * The two DSAR routes, and the rules this app puts in front of them.
 *
 * `POST /api/admin/gdpr/export` and `POST /api/admin/gdpr/erase` both take
 * `{"identifier": string}` and both require super_admin. The key is
 * `identifier`. There is no `subject`, and a body with the wrong key decodes to
 * an empty identifier rather than an error.
 *
 * That is why classifyIdentifier exists. Erasure is not reversible, the engine
 * answers 200 whether it matched one row or none, and the identifier is the
 * only thing that decides which rows go.
 */
import { LyeveError } from '$lib/lyeve';
import { lyeve } from './lyeve';

/** The engine's ceiling on both DSAR identifiers: RFC 5321's longest address. */
const MAX_IDENTIFIER = 320;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type IdentifierKind = 'email' | 'account_id' | 'other';

export interface IdentifierVerdict {
	/** Normalized value to send. Empty when the input cannot be used at all. */
	value: string;
	kind: IdentifierKind;
	/** Set when the input cannot be sent to either route. */
	problem: string | null;
	/**
	 * Set when the value is safe to export but not to erase. Erasure keys on an
	 * address or an account id. Anything else reaches erasers that match by
	 * substring.
	 */
	eraseBlock: string | null;
}

/**
 * Classifies and normalizes a data-subject identifier.
 *
 * Normalization is not cosmetic. The engine lower-cases the address half of
 * every DSAR query, because `sys_users.email` is stored folded, so
 * `Marta@example.com` and `marta@example.com` are the same subject to the
 * engine and have to be the same subject to the guards in `operator.ts`, or a
 * capitalized address walks straight past the check on the operator's own
 * account.
 *
 * An account id is lower-cased for the same reason and with one caveat worth
 * knowing: the engine compares the id half as supplied against a text cast of
 * the id column, and the dialects render that cast differently. PostgreSQL
 * renders a UUID lower case and SQL Server upper case, so the case of a UUID
 * identifier decides whether it matches at all. This stack is PostgreSQL.
 */
export function classifyIdentifier(raw: string): IdentifierVerdict {
	const trimmed = raw.trim();

	if (!trimmed) {
		return {
			value: '',
			kind: 'other',
			problem:
				'An identifier is required. The self-service route on the public router erases whoever holds the credential when it is given nothing, so an empty value is never sent.',
			eraseBlock: null
		};
	}
	if (trimmed.length > MAX_IDENTIFIER) {
		return {
			value: '',
			kind: 'other',
			problem: `Longer than ${MAX_IDENTIFIER} characters, which is more than any address can be. The engine refuses it with 400.`,
			eraseBlock: null
		};
	}
	// The engine refuses these with 400 rather than searching for them. Naming
	// the reason here is more use to an operator than relaying that status.
	if (CONTROL_CHARS.test(trimmed)) {
		return {
			value: '',
			kind: 'other',
			problem: 'Contains a control character. The engine refuses it with 400.',
			eraseBlock: null
		};
	}

	if (UUID.test(trimmed)) {
		return { value: trimmed.toLowerCase(), kind: 'account_id', problem: null, eraseBlock: null };
	}
	if (EMAIL.test(trimmed)) {
		return { value: trimmed.toLowerCase(), kind: 'email', problem: null, eraseBlock: null };
	}

	// An IP address or a free-form string is a legitimate export key: the forms
	// exporter matches on ip_address, and the analytics eraser searches inside a
	// JSON column. That substring search is also why erasure refuses it. A short
	// or common string matches records belonging to people who never asked, and
	// nothing about the 200 that comes back would say so.
	return {
		value: trimmed,
		kind: 'other',
		problem: null,
		eraseBlock:
			'Erasure is limited to an email address or an account id. Some erasers match the identifier as a substring, so a free-form value can destroy the records of somebody who never asked.'
	};
}

/**
 * The reference the engine writes to its own logs for a subject.
 *
 * SHA-256 of the identifier, first six bytes, hex. Reproduced here so an entry
 * in this app's action trail lines up with the engine's `subject_ref=` log
 * lines without either side storing the address a second time.
 */
export async function subjectDigest(identifier: string): Promise<string> {
	const bytes = new TextEncoder().encode(identifier);
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(hash).slice(0, 6)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export interface ExportBundle {
	identifier: string;
	plugins: Record<string, unknown>;
	incomplete: boolean;
	matched_tenants?: string[];
	scope: {
		mode: string;
		tenants: string[];
		tenants_requested: number;
		tenants_covered: number;
	};
	summary: {
		total_records: number;
		plugins_queried: number;
		plugins_with_data: number;
	};
	errors: { index: number; error: string }[];
}

export interface EraseOutcome {
	identifier: string;
	total_rows: number;
	errors: string[] | null;
	holds?: { id: string; reason?: string }[];
}

/**
 * Runs an Art. 15 export for one identifier.
 *
 * Read-only apart from the audit entry it files, so it doubles as the preflight
 * for an erasure: the bundle names what the registered exporters can see before
 * anything is destroyed.
 *
 * `all_tenants` is deliberately not sent. It has to be asked for, and on a
 * single-tenant install the engine refuses it with 400 rather than answering
 * from one tenant and letting the bundle read as complete.
 */
export async function runExport(identifier: string): Promise<ExportBundle> {
	return lyeve.request<ExportBundle>('admin', '/api/admin/gdpr/export', {
		method: 'POST',
		body: JSON.stringify({ identifier })
	});
}

export type EraseResult =
	| { state: 'erased'; rows: number; outcome: EraseOutcome }
	| { state: 'held'; holds: { id: string; reason?: string }[]; outcome: EraseOutcome }
	| { state: 'partial'; rows: number; outcome: EraseOutcome }
	| { state: 'unavailable'; message: string }
	| { state: 'refused'; message: string };

/**
 * Runs an Art. 17 erasure for one identifier.
 *
 * Four answers, and only the first is a completed erasure:
 *
 *  - 200 with holds: an active legal hold stopped it and nothing was erased.
 *    The row count reads zero either way, which is why the holds array is the
 *    thing to check and not the count.
 *  - 200 with errors: some erasers failed. Rows have already gone, the run is
 *    incomplete, and the subject has to be told.
 *  - 503: the hold checker could not answer, so the engine refused rather than
 *    risk destroying held evidence. Safe to retry.
 *  - 400 or 422: the identifier never should have left this process. The
 *    guards below catch every case this app can produce.
 */
export async function runErase(identifier: string): Promise<EraseResult> {
	let outcome: EraseOutcome;
	try {
		outcome = await lyeve.request<EraseOutcome>('admin', '/api/admin/gdpr/erase', {
			method: 'POST',
			body: JSON.stringify({ identifier })
		});
	} catch (err) {
		if (err instanceof LyeveError && err.status === 503) {
			return {
				state: 'unavailable',
				message:
					'The engine could not determine legal-hold status, so no erasure was attempted. Safe to retry.'
			};
		}
		if (err instanceof LyeveError) {
			return { state: 'refused', message: err.fieldErrors[0]?.message ?? err.message };
		}
		throw err;
	}

	if (outcome.holds && outcome.holds.length > 0) {
		return { state: 'held', holds: outcome.holds, outcome };
	}
	if (outcome.errors && outcome.errors.length > 0) {
		return { state: 'partial', rows: outcome.total_rows, outcome };
	}
	return { state: 'erased', rows: outcome.total_rows, outcome };
}

/** Row counts per section of an export bundle, for the summary table. */
export function bundleSections(bundle: ExportBundle): { name: string; rows: number }[] {
	return Object.entries(bundle.plugins ?? {})
		.map(([name, value]) => ({ name, rows: countRows(value) }))
		.sort((a, b) => b.rows - a.rows || a.name.localeCompare(b.name));
}

/**
 * Counts row-like arrays at any depth, the way the engine's own summary does.
 * A section is sometimes a bare array of rows and sometimes an object of named
 * arrays, because one exporter namespaces its sections a level deeper than the
 * rest to keep generic headings from colliding in the merge.
 */
function countRows(value: unknown): number {
	if (Array.isArray(value)) {
		const nested = value.reduce<number>((n, item) => n + countRows(item), 0);
		return nested === 0 ? value.length : nested;
	}
	if (value && typeof value === 'object') {
		return Object.values(value).reduce<number>((n, item) => n + countRows(item), 0);
	}
	return 0;
}
