/**
 * Step 1. Get a token, and understand how long it lasts.
 *
 *   pnpm authenticate
 *
 * There is no anonymous read anywhere on the engine. Two content routes, every
 * schema route, search, media: all of them sit behind a bearer token. The only
 * doors that open without one are the setup probe, the two login routes and the
 * health probes. That single fact decides the shape of every LyEve application:
 * the credential lives on a server, and a browser talks to that server instead
 * of to the engine.
 */
import { getSetupStatus, isMFAChallenge, login, type TokenResponse } from '@lyeve-labs/client-rest';
import { cacheToken, credentials, endpoints, heading, note, publicClient, readClaims, row, run, section } from './lyeve.ts';

await run(async () => {
	heading('01  Authenticate');

	const hosts = endpoints();
	row('admin router', hosts.adminUrl);
	row('public v1 router', hosts.apiUrl);

	// No token yet, so no Authorization header. This client can still reach the
	// handful of public routes.
	const anonymous = publicClient();

	section('Is this engine claimed?');
	const status = await getSetupStatus(anonymous);
	row('setup_required', status.setup_required);
	note(
		status.setup_required
			? 'No account exists yet. POST /api/admin/setup creates the first one, and only ever the first one, for a caller holding the setup token.'
			: 'An account already exists, so the setup route is closed and login is the way in.'
	);

	section('Log in through the admin router');
	const { email, password } = credentials();
	const result = await login(email, password, anonymous);

	// login() can answer with a challenge instead of a session when the account
	// has a second factor, or when the engine's risk assessment demands one.
	// The two shapes share a return type, so the guard is not optional.
	if (isMFAChallenge(result)) {
		throw new Error('this account has MFA enrolled; the examples expect an account that does not');
	}

	// Parked for the other five scripts. The login route is rate limited hard,
	// so a tour that logged in six times would not finish.
	cacheToken(result.token);

	row('user', result.user.email);
	row('roles', result.user.roles.join(', '));
	row('token', `${result.token.slice(0, 24)}...`);

	section('What the token says about itself');
	const claims = readClaims(result.token);
	const lifetime = (claims.exp ?? 0) - (claims.iat ?? 0);
	row('subject', claims.sub ?? '(none)');
	row('tenant', claims.tenant_id || '(single tenant)');
	row('issued at', new Date((claims.iat ?? 0) * 1000).toISOString());
	row('expires at', new Date((claims.exp ?? 0) * 1000).toISOString());
	row('lifetime', `${lifetime}s (${Math.round(lifetime / 60)} min)`);

	section('The other door: the public token route');
	// The v1 router issues the same kind of token and, unlike the admin login,
	// states the lifetime in the response. @lyeve-labs/client-rest declares the
	// TokenResponse type for it but ships no function, so this is a plain post.
	const issued = await anonymous.post<TokenResponse>('/api/v1/auth/token', { email, password });
	row('expires_in', `${issued.expires_in}s`);

	section('What to do with that');
	note('There is no refresh token on this path. A server that outlives the token logs in again.');
	note('Logging in is rate limited: a burst of 5, then one more every three minutes or so, per address.');
	note('One token works on both routers. The port a call goes to is decided by its path, not by its token.');
	note('Nothing here belongs in a browser. Ship the token to the client and you have published your admin account.');
});
