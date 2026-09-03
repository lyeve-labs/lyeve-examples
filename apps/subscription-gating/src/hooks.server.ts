import type { Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, readSignedReaderId } from '$lib/server/session';

/**
 * Verifies the reader cookie once per request and puts the id on locals.
 *
 * Only the id is resolved here. Loading the member costs an engine round trip,
 * and most requests, `/media/[id]` above all, never need it.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.readerId = readSignedReaderId(event.cookies.get(SESSION_COOKIE));
	return resolve(event);
};
