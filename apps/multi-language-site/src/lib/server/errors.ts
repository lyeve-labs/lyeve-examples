import { LyeveError } from '$lib/lyeve';

/**
 * Turns an engine failure into something a form can display.
 *
 * The three error envelopes are already flattened by the shared client, so this
 * only has to decide what a person should be told. The status matters here
 * because the translation routes use two of them to mean ordinary editing
 * states: 404 for a locale with no row, 409 for a locale that already has one.
 */
export function describeFailure(err: unknown): { status: number; message: string } {
	if (err instanceof LyeveError) {
		if (err.status === 404) return { status: 404, message: 'That translation no longer exists.' };
		if (err.status === 409) {
			return { status: 409, message: 'That locale already has a translation.' };
		}
		if (err.status === 429) {
			return { status: 429, message: 'The engine is rate limiting. Try again in a moment.' };
		}
		return { status: err.status, message: err.message };
	}
	return { status: 500, message: 'The engine could not be reached.' };
}
