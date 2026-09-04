import { LyeveClient } from '$lib/lyeve';
import { env } from '$env/dynamic/private';

/**
 * The engine has no anonymous read, so the credential lives here and never
 * reaches the browser. Importing this module from anything but server code is a
 * build error in SvelteKit, which is exactly the guard rail we want.
 *
 * The localization plugin's resolve route is declared public and is genuinely
 * mounted without `requireAuth`, but it still needs this credential: the tenant
 * a request acts in is read from the token, and with no tenant the entry lookup
 * matches nothing and answers 404. Verified against the running engine.
 */
export const lyeve = new LyeveClient({
	apiUrl: env.LYEVE_API_URL ?? 'http://localhost:4402',
	adminUrl: env.LYEVE_ADMIN_URL ?? 'http://localhost:4401',
	email: env.LYEVE_EMAIL ?? 'admin@lyeve.example',
	password: env.LYEVE_PASSWORD ?? 'Admin12345678'
});

export const PAGES = 'i18n_pages';
export const SECTIONS = 'i18n_sections';
