/**
 * What the receiver decided about each delivery.
 *
 * A receipt is written for a rejection as well as an acceptance, because the
 * rejections are the interesting half: a 401 here is the only place a wrong
 * key, a drifted clock or an unsigned sender shows up as one sentence.
 */
import {
	createContent,
	listContent,
	related,
	relationId,
	type ContentEntry
} from '$lib/lyeve';
import { RECEIPTS, type Channel, type Verdict } from '$lib/contract';
import { lyeve } from './lyeve';

interface ReceiptFields {
	title: string;
	slug: string;
	event: string;
	source_schema: string;
	channel: string;
	verdict: string;
	http_status: number;
	detail: string;
	signature_algo: string;
	signature_mode: string;
	nonce: string;
	key_index: number;
	payload: string;
	received_at: string;
	order?: string;
}

export interface Receipt {
	id: string;
	event: string;
	sourceSchema: string;
	channel: string;
	verdict: Verdict;
	httpStatus: number;
	detail: string;
	algorithm: string;
	mode: string;
	nonce: string;
	keyIndex: number;
	payload: string;
	receivedAt: string;
	orderId: string | null;
	orderReference: string | null;
	orderSlug: string | null;
}

/**
 * The stored payload is a record, not evidence.
 *
 * The content write path sanitizes HTML inside any string it is given, so a
 * payload carrying markup is not stored byte for byte. A signature can only
 * ever be checked against the bytes as they arrived, which is why the receiver
 * verifies before it writes and never tries to re-verify a receipt.
 */
const PAYLOAD_LIMIT = 4000;

export interface NewReceipt {
	event: string;
	sourceSchema: string;
	channel: Channel | 'unknown';
	verdict: Verdict;
	httpStatus: number;
	detail: string;
	algorithm: string | null;
	mode: string;
	nonce: string | null;
	keyIndex: number | null;
	payload: string;
	/** Only set when the payload names an order that certainly still exists. */
	orderId?: string | null;
}

export async function recordReceipt(input: NewReceipt): Promise<void> {
	const at = new Date();
	const slug = `receipt-${at.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
	const body: Record<string, unknown> = {
		slug,
		event: input.event,
		source_schema: input.sourceSchema,
		channel: input.channel,
		verdict: input.verdict,
		http_status: input.httpStatus,
		detail: input.detail,
		signature_algo: input.algorithm ?? '',
		signature_mode: input.mode,
		nonce: input.nonce ?? '',
		key_index: input.keyIndex ?? -1,
		payload: input.payload.slice(0, PAYLOAD_LIMIT),
		received_at: at.toISOString()
	};

	// A relation is written under its field name and read back as
	// `<field>_id`. It is only set when the order is known to be there: the
	// column is a foreign key against the orders table, and an id that has
	// gone leaves the mirror unable to write the row, which would lose the
	// receipt from every content read while the admin API still reported it
	// created.
	if (input.orderId) body.order = input.orderId;

	await createContent(lyeve, {
		schema: RECEIPTS,
		slug,
		title: `${input.event} ${input.channel} ${input.verdict}`,
		body,
		status: 'published'
	});
}

function toReceipt(row: ContentEntry<ReceiptFields>): Receipt {
	// A populated relation arrives as the whole related record, so the order's
	// own reference and slug come back without a second read.
	const order = related<{ title?: string; slug?: string }>(row.data, 'order');
	return {
		id: row.id,
		event: row.data.event ?? '',
		sourceSchema: row.data.source_schema ?? '',
		channel: row.data.channel ?? 'unknown',
		verdict: (row.data.verdict ?? 'accepted') as Verdict,
		httpStatus: Number(row.data.http_status ?? 0),
		detail: row.data.detail ?? '',
		algorithm: row.data.signature_algo ?? '',
		mode: row.data.signature_mode ?? '',
		nonce: row.data.nonce ?? '',
		keyIndex: Number(row.data.key_index ?? -1),
		payload: row.data.payload ?? '',
		receivedAt: row.data.received_at || row.created_at,
		orderId: relationId(row.data, 'order'),
		orderReference: order?.title ?? null,
		orderSlug: order?.slug ?? null
	};
}

/**
 * Lists receipts, optionally narrowed to one order.
 *
 * A relation is filtered by its foreign key, `order_id`, and never by the
 * field name: `filters[order]=` is a 400. The engine also does not join, so
 * narrowing by an order's reference means resolving that reference to an id
 * first. Two requests, and no combination of parameters collapses them.
 */
export async function listReceipts(orderId?: string): Promise<Receipt[]> {
	const rows = await listContent<ReceiptFields>(lyeve, RECEIPTS, {
		limit: 200,
		populate: ['order'],
		filters: orderId ? { order_id: orderId } : undefined
	});
	return rows.map(toReceipt);
}

/**
 * The count of receipts.
 *
 * A content list is a bare array with no total, so the number comes from the
 * admin listing, which does carry one. That route also honors a page size
 * below 25, where the public read clamps it up.
 */
export async function countReceipts(): Promise<number> {
	const page = await lyeve.request<{ total_count: number }>(
		'admin',
		`/api/admin/content?schema=${RECEIPTS}&limit=1`
	);
	return page?.total_count ?? 0;
}
