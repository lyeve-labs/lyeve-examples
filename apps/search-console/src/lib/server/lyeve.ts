import { LyeveClient } from '$lib/lyeve';
import { env } from '$env/dynamic/private';

/**
 * The engine has no anonymous read, and search is on the admin router only, so
 * every query on every page in this app is made by this process with this
 * credential. There is no arrangement in which the browser talks to search.
 */
export const lyeve = new LyeveClient({
	apiUrl: env.LYEVE_API_URL ?? 'http://localhost:4402',
	adminUrl: env.LYEVE_ADMIN_URL ?? 'http://localhost:4401',
	email: env.LYEVE_EMAIL ?? 'admin@lyeve.example',
	password: env.LYEVE_PASSWORD ?? 'Admin12345678'
});

export const ARTICLES = 'kb_articles';
export const CATEGORIES = 'kb_categories';
