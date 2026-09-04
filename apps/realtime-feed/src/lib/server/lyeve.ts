import { LyeveClient } from '$lib/lyeve';
import { env } from '$env/dynamic/private';

/**
 * The engine has no anonymous read, so the credential lives here and never
 * reaches the browser. That applies to the event stream too: the browser opens
 * an EventSource against this app, and this app opens the engine's stream.
 */
export const lyeve = new LyeveClient({
	apiUrl: env.LYEVE_API_URL ?? 'http://localhost:4402',
	adminUrl: env.LYEVE_ADMIN_URL ?? 'http://localhost:4401',
	email: env.LYEVE_EMAIL ?? 'admin@lyeve.example',
	password: env.LYEVE_PASSWORD ?? 'Admin12345678'
});

export const SERVICES = 'status_services';
export const INCIDENTS = 'status_incidents';
export const UPDATES = 'status_updates';

/**
 * The schemas the live route watches.
 *
 * Every name here is one more upstream connection per connected browser,
 * because the engine's stream is per schema. Services are left out on purpose:
 * they change when someone edits the board's structure, not during an incident,
 * and the periodic resync picks that up within thirty seconds.
 */
export const WATCHED = [INCIDENTS, UPDATES] as const;
