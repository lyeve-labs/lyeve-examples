/**
 * The session identifier search analytics are grouped by.
 *
 * The engine takes `session_id` from the request body, not from the token, so
 * whatever this app sends is what the analytics row carries. A click is matched
 * to a logged search by query text and session id together, so the two writes
 * have to agree, and the id has to survive the redirect between them. A cookie
 * is the only place it can live.
 *
 * The value is opaque and carries no user data. The engine's erasure path
 * deletes analytics rows by session id for a non-UUID identifier and by user id
 * for a UUID, so an opaque random string is also the shape that can be erased
 * without naming a person.
 */
import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'kb_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export function sessionId(cookies: Cookies): string {
	const existing = cookies.get(COOKIE);
	if (existing) return existing;

	const fresh = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
	cookies.set(COOKIE, fresh, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: MAX_AGE
	});
	return fresh;
}
