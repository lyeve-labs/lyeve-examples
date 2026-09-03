/**
 * Vocabulary shared by the pages and the server code.
 *
 * Nothing here touches the engine, so it is safe to import from a component.
 * The engine stores `status` and `priority` as plain text columns, so this file
 * is the only definition of what a valid value is.
 */

export const TICKET_STATUSES = ['open', 'pending', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = {
	open: 'Open',
	pending: 'Waiting on customer',
	closed: 'Closed'
};

export const STATUS_STYLE: Record<TicketStatus, string> = {
	open: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
	pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
	closed: 'bg-slate-100 text-slate-600 ring-slate-500/20'
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
	urgent: 'Urgent',
	high: 'High',
	normal: 'Normal',
	low: 'Low'
};

export const PRIORITY_STYLE: Record<TicketPriority, string> = {
	urgent: 'bg-rose-50 text-rose-700 ring-rose-600/20',
	high: 'bg-orange-50 text-orange-700 ring-orange-600/20',
	normal: 'bg-sky-50 text-sky-700 ring-sky-600/20',
	low: 'bg-slate-100 text-slate-600 ring-slate-500/20'
};

/** Queue order. The engine sorts by created_at only, so this is applied in the app. */
export const PRIORITY_RANK: Record<TicketPriority, number> = {
	urgent: 0,
	high: 1,
	normal: 2,
	low: 3
};

export type ReplyRole = 'agent' | 'requester';

export function isTicketStatus(value: unknown): value is TicketStatus {
	return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isTicketPriority(value: unknown): value is TicketPriority {
	return typeof value === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(value);
}

export function formatWhen(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}
