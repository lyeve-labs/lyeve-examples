import { LyeveClient } from '$lib/lyeve';
import { env } from '$env/dynamic/private';

/**
 * The console's credential. It is an operator session, not the mobile app's
 * credential: the console mints keys and reads meters, and the phone holds a
 * key of its own. Importing this module from anything but server code is a
 * build error in SvelteKit, which is the guard rail we want.
 */
export const lyeve = new LyeveClient({
	apiUrl: env.LYEVE_API_URL ?? 'http://localhost:4402',
	adminUrl: env.LYEVE_ADMIN_URL ?? 'http://localhost:4401',
	email: env.LYEVE_EMAIL ?? 'admin@lyeve.example',
	password: env.LYEVE_PASSWORD ?? 'Admin12345678'
});

/** Shown on the pages so the reader can reproduce a call with curl. */
export const PUBLIC_API_URL = env.LYEVE_API_URL ?? 'http://localhost:4402';

export const LINES = 'mobile_lines';
export const STOPS = 'mobile_stops';
export const NOTICES = 'mobile_notices';

/**
 * The tenant every request on this stack resolves to.
 *
 * The stack runs with MULTI_TENANT=false, so a super_admin session with no
 * X-Tenant-ID header and an API key with no tenant claim both resolve to the
 * slug the engine names implicitly. Quotas, keys and usage are all filed under
 * it, which is why the quota on this page is shared with every other example.
 */
export const TENANT = 'default';
