import { LyeveClient } from '$lib/lyeve';
import { env } from '$env/dynamic/private';

/**
 * The engine has no anonymous read, so the credential lives here and never
 * reaches the browser. Importing this module from anything but server code is a
 * build error in SvelteKit, which is exactly the guard rail we want.
 *
 * Everything this control panel does needs the super_admin role: tenant CRUD is
 * platform-level, and reading another tenant's keys or usage means overriding
 * the request's tenant scope. The stack's first account holds that role.
 */
export const lyeve = new LyeveClient({
	apiUrl: env.LYEVE_API_URL ?? 'http://localhost:4402',
	adminUrl: env.LYEVE_ADMIN_URL ?? 'http://localhost:4401',
	email: env.LYEVE_EMAIL ?? 'admin@lyeve.example',
	password: env.LYEVE_PASSWORD ?? 'Admin12345678'
});

/** The public router, used only by the API-key probe on the tenant page. */
export const API_URL = env.LYEVE_API_URL ?? 'http://localhost:4402';
