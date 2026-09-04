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

/** The only content type this app owns. Operators annotate the timeline with it. */
export const NOTES = 'metrics_notes';

/**
 * The public probes are the only engine surface this app reaches without a
 * token, and they are not on the admin router's authenticated tree, so they are
 * fetched by URL rather than through the client.
 */
export const PUBLIC_PROBE_BASE = env.LYEVE_API_URL ?? 'http://localhost:4402';
