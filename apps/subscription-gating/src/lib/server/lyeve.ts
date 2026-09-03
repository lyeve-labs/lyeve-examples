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

export const ARTICLES = 'sub_articles';
export const MEMBERS = 'sub_members';

export const COOKIE_SECRET =
	env.SUBSCRIPTION_COOKIE_SECRET ?? 'subscription-gating-dev-cookie-secret';
export const WEBHOOK_SECRET =
	env.SUBSCRIPTION_WEBHOOK_SECRET ?? 'subscription-gating-dev-webhook-secret';
