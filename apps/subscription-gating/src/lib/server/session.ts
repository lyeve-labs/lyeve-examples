import { equalDigest, hmacHex } from './digest';
import { COOKIE_SECRET } from './lyeve';

export const SESSION_COOKIE = 'sub_reader';

/**
 * A signed cookie naming the reader.
 *
 * This is a demonstration of gating, not of authentication. There is no
 * password and no proof of ownership: the sign-in form takes an email and
 * trusts it. The signature stops a visitor from editing the cookie to name a
 * different reader, which is the only property the gating logic depends on.
 * Real sign-in belongs to an identity provider or to the engine's own auth
 * plugins.
 */
export function signReaderId(id: string): string {
	return `${id}.${hmacHex(COOKIE_SECRET, id)}`;
}

export function readSignedReaderId(cookie: string | undefined): string | null {
	if (!cookie) return null;

	// The id is a UUID and carries no dot, but splitting on the last one keeps
	// the reader half intact whatever the id turns out to contain.
	const cut = cookie.lastIndexOf('.');
	if (cut <= 0) return null;

	const id = cookie.slice(0, cut);
	const given = cookie.slice(cut + 1);
	return equalDigest(given, hmacHex(COOKIE_SECRET, id)) ? id : null;
}
