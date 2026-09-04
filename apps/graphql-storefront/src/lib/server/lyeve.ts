import { LyeveClient } from '$lib/lyeve';
import { env } from '$env/dynamic/private';

/**
 * The engine has no anonymous read, so the credential lives here and never
 * reaches the browser. That is as true of the GraphQL endpoint as of the REST
 * one: POST /api/v1/graphql sits behind requireAuth like every other route and
 * answers 401 without a bearer token.
 */
export const lyeve = new LyeveClient({
	apiUrl: env.LYEVE_API_URL ?? 'http://localhost:4402',
	adminUrl: env.LYEVE_ADMIN_URL ?? 'http://localhost:4401',
	email: env.LYEVE_EMAIL ?? 'admin@lyeve.example',
	password: env.LYEVE_PASSWORD ?? 'Admin12345678'
});

export const COLLECTIONS = 'gql_collections';
export const PRODUCTS = 'gql_products';
export const REVIEWS = 'gql_reviews';
