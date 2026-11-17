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
	},
	HOOKS_RECEIVER_SECRET: {
		description: 'Verifies the signature of a delivery the engine sends.',
		schema: (value) => value
	},
	HOOKS_INBOUND_SECRET: {
		description: 'Verifies the signature of an inbound webhook.',
		schema: (value) => value
	},
	HOOKS_RECEIVER_URL: {
		description: 'The address the engine delivers webhooks to, when not the default.',
		schema: (value) => value
	}
});
