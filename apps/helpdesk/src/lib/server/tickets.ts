/**
 * Every engine call the desk makes.
 *
 * Tickets and replies are ordinary content types. The engine's support
 * assistant models an AI chat session rather than a ticket queue, so there is
 * no ticket resource to borrow. The README says what that costs.
 */
import {
	createContent,
	getContentBySlug,
	listContent,
	relationId,
	type ContentEntry
} from '$lib/lyeve';
import { lyeve, REPLIES, TICKETS } from './lyeve';
import {
	PRIORITY_RANK,
	TICKET_STATUSES,
	isTicketPriority,
	isTicketStatus,
	type ReplyRole,
	type TicketPriority,
	type TicketStatus
} from '$lib/desk';

/** The engine clamps a page to 25..200 rows, so 200 is the largest useful ask. */
const PAGE = 200;

interface TicketFields {
	title: string;
	slug: string;
	body?: string;
	status?: string;
	priority?: string;
	requester_name?: string;
	requester_email?: string;
	attachment_media_id?: string;
}

interface ReplyFields {
	title: string;
	slug: string;
	body?: string;
	author_name?: string;
	author_role?: string;
}

export interface Ticket {
	id: string;
	slug: string;
	subject: string;
	body: string;
	status: TicketStatus;
	priority: TicketPriority;
	requesterName: string;
	requesterEmail: string;
	attachmentId: string | null;
	openedAt: string;
}

export interface Reply {
	id: string;
	body: string;
	authorName: string;
	role: ReplyRole;
	sentAt: string;
}

export interface NewTicket {
	subject: string;
	body: string;
	priority: TicketPriority;
	requesterName: string;
	requesterEmail: string;
}

export type Inbox = Record<TicketStatus, Ticket[]>;

/**
 * Reads every row a filter matches, a page at a time.
 *
 * A list response is a bare JSON array with no total and no has_more, so the
 * end of the data is a short page and nothing else. Every count this app shows
 * is therefore a full read. A desk with real volume would keep its counters
 * somewhere that can answer without one.
 */
async function readAll<T>(
	schema: string,
	filters?: Record<string, string>
): Promise<ContentEntry<T>[]> {
	const rows: ContentEntry<T>[] = [];
	for (let offset = 0; ; offset += PAGE) {
		const page = await listContent<T>(lyeve, schema, { limit: PAGE, offset, filters });
		rows.push(...page);
		if (page.length < PAGE) return rows;
	}
}

/**
 * Loads the whole desk, one query per status.
 *
 * filters[] is exact equality and the engine has no negation, so "everything
 * that is not closed" cannot be asked for. Running the exact queries and
 * merging here is the workaround, and it is the cheaper of the two: the
 * alternative is to read every ticket and drop the closed ones in memory,
 * which pulls rows the view is never going to show.
 */
export async function loadInbox(): Promise<Inbox> {
	const pages = await Promise.all(
		TICKET_STATUSES.map((status) => readAll<TicketFields>(TICKETS, { status }))
	);

	const inbox = {} as Inbox;
	TICKET_STATUSES.forEach((status, i) => {
		inbox[status] = sortForQueue(pages[i].map(toTicket));
	});
	return inbox;
}

/** Urgent first, then newest. The engine returns created_at DESC and nothing else. */
export function sortForQueue(tickets: Ticket[]): Ticket[] {
	return [...tickets].sort(
		(a, b) =>
			PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
			Date.parse(b.openedAt) - Date.parse(a.openedAt)
	);
}

/**
 * Counts replies per ticket in one pass.
 *
 * There is no aggregate and no count route, so a reply count on a list row
 * means reading the replies and grouping them here. relationId is what makes
 * the grouping possible: an unpopulated belongs_to reads back under
 * `ticket_id`, and the bare `ticket` key on the same row is always null.
 */
export async function loadReplyCounts(): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const row of await readAll<ReplyFields>(REPLIES)) {
		const ticketId = relationId(row.data, 'ticket');
		if (ticketId) counts[ticketId] = (counts[ticketId] ?? 0) + 1;
	}
	return counts;
}

