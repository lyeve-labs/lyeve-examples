import { LyeveClient } from '$lib/lyeve';
import { env } from '$env/dynamic/private';

/**
 * The engine has no anonymous read, so the credential lives here and never
 * reaches the browser. Importing this module from anything but server code is a
 * build error in SvelteKit, which is exactly the guard rail we want.
 *
 * It matters more here than in the other examples. This app holds a
 * super_admin credential because the DSAR routes accept nothing less, and that
 * credential can erase an account. Every route that uses it is a `.server`
 * file, and every erase runs behind the guards in `dsar.ts` and `operator.ts`.
 */
export const lyeve = new LyeveClient({
	apiUrl: env.LYEVE_API_URL ?? 'http://localhost:4402',
	adminUrl: env.LYEVE_ADMIN_URL ?? 'http://localhost:4401',
	email: env.LYEVE_EMAIL ?? 'admin@lyeve.example',
	password: env.LYEVE_PASSWORD ?? 'Admin12345678'
});

export const REQUESTS = 'privacy_requests';
export const OFFICERS = 'privacy_officers';
export const ACTIONS = 'privacy_actions';
