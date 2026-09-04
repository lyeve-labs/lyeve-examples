import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'forum_visitor';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A per-browser identity, invented here.
 *
 * The vote route stores a vote against a user id and keys it on
 * (comment_id, user_id), so something has to stand in for a reader who has no
 * account. Nothing checks the id against the users table, so this cookie is
 * enough to make a vote idempotent: the same browser voting twice replaces its
 * own row rather than adding another.
 *
 * It is not authentication and it does not pretend to be. Clearing the cookie
 * buys another vote. A forum that cared would put real accounts in front of
 * this, which the engine supports and this example does not.
 */
export function visitorId(cookies: Cookies): string {
	const existing = cookies.get(COOKIE);
	if (existing && UUID.test(existing)) return existing;

	const id = crypto.randomUUID();
	cookies.set(COOKIE, id, { path: '/', maxAge: 60 * 60 * 24 * 365 });
	return id;
}
