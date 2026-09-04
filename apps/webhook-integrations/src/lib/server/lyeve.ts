import { LyeveClient } from '$lib/lyeve';
import { env } from '$env/dynamic/private';

/**
 * The engine has no anonymous read, so the credential lives here and never
 * reaches the browser. Importing this module from anything but server code is a
 * build error in SvelteKit, which is exactly the guard rail we want.
 */
export const lyeve = new LyeveClient({
	apiUrl: env.LYEVE_API_URL ?? 'http://localhost:4402',
	adminUrl: env.LYEVE_ADMIN_URL ?? 'http://localhost:4401',
	email: env.LYEVE_EMAIL ?? 'admin@lyeve.example',
	password: env.LYEVE_PASSWORD ?? 'Admin12345678'
});

/**
 * The public router's root, needed on its own because the inbound sample is
 * posted to `/api/v1/webhooks/in/{id}` without a bearer token: that route is
 * public, and its signature is the credential.
 */
export const API_URL = env.LYEVE_API_URL ?? 'http://localhost:4402';

/**
 * The key the engine signs outbound deliveries with, and the one this app
 * verifies. Same value on both sides of the wire, held here because the engine
 * never hands a webhook secret back once it is stored.
 */
export const RECEIVER_SECRET =
	env.HOOKS_RECEIVER_SECRET ?? 'webhook-integrations-dev-receiver-secret';

/** The key a vendor signs the inbound endpoint with. */
export const INBOUND_SECRET = env.HOOKS_INBOUND_SECRET ?? 'webhook-integrations-dev-inbound-secret';

/**
 * Where the engine should deliver. Empty is the useful default: the register
 * action then uses the origin the operator is looking at, which is right both
 * on the dev port and behind the preview server on a different one.
 */
export const RECEIVER_URL_OVERRIDE = env.HOOKS_RECEIVER_URL ?? '';
