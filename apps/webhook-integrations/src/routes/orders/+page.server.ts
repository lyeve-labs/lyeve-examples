import { fail } from '@sveltejs/kit';
import { isOrderStatus, nextStatus } from '$lib/contract';
import { findOrderBySlug, listOrders, placeOrder, setOrderStatus } from '$lib/server/orders';
import { describe } from '$lib/server/webhooks';
import type { Actions, PageServerLoad } from './$types';

/** One shape for both actions, so the page reads `form?.error` directly. */
interface OrderForm {
	error?: string;
	placed?: string;
	moved?: string;
	status?: string;
	customer?: string;
	email?: string;
	amount?: string;
	note?: string;
}

const accepted = (result: OrderForm): OrderForm => result;
const rejected = (status: number, result: OrderForm) => fail(status, result);

export const load: PageServerLoad = async () => {
	const orders = await listOrders();
	return {
		orders: orders.map((order) => ({ ...order, next: nextStatus(order.status) }))
	};
};

export const actions: Actions = {
	/**
	 * Writes an order, which is the whole trigger. Everything downstream, the
	 * delivery, the signature, the receipt, follows from this one write with no
	 * further involvement from this page.
	 */
	place: async ({ request }) => {
		const form = await request.formData();
		const customer = String(form.get('customer') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const amount = String(form.get('amount') ?? '').trim();
		const note = String(form.get('note') ?? '').trim();
		const kept = { customer, email, amount, note };

		if (!customer) return rejected(400, { error: 'An order needs a customer.', ...kept });
		// The address is checked here rather than declared as the engine's email
		// field type. That type carries a database check constraint, and an
		// admin write mirrors into the generated table on a best-effort basis:
		// an address the constraint refuses is accepted by the API, logged on
		// the engine, and then missing from every read.
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
			return rejected(400, { error: 'That does not look like an email address.', ...kept });
		}
		const pounds = Number(amount);
		if (!Number.isFinite(pounds) || pounds <= 0) {
			return rejected(400, { error: 'The total has to be a positive number.', ...kept });
		}

		try {
			const { slug } = await placeOrder({
				reference: `LY-${Date.now().toString().slice(-5)}`,
				customer,
				email,
				totalCents: Math.round(pounds * 100),
				currency: 'GBP',
				note
			});
			return accepted({ placed: slug });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The order was not written.'), ...kept });
		}
	},

	/**
	 * Moves an order on, which is an update event carrying `old_data`. The
	 * shipped-only registration fires here and nowhere else, because its
	 * JSONPath filter reads the status out of the body.
	 */
	move: async ({ request }) => {
		const form = await request.formData();
		const slug = String(form.get('slug') ?? '');
		const target = form.get('status');
		if (!slug || !isOrderStatus(target)) {
			return rejected(400, { error: 'Unknown order or status.' });
		}

		const order = await findOrderBySlug(slug);
		if (!order) return rejected(404, { error: 'That order is no longer there.' });
		if (order.status === target) return accepted({});

		try {
			await setOrderStatus(order, target);
			return accepted({ moved: order.reference, status: target });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The order was not changed.') });
		}
	}
};
