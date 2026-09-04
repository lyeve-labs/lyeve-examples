import { fail } from '@sveltejs/kit';
import { INBOUND_FIELD_MAP, INBOUND_WEBHOOK_NAME, SHIPMENTS } from '$lib/contract';
import { ensureIncoming, findIncoming, listShipments, postSample, type SampleMode } from '$lib/server/inbound';
import { INBOUND_SECRET } from '$lib/server/lyeve';
import { listOrders } from '$lib/server/orders';
import { describe } from '$lib/server/webhooks';
import type { Actions, PageServerLoad } from './$types';

const MODES: SampleMode[] = ['valid', 'tampered', 'unsigned', 'stale', 'replayed'];

interface InboundForm {
	error?: string;
	created?: boolean;
	mode?: string;
	status?: number;
	response?: string;
	expectation?: string;
	sentHeaders?: [string, string][];
	sentBody?: string;
}

const accepted = (result: InboundForm): InboundForm => result;
const rejected = (status: number, result: InboundForm) => fail(status, result);

export const load: PageServerLoad = async () => {
	const endpoint = await findIncoming();
	const [shipments, orders] = await Promise.all([listShipments(), listOrders()]);

	return {
		name: INBOUND_WEBHOOK_NAME,
		schema: SHIPMENTS,
		fieldMap: Object.entries(INBOUND_FIELD_MAP),
		modes: MODES,
		suggestedReference: orders[0]?.reference ?? 'LY-00000',
		endpoint: endpoint
			? {
					id: endpoint.id,
					schema: endpoint.schema_name,
					fieldMap: Object.entries(endpoint.field_map ?? {}),
					allowedIps: endpoint.allowed_ips ?? [],
					enabled: endpoint.enabled
				}
			: null,
		shipments
	};
};

export const actions: Actions = {
	create: async () => {
		try {
			await ensureIncoming(INBOUND_SECRET);
			return accepted({ created: true });
		} catch (err) {
			return rejected(502, { error: describe(err, 'The inbound endpoint was not created.') });
		}
	},

	/**
	 * Posts a sample to the engine's public receive endpoint.
	 *
	 * No bearer token is involved. That route is public and the signature is
	 * the credential, which is the whole point of the inbound direction.
	 */
	send: async ({ request }) => {
		const form = await request.formData();
		const mode = String(form.get('mode') ?? 'valid');
		const reference = String(form.get('reference') ?? '').trim() || 'LY-00000';
		if (!MODES.includes(mode as SampleMode)) {
			return rejected(400, { error: 'Unknown sample.' });
		}

		const endpoint = await findIncoming();
		if (!endpoint) return rejected(409, { error: 'Create the inbound endpoint first.' });

		try {
			const result = await postSample(endpoint.id, INBOUND_SECRET, mode as SampleMode, reference);
			return accepted({
				mode: result.mode,
				status: result.status,
				response: result.response,
				expectation: result.expectation,
				sentHeaders: Object.entries(result.request.headers),
				sentBody: result.request.body
			});
		} catch (err) {
			return rejected(502, { error: describe(err, 'The sample was not sent.') });
		}
	}
};
