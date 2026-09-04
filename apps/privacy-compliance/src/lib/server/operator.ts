/**
 * Who this app is, and which subjects it refuses to erase.
 *
 * The engine has no route that resolves an address to an account, so the guard
 * pages the user listing and matches locally. That is the expensive half of
 * every erasure this app performs, and it is the half that keeps a privacy desk
 * from anonymizing the credential it runs on.
 */
import { lyeve } from './lyeve';
import type { IdentifierVerdict } from './dsar';

export interface Account {
	id: string;
	email: string;
	roles: string[];
	disabled: boolean;
	tenantId: string;
	createdAt: string;
}

export interface Operator {
	id: string;
	email: string;
	roles: string[];
}

/** Roles this desk will not erase, whoever asks. */
const PRIVILEGED = ['super_admin', 'admin'];

/**
 * The user listing is a bare array with no total, so the end of the data is a
 * short page and nothing else. The cap bounds the scan on an install with more
 * accounts than a demo, and a scan that hits it reports itself incomplete
 * rather than answering from the part it managed to read.
 */
const PAGE = 200;
const MAX_PAGES = 8;

export async function whoami(): Promise<Operator> {
	return lyeve.request<Operator>('admin', '/api/admin/auth/me');
}

export interface AccountScan {
	accounts: Account[];
	/** False when the cap stopped the scan, which makes every absence unproven. */
	complete: boolean;
}

export async function scanAccounts(): Promise<AccountScan> {
	const accounts: Account[] = [];
	for (let page = 0; page < MAX_PAGES; page++) {
		const rows = await lyeve.request<RawAccount[]>(
			'admin',
			`/api/admin/users?limit=${PAGE}&offset=${page * PAGE}`
		);
		const list = Array.isArray(rows) ? rows : [];
		accounts.push(...list.map(toAccount));
		if (list.length < PAGE) return { accounts, complete: true };
	}
	return { accounts, complete: false };
}

export interface EraseGuard {
	allowed: boolean;
	/** Each reason this erasure will not be sent. Empty when it may proceed. */
	refusals: string[];
	/** Things the operator should read before proceeding. Not blocking. */
	notes: string[];
	/** The account the identifier resolves to, when it resolves to one. */
	account: Account | null;
}

/**
 * Decides whether an erasure may be sent, and says why when it may not.
 *
 * Called by the confirm page and again by the action that sends the erasure.
 * The second call is not redundant: the page it renders is a URL anybody can
 * skip, so the guard has to run where the side effect happens.
 *
 * Not finding an account is not a refusal. An address with no account is the
 * ordinary case for a comment author, a form submitter or a mail recipient, and
 * their records are exactly what Art. 17 is about. Only an unfinished scan
 * refuses, because then the absence is unproven.
 */
export async function guardErase(verdict: IdentifierVerdict): Promise<EraseGuard> {
	const refusals: string[] = [];
	const notes: string[] = [];

	if (verdict.problem) refusals.push(verdict.problem);
	if (verdict.eraseBlock) refusals.push(verdict.eraseBlock);
	if (refusals.length > 0) return { allowed: false, refusals, notes, account: null };

	const [operator, scan] = await Promise.all([whoami(), scanAccounts()]);

	// Both halves are compared folded. The engine folds the address half of its
	// own DSAR query, so a capitalized copy of the operator's own address is the
	// same subject to the eraser and has to be the same subject here.
	const target = verdict.value.toLowerCase();
	if (target === operator.email.toLowerCase() || target === operator.id.toLowerCase()) {
		refusals.push(
			'This identifier is the account this app authenticates with. Erasing it anonymizes the address, empties the roles and bumps the token version, so every request after it answers 401 and the desk cannot be logged into again.'
		);
	}

	const account =
		scan.accounts.find((a) => a.email.toLowerCase() === target || a.id.toLowerCase() === target) ??
		null;

	if (account) {
		const privileged = account.roles.filter((r) => PRIVILEGED.includes(r));
		if (privileged.length > 0) {
			refusals.push(
				`That identifier is a platform operator (${privileged.join(', ')}). Removing an operator is an account-lifecycle decision, not a data-subject request, and this desk will not do it.`
			);
		}
		if (account.disabled) {
			notes.push('The account is already disabled. Erasure still anonymizes the row.');
		}
	} else if (!scan.complete) {
		refusals.push(
			`The account scan stopped at ${MAX_PAGES * PAGE} accounts without finding this identifier, so whether it belongs to an operator is unknown. The engine has no lookup by address, and this desk refuses rather than guesses.`
		);
	} else {
		notes.push(
			'No account matches this identifier. Erasure will reach plugin-owned records only: comments, form submissions, mail history, analytics properties.'
		);
	}

	return { allowed: refusals.length === 0, refusals, notes, account };
}

interface RawAccount {
	id: string;
	email: string;
	roles?: string[] | null;
	disabled?: boolean;
	tenant_id?: string;
	created_at?: string;
}

function toAccount(raw: RawAccount): Account {
	return {
		id: raw.id,
		email: raw.email,
		roles: raw.roles ?? [],
		disabled: raw.disabled ?? false,
		tenantId: raw.tenant_id ?? '',
		createdAt: raw.created_at ?? ''
	};
}
