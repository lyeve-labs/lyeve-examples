import { LyeveClient } from './client.ts';

/**
 * Builds a client from the environment every example shares.
 *
 * Reads plain `process.env` rather than SvelteKit's `$env/static/private` so
 * that the seed scripts and the framework-free example can use it too.
 */
export function lyeveFromEnv(): LyeveClient {
	return new LyeveClient({
		apiUrl: required('LYEVE_API_URL'),
		adminUrl: required('LYEVE_ADMIN_URL'),
		email: required('LYEVE_EMAIL'),
		password: required('LYEVE_PASSWORD')
	});
}

function required(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`${key} is not set. Copy .env.example to .env and run \`make up\` from the repo root.`);
	}
	return value;
}
