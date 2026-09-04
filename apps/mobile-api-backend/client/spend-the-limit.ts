/**
 * Spends a key's monthly allowance until the engine refuses it.
 *
 *   pnpm client:limit
 *
 * The probe key that setup mints carries no scopes and a monthly limit of
 * three, which makes it useful for two things at once. It shows that an empty
 * scope list is fail-closed everywhere the engine checks scopes, and it shows
 * what happens when the per-key limit runs out, without spending anything the
 * rest of the example needs.
 *
 * The counter is per key, per calendar month, and no route resets it. Once
 * this run finishes the key is done until the month rolls over, or until the
 * limit is raised on the key's page in the console. That is the recovery path,
 * and it is worth knowing before a real client hits this in production.
 */
import { apiKey, call, heading, note, quotaHeaders, row, run, step } from './lib.ts';

const MAX_TRIES = 8;

await run(async () => {
	const key = apiKey('LYEVE_MOBILE_PROBE_KEY');

	heading('Spending a per-key monthly limit');
	row('key', `${key.slice(0, 11)}...`);
	note('The limit is enforced by the usage plugin, on the public router, per key.');
	note('It is not the tenant quota, which is a different counter with different headers.');

	step(1, 'A content read, which this key has no scope for');
	const refused = await call(key, { path: '/api/v1/content/mobile_notices?limit=25' });
	row('status', refused.status);
	row('body', refused.body);
	note('An empty scope list grants nothing. The key authenticated and was then refused,');
	note('and the refusal was still billed to it.');

	step(2, 'GET /api/v1/quotas/status, repeatedly, until the engine says no');
	let refusedAt = 0;
	for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
		const res = await call(key, { path: '/api/v1/quotas/status', auditable: false });
		const headers = quotaHeaders(res.headers);
		row(`attempt ${attempt}`, `${res.status} ${headers.join('  ') || ''}`.trim());

		if (res.status === 429) {
			row('body', res.body);
			refusedAt = attempt;
			break;
		}
	}

	heading('What that was');
	if (refusedAt === 0) {
		note(`Still accepted after ${MAX_TRIES} requests, so the key has room left or no limit.`);
		note('Set a small monthly limit on the key page and run this again.');
		return;
	}

	note(`Refused on attempt ${refusedAt} with 429 and X-RateLimit-Exceeded: true.`);
	note('Two things about that 429 are worth planning for.');
	note('It carries no Retry-After and no header saying how much of the allowance is');
	note('left, so a client cannot back off intelligently: the only signal is the refusal');
	note('itself. And it is a different 429 from the tenant quota\'s, which carries');
	note('X-Quota-Blocked and a body naming the limit. A client that has to tell them');
	note('apart reads the headers, not the status.');
	note('Recovery: raise monthly_limit on the key page. Nothing resets the counter.');
});
