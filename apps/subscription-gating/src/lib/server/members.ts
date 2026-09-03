import { listContent, getContent, type ContentEntry } from '$lib/lyeve';
import { lyeve, MEMBERS } from './lyeve';
import { isMemberStatus, isTier, type MemberStatus, type Reader, type Tier } from './tiers';

interface MemberData {
	title: string;
	slug: string;
	email?: string;
	tier?: string;
	status?: string;
}

/** The shape the admin router returns for a single entry. */
interface AdminEntry {
	id: string;
	schema: string;
	slug: string;
	title: string;
	body: Record<string, unknown>;
	status: string;
}

/**
 * Emails are matched with `filters[email]=`, which is exact equality with no
 * case folding, so every email is normalized on the way in and on the way out.
 * Skipping this makes a webhook from a provider that capitalizes the local part
 * silently match nothing.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function findReaderByEmail(email: string): Promise<Reader | null> {
	const wanted = normalizeEmail(email);
	if (!wanted) return null;

	const rows = await listContent<MemberData>(lyeve, MEMBERS, {
		limit: 25,
		filters: { email: wanted }
	});
	// The filter is re-applied here because "exact equality" is the engine's
	// promise, not the database's. MySQL and MSSQL both default to a
	// case-insensitive collation, so on those dialects the filter folds case and
	// can return a neighbor. On Postgres this loop never rejects anything.
	const row = rows.find((r) => normalizeEmail(r.data.email ?? '') === wanted);
	return row ? toReader(row) : null;
}

export async function findReaderById(id: string): Promise<Reader | null> {
	const row = await getContent<MemberData>(lyeve, MEMBERS, id);
	return row ? toReader(row) : null;
}

export async function listReaders(): Promise<Reader[]> {
	const rows = await listContent<MemberData>(lyeve, MEMBERS, { limit: 25 });
	return rows.map(toReader).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Records what the payment provider says a reader is entitled to.
 *
 * Two things about this call are not obvious.
 *
 * The write goes to the admin router. `PUT /api/v1/content/{schema}/{id}`
 * exists and looks like the shorter path, but it writes only the projection
 * that the public reads are served from. `sys_content_entries` would keep the
 * old tier, search and the admin UI would keep showing it, and the next admin
 * write would mirror the stale value back over the new one.
 *
 * The body is replaced wholesale rather than merged, so the current entry is
 * read first. Sending only the changed keys drops every other field, and the
 * engine answers 422 for whichever of them the schema marks required.
 */
export async function setSubscription(
	readerId: string,
	tier: Tier,
	status: MemberStatus
): Promise<Reader> {
	const entry = await lyeve.request<AdminEntry>('admin', `/api/admin/content/${readerId}`);

	// `body.status` is the subscription status. The entry's own top-level
	// status is draft/published and is deliberately not sent, so the update
	// cannot unpublish the record.
	const body = { ...entry.body, tier, status };

	await lyeve.request<AdminEntry>('admin', `/api/admin/content/${readerId}`, {
		method: 'PUT',
		body: JSON.stringify({ body, change_note: `subscription ${status} on ${tier}` })
	});

	return {
		id: readerId,
		name: entry.title,
		email: normalizeEmail(String(entry.body.email ?? '')),
		tier,
		status
	};
}

function toReader(row: ContentEntry<MemberData>): Reader {
	return {
		id: row.id,
		name: row.data.title,
		email: normalizeEmail(row.data.email ?? ''),
		// A value the engine never constrained can be anything, so it is
		// narrowed here rather than cast. The engine has no enum field type.
		tier: isTier(row.data.tier) ? row.data.tier : 'free',
		status: isMemberStatus(row.data.status) ? row.data.status : 'canceled'
	};
}
