import { fail } from '@sveltejs/kit';
import { MISMATCHED_SECRET, REGISTRATIONS, type Channel } from '$lib/contract';
import { INBOUND_SECRET } from '$lib/server/lyeve';
import { ensureIncoming, findIncoming } from '$lib/server/inbound';
import { countReceipts } from '$lib/server/receipts';
import { activeSecret, isEnvironmentKey, ringState, rotateTo } from '$lib/server/secrets';
import { newSecret } from '$lib/server/digest';
import {
	buildInput,
	deleteWebhook,
	deliveryStats,
	describe,
	ensureRegistration,
	globalHealth,
	listWebhooks,
	putRetryConfig,
	receiverUrl,
	rotateSecret,
	safely,
	testWebhook,
	updateWebhook,
	webhookHealth,
	type Webhook
} from '$lib/server/webhooks';
import type { Actions, PageServerLoad } from './$types';

/**
 * The retry policy given to the registration that is meant to fail.
 *
 * The defaults are five attempts thirty seconds apart, doubling, which is right
 * for production and means a dead letter appears about eight minutes after the
 * first failure. Two attempts five seconds apart puts one in the queue inside a
 * minute, which is the difference between reading about the dead letter queue
 * and watching it fill.
 */
const IMPATIENT_RETRIES = {
	max_attempts: 2,
	base_delay_ms: 5000,
	max_delay_ms: 30000,
	strategy: 'exponential' as const,
	enabled: true
};

/**
 * One shape for every action on this page, so the template can read
 * `form?.error` without narrowing a union of six unrelated payloads first.
 */
interface EndpointForm {
	error?: string;
	registered?: string;
	target?: string;
	rotated?: string;
	tested?: string;
	success?: boolean;
	status?: number;
	message?: string;
	toggled?: string;
	enabled?: boolean;
	removed?: string;
}

const accepted = (result: EndpointForm): EndpointForm => result;
const rejected = (status: number, result: EndpointForm) => fail(status, result);

export const load: PageServerLoad = async ({ url }) => {
	const [registered, health, inbound, receipts] = await Promise.all([
		listWebhooks(),
		safely(globalHealth()),
		safely(findIncoming()),
		safely(countReceipts())
	]);

	const mine = new Map(registered.map((wh) => [wh.name, wh]));

	const endpoints = await Promise.all(
		REGISTRATIONS.map(async (registration) => {
			const webhook = mine.get(registration.name);
			if (!webhook) {
				return {
					channel: registration.channel,
					name: registration.name,
					description: registration.description,
					holdsAppKey: !registration.mismatchedSecret,
					registered: false as const
				};
			}
			const [stats, condition] = await Promise.all([
				safely(deliveryStats(webhook.id)),
				safely(webhookHealth(webhook.id))
			]);
			return {
				channel: registration.channel,
				name: registration.name,
				description: registration.description,
				holdsAppKey: !registration.mismatchedSecret,
				registered: true as const,
				id: webhook.id,
				url: webhook.url,
				enabled: webhook.enabled,
				events: webhook.events,
				schemas: webhook.schemas,
				jsonpathFilter: webhook.jsonpath_filter ?? '',
				excludeFields: webhook.exclude_fields ?? [],
				headers: webhook.headers ?? {},
				rotatedAt: webhook.secret_rotated_at ?? null,
				stats,
				condition
			};
		})
	);

	return {
		receiverUrl: receiverUrl(url),
		health,
		receipts,
		inbound: inbound ? { id: inbound.id, schema: inbound.schema_name } : null,
		endpoints,
		keys: ringState().map((entry, index) => ({
			position: index,
			active: entry.active,
			retiresInSeconds: entry.retiresInSeconds,
			shape: shape(entry.fingerprintOf)
		})),
		usingEnvironmentKey: isEnvironmentKey(),
		// Every other webhook on the engine. The examples share one instance, so
		// this is where a registration left behind by something else shows up.
		strangers: registered
			.filter((wh) => !REGISTRATIONS.some((r) => r.name === wh.name))
			.map(summarize)
	};
};

