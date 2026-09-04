import { fail } from '@sveltejs/kit';
import { REGISTRATIONS } from '$lib/contract';
import {
	deliveryStats,
	describe,
	dismissDeadLetter,
	getRetryConfig,
	listAttempts,
	listDeadLetters,
	listWebhooks,
	putRetryConfig,
	replayDeadLetter,
	retryDelivery,
	safely,
	searchDeliveries,
	type Attempt,
	type DeliveryStats,
	type RetryConfig
} from '$lib/server/webhooks';
import type { Actions, PageServerLoad } from './$types';

interface DeliveryForm {
	error?: string;
	retried?: string;
	status?: number;
	success?: boolean;
	message?: string;
	configured?: boolean;
	replayed?: string;
	replayStatus?: number;
	dismissed?: string;
}

const accepted = (result: DeliveryForm): DeliveryForm => result;
const rejected = (status: number, result: DeliveryForm) => fail(status, result);

const STRATEGIES = ['exponential', 'fixed', 'linear'] as const;
type Strategy = (typeof STRATEGIES)[number];

interface DeliveryRow {
	id: string;
	event: string;
	schema: string;
	status: number | null;
	success: boolean;
	durationMs: number | null;
	error: string;
	attemptedAt: string;
	retryCount: number;
	nextRetryAt: string | null;
	body: string;
}

export const load: PageServerLoad = async ({ url }) => {
	const registered = await listWebhooks();
	const ours = REGISTRATIONS.map((registration) => {
		const webhook = registered.find((wh) => wh.name === registration.name);
		return webhook
			? { channel: String(registration.channel), id: webhook.id, name: webhook.name }
			: null;
	}).filter((entry): entry is { channel: string; id: string; name: string } => entry !== null);

	const asked = url.searchParams.get('webhook') ?? '';
	const selected = ours.find((entry) => entry.id === asked) ?? ours[0] ?? null;

	const filters = {
		event: url.searchParams.get('event') ?? '',
		success: url.searchParams.get('success') ?? '',
		q: url.searchParams.get('q') ?? ''
	};

	// The dead letter queue is engine-wide rather than per webhook, so it is
	// read whether or not this app has anything registered.
	const deadLetters = (await safely(listDeadLetters('pending'))) ?? [];

	let stats: DeliveryStats | null = null;
	let retry: RetryConfig | null = null;
	let attempts: Attempt[] = [];
	let deliveries: DeliveryRow[] = [];
	let total = 0;

	if (selected) {
		const [found, statsRead, attemptsRead, retryRead] = await Promise.all([
			searchDeliveries(selected.id, {
				event: filters.event,
				success:
					filters.success === 'true' || filters.success === 'false' ? filters.success : undefined,
				q: filters.q,
				limit: 50
			}),
			safely(deliveryStats(selected.id)),
			safely(listAttempts(selected.id, 50)),
			safely(getRetryConfig(selected.id))
		]);

		stats = statsRead;
		retry = retryRead;
		attempts = attemptsRead ?? [];
		total = found.total;
		deliveries = found.items.map((delivery) => ({
			id: delivery.id,
			event: delivery.event_type,
			schema: delivery.schema_name,
			status: delivery.status_code ?? null,
			success: delivery.success,
			durationMs: delivery.duration_ms ?? null,
			error: delivery.error ?? '',
			attemptedAt: delivery.attempted_at,
			retryCount: delivery.retry_count,
			nextRetryAt: delivery.next_retry_at ?? null,
			body: delivery.request_body
		}));
	}

	return { endpoints: ours, selected, filters, stats, total, deliveries, attempts, retry, deadLetters };
};

export const actions: Actions = {
	/**
	 * Re-fires one recorded delivery.
	 *
	 * The reply is a 200 whatever the receiver said, with the outcome inside,
	 * and a new delivery row is written for the attempt. The row that failed
	 * keeps its own result: nothing marks it resolved, which is why the log
	 * reads as a history rather than a queue.
	 */
	retry: async ({ request, url }) => {
		const form = await request.formData();
		const webhook = url.searchParams.get('webhook') ?? String(form.get('webhook') ?? '');
		const delivery = String(form.get('delivery') ?? '');
		if (!webhook || !delivery) return rejected(400, { error: 'No delivery named.' });
		try {
			const result = await retryDelivery(webhook, delivery);
			return accepted({
				retried: delivery,
				status: result.status_code,
				success: result.success,
				message: result.message
			});
		} catch (err) {
			return rejected(502, { error: describe(err, 'The delivery was not re-sent.') });
		}
	},

	/** Writes the retry policy. Absent, the engine uses five attempts doubling from 30s. */
	configure: async ({ request, url }) => {
		const form = await request.formData();
		const webhook = url.searchParams.get('webhook') ?? String(form.get('webhook') ?? '');
		if (!webhook) return rejected(400, { error: 'No endpoint named.' });

		const strategy = String(form.get('strategy') ?? 'exponential');
		if (!(STRATEGIES as readonly string[]).includes(strategy)) {
			return rejected(400, { error: 'The strategy has to be exponential, fixed or linear.' });
		}
		const attempts = Number(form.get('max_attempts'));
		const base = Number(form.get('base_delay_ms'));
		const max = Number(form.get('max_delay_ms'));
		if (!Number.isInteger(attempts) || attempts < 0 || attempts > 100) {
			return rejected(400, { error: 'Attempts has to be a whole number from 0 to 100.' });
		}
		if (!Number.isInteger(base) || base < 0 || base > 3_600_000) {
			return rejected(400, { error: 'The base delay is milliseconds, up to an hour.' });
		}
		if (!Number.isInteger(max) || max < 0 || max > 86_400_000) {
			return rejected(400, { error: 'The ceiling is milliseconds, up to a day.' });
		}

		try {
			await putRetryConfig(webhook, {
				max_attempts: attempts,
				base_delay_ms: base,
				max_delay_ms: max,
				strategy: strategy as Strategy,
				enabled: form.get('enabled') === 'on'
			});
			return accepted({ configured: true });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The retry policy was not saved.') });
		}
	},

	/**
	 * Re-sends a dead letter's original body.
	 *
	 * It goes out with no signature, no timestamp and no nonce, unlike every
	 * other sender in the engine, so this app's receiver rejects it with a 401
	 * and the entry stays pending. That is the engine's behavior rather than
	 * this app's, and the reply below reports whatever really happened.
	 */
	replay: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return rejected(400, { error: 'No dead letter named.' });
		try {
			const result = await replayDeadLetter(id);
			return accepted({ replayed: id, replayStatus: result.http_status });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The replay did not happen.') });
		}
	},

	dismiss: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return rejected(400, { error: 'No dead letter named.' });
		try {
			await dismissDeadLetter(id);
			return accepted({ dismissed: id });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The entry was not dismissed.') });
		}
	}
};
