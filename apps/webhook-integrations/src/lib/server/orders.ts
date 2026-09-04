/**
 * The orders this app owns. Writing one is what makes the engine deliver.
 */
import { createContent, listContent, type ContentEntry } from '$lib/lyeve';
import { ORDERS, isOrderStatus, type OrderStatus } from '$lib/contract';
import { lyeve } from './lyeve';

interface OrderFields {
	title: string;
	slug: string;
	customer: string;
	customer_email: string;
	status: string;
	total_cents: number;
	currency: string;
	note: string;
}

export interface Order {
	id: string;
	reference: string;
	slug: string;
	customer: string;
	email: string;
	status: OrderStatus;
	totalCents: number;
	currency: string;
	note: string;
	placedAt: string;
}

/** The engine clamps a content page to 25..200 rows, so 200 is the largest useful ask. */
const PAGE = 200;

function toOrder(row: ContentEntry<OrderFields>): Order {
	const status = row.data.status;
	return {
		id: row.id,
		reference: row.data.title,
		slug: row.data.slug,
		customer: row.data.customer ?? '',
		email: row.data.customer_email ?? '',
		status: isOrderStatus(status) ? status : 'pending',
		totalCents: Number(row.data.total_cents ?? 0),
		currency: row.data.currency || 'GBP',
		note: row.data.note ?? '',
		placedAt: row.created_at
	};
}

export async function listOrders(): Promise<Order[]> {
	const rows = await listContent<OrderFields>(lyeve, ORDERS, { limit: PAGE });
	return rows.map(toOrder);
}

export async function findOrderBySlug(slug: string): Promise<Order | null> {
	const rows = await listContent<OrderFields>(lyeve, ORDERS, { filters: { slug }, limit: 25 });
	const row = rows[0];
	return row ? toOrder(row) : null;
}

export interface NewOrder {
	reference: string;
	customer: string;
	email: string;
	totalCents: number;
	currency: string;
	note: string;
}

/**
 * Writes an order through the admin route.
 *
 * That route is the one that publishes the lifecycle event the webhook
 * dispatcher subscribes to, and it is also the only path that lands in
 * `sys_content_entries`. The public content write does publish an event too,
 * but its payload is the generated row rather than the entry, and what it
 * writes is invisible to search for good.
 */
export async function placeOrder(input: NewOrder): Promise<{ id: string; slug: string }> {
	const slug = input.reference.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	const body = {
		slug,
		customer: input.customer,
		customer_email: input.email,
		status: 'pending',
		total_cents: input.totalCents,
		currency: input.currency,
		note: input.note
	};
	const { id } = await createContent(lyeve, {
		schema: ORDERS,
		slug,
		title: input.reference,
		body,
		status: 'published'
	});
	return { id, slug };
}

/**
 * Moves an order on, which fires an update event carrying `old_data`.
 *
 * The update route merges the fields it is given and replaces `body`
 * wholesale, so the whole body goes back every time. Sending only the changed
 * key would leave the order with one field and nothing else.
 */
export async function setOrderStatus(order: Order, status: OrderStatus): Promise<void> {
	await lyeve.request('admin', `/api/admin/content/${order.id}`, {
		method: 'PUT',
		// The entry's own status is left alone: it is the draft and publish
		// flag, not the order's, and the two are different words for different
		// things sitting one level apart in the same payload.
		body: JSON.stringify({
			schema: ORDERS,
			title: order.reference,
			slug: order.slug,
			change_note: `status ${order.status} to ${status}`,
			body: {
				title: order.reference,
				slug: order.slug,
				customer: order.customer,
				customer_email: order.email,
				status,
				total_cents: order.totalCents,
				currency: order.currency,
				note: order.note
			}
		})
	});
}
