import { defineEnvVars } from '@sveltejs/kit/env';

// SvelteKit reads only the variables declared here. Each one is optional,
// so an unset variable reads as undefined and the code falls back to its
// local default.
export const variables = defineEnvVars({
	LYEVE_API_URL: {
		description: 'The engine API the app reads and writes through.',
		schema: (value) => value
	},
	LYEVE_ADMIN_URL: {
		description: 'The engine admin address the app signs in at.',
		schema: (value) => value
	},
	LYEVE_EMAIL: {
		description: 'The engine account the app signs in as.',
		schema: (value) => value
	},
	LYEVE_PASSWORD: {
		description: 'The password of that account.',
		schema: (value) => value
	}
});
