import { VERDICT_LABELS, isAccepted, type Verdict } from '#lib/contract.ts';
import { findOrderBySlug } from '#lib/server/orders.ts';
import { countReceipts, listReceipts } from '#lib/server/receipts.ts';
import { claimedCount } from '#lib/server/replay.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const slug = url.searchParams.get('order') ?? '';

	// A relation is filtered by its foreign key and the engine does not join,
	// so narrowing by an order's reference is two requests: resolve the slug to
	// an id, then filter receipts on order_id. No parameter combination
	// collapses that into one.
	const order = slug ? await findOrderBySlug(slug) : null;
	const [receipts, total] = await Promise.all([
		listReceipts(order?.id),
		countReceipts()
	]);

	const tally = new Map<Verdict, number>();
	for (const receipt of receipts) {
		tally.set(receipt.verdict, (tally.get(receipt.verdict) ?? 0) + 1);
	}

	return {
		order: order ? { reference: order.reference, slug: order.slug } : null,
		askedFor: slug,
		total,
		nonces: claimedCount(),
		tally: [...tally.entries()].map(([verdict, count]) => ({
			verdict,
			count,
			label: VERDICT_LABELS[verdict] ?? verdict,
			good: isAccepted(verdict)
		})),
		receipts: receipts.map((receipt) => ({
			...receipt,
			label: VERDICT_LABELS[receipt.verdict] ?? receipt.verdict,
			good: isAccepted(receipt.verdict)
		}))
	};
};