export const actions: Actions = {
	/**
	 * Registers all three endpoints at the current origin.
	 *
	 * Idempotent: an endpoint that exists is updated rather than duplicated, so
	 * this is also the button that moves the URL after the app changes port.
	 */
	register: async ({ url }) => {
		const target = receiverUrl(url);
		try {
			const existing = await listWebhooks();
			const results: string[] = [];
			for (const registration of REGISTRATIONS) {
				const secret = registration.mismatchedSecret ? MISMATCHED_SECRET : activeSecret();
				const { webhook, created } = await ensureRegistration(
					registration,
					target,
					secret,
					existing
				);
				results.push(`${registration.channel} ${created ? 'created' : 'updated'}`);
				if (registration.mismatchedSecret) {
					await putRetryConfig(webhook.id, IMPATIENT_RETRIES);
				}
			}
			// The inbound endpoint is created here too so one button leaves the
			// whole example wired. Its secret is the app's, because the app is
			// standing in for the vendor that would hold it.
			await ensureIncoming(INBOUND_SECRET);
			return accepted({ registered: results.join(', '), target });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The endpoints were not registered.') });
		}
	},

	/** Fires a synthetic payload. The reply carries the receiver's status. */
	test: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return rejected(400, { error: 'No endpoint named.' });
		try {
			const result = await testWebhook(id);
			return accepted({
				tested: id,
				success: result.success,
				status: result.status_code,
				message: result.message
			});
		} catch (err) {
			return rejected(502, { error: describe(err, 'The test was not sent.') });
		}
	},

	/**
	 * Rotates the signing key of every endpoint that uses this app's own.
	 *
	 * Both real registrations point at the same receiver, so they share one key
	 * and have to move together. The receiver is told first: it then accepts the
	 * old key and the new one for ten minutes, which covers the deliveries
	 * already in flight and the retries the engine will make of them. Telling
	 * the engine first would drop live traffic for as long as the second call
	 * took, and for good if it failed.
	 */
	rotate: async () => {
		const next = newSecret();
		rotateTo(next);
		try {
			const existing = await listWebhooks();
			const rotated: string[] = [];
			for (const registration of REGISTRATIONS) {
				if (registration.mismatchedSecret) continue;
				const webhook = existing.find((wh) => wh.name === registration.name);
				if (!webhook) continue;
				await rotateSecret(webhook.id, next);
				rotated.push(registration.channel);
			}
			if (rotated.length === 0) {
				return rejected(409, { error: 'Nothing to rotate yet. Register the endpoints first.' });
			}
			return accepted({ rotated: rotated.join(', ') });
		} catch (err) {
			return rejected(502, {
				error: describe(err, 'The engine kept the old key; this receiver now accepts both.')
			});
		}
	},

	toggle: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const channel = String(form.get('channel') ?? '') as Channel;
		const enable = form.get('enable') === 'true';
		const registration = REGISTRATIONS.find((r) => r.channel === channel);
		if (!id || !registration) return rejected(400, { error: 'No endpoint named.' });

		try {
			const existing = await listWebhooks();
			const webhook = existing.find((wh) => wh.id === id);
			if (!webhook) return rejected(404, { error: 'That endpoint is no longer registered.' });
			const secret = registration.mismatchedSecret ? MISMATCHED_SECRET : activeSecret();
			await updateWebhook(id, buildInput(registration, webhook.url, secret, enable));
			return accepted({ toggled: channel, enabled: enable });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The endpoint was not changed.') });
		}
	},

	remove: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return rejected(400, { error: 'No endpoint named.' });
		try {
			await deleteWebhook(id);
			return accepted({ removed: id });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The endpoint was not removed.') });
		}
	}
};

/** A key's shape, never a key. */
function shape(secret: string): string {
	return `${secret.slice(0, 3)}...${secret.slice(-3)}, ${secret.length} chars`;
}

function summarize(webhook: Webhook) {
	return {
		id: webhook.id,
		name: webhook.name,
		url: webhook.url,
		enabled: webhook.enabled,
		events: webhook.events,
		schemas: webhook.schemas
	};
}