export async function loadTicket(slug: string): Promise<Ticket | null> {
	const row = await getContentBySlug<TicketFields>(lyeve, TICKETS, slug);
	return row ? toTicket(row) : null;
}

/**
 * Loads a ticket's thread.
 *
 * A belongs_to relation is written under the field name and read back under
 * `<field>_id`, and the id column is what filters[] addresses.
 */
export async function loadThread(ticketId: string): Promise<Reply[]> {
	const rows = await readAll<ReplyFields>(REPLIES, { ticket_id: ticketId });
	// Rows arrive newest first. A conversation reads the other way round.
	return rows.map(toReply).reverse();
}

export async function createTicket(input: NewTicket): Promise<string> {
	const slug = uniqueSlug(input.subject);
	await createContent(lyeve, {
		schema: TICKETS,
		slug,
		title: input.subject,
		body: {
			slug,
			body: input.body,
			status: 'open',
			priority: input.priority,
			requester_name: input.requesterName,
			requester_email: input.requesterEmail
		}
	});
	return slug;
}

export async function addReply(
	ticket: Ticket,
	input: { body: string; authorName: string; role: ReplyRole }
): Promise<void> {
	const slug = uniqueSlug(`${ticket.slug}-reply`);
	await createContent(lyeve, {
		schema: REPLIES,
		slug,
		title: `Re: ${ticket.subject}`.slice(0, 200),
		body: {
			slug,
			body: input.body,
			author_name: input.authorName,
			author_role: input.role,
			// Written under the field name, read back as ticket_id.
			ticket: ticket.id
		}
	});
}

/**
 * Moves a ticket to another status.
 *
 * An edit is `PUT /api/admin/content/{id}`, and the id is the one a v1 read
 * returns: the admin write mirrors into the generated table under the same id.
 * It stays on the admin router for the same reason every write does. The public
 * v1 write path skips sys_content_entries, and an entry that never lands there
 * is invisible to search and to the admin UI for good.
 *
 * The body is replaced rather than merged, so the whole field set goes back on
 * every edit. Sending status alone would erase the message and the requester.
 */
export async function setTicketStatus(ticket: Ticket, status: TicketStatus): Promise<void> {
	const body: Record<string, unknown> = {
		title: ticket.subject,
		slug: ticket.slug,
		body: ticket.body,
		status,
		priority: ticket.priority,
		requester_name: ticket.requesterName,
		requester_email: ticket.requesterEmail
	};
	if (ticket.attachmentId) body.attachment_media_id = ticket.attachmentId;

	await lyeve.request('admin', `/api/admin/content/${ticket.id}`, {
		method: 'PUT',
		body: JSON.stringify({
			title: ticket.subject,
			slug: ticket.slug,
			body,
			// Each edit files a revision. This is the label it is filed under.
			change_note: `status changed to ${status}`
		})
	});
}

function toTicket(row: ContentEntry<TicketFields>): Ticket {
	const d = row.data;
	return {
		id: row.id,
		slug: d.slug,
		subject: d.title,
		body: d.body ?? '',
		status: isTicketStatus(d.status) ? d.status : 'open',
		priority: isTicketPriority(d.priority) ? d.priority : 'normal',
		requesterName: d.requester_name ?? 'Unknown sender',
		requesterEmail: d.requester_email ?? '',
		attachmentId: d.attachment_media_id || null,
		openedAt: row.created_at
	};
}

function toReply(row: ContentEntry<ReplyFields>): Reply {
	const d = row.data;
	return {
		id: row.id,
		body: d.body ?? '',
		authorName: d.author_name ?? 'Support',
		role: d.author_role === 'requester' ? 'requester' : 'agent',
		sentAt: row.created_at
	};
}

/**
 * Slugs are unique per tenant across every content type rather than per type,
 * and every example in this repo shares one engine and one tenant. The prefix
 * keeps the desk clear of the other apps and the suffix keeps two tickets with
 * the same subject apart.
 */
function uniqueSlug(subject: string): string {
	const base =
		subject
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'ticket';
	const prefixed = base.startsWith('desk-') ? base : `desk-${base}`;
	return `${prefixed}-${crypto.randomUUID().slice(0, 8)}`;
}
