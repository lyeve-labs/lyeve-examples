/**
 * The mobile app.
 *
 *   pnpm client
 *
 * It reads a scoped API key from the environment and calls the engine
 * directly, which is what a phone does and what no other example in this
 * repository does. Every other app is a server holding an operator session
 * because a browser cannot be given one. A native client can be given a key,
 * and a key is the credential the engine designs for exactly that.
 *
 * The run makes six requests to the public router and one to the admin router,
 * and prints what the engine answered, including the two refusals. The counts
 * at the end reconcile against the console, which is the point: the meter and
 * the audit trail do not agree, and the reason is where their middleware sits.
 */
import { apiKey, call, callLog, endpoints, heading, note, quotaHeaders, row, run, step } from './lib.ts';

const NOTICES = 'mobile_notices';
const PAGE = 2;

await run(async () => {
	const key = apiKey('LYEVE_MOBILE_API_KEY');
	const { apiUrl, adminUrl } = endpoints();

	heading('Transit app, talking to the engine with a scoped key');
	row('key', `${key.slice(0, 11)}... (${key.length} chars, X-API-Key header)`);
	row('public router', apiUrl);
	row('admin router', adminUrl);

	step(1, 'Where the tenant stands. GET /api/v1/quotas/status');
	// This route is declared in the plugin's authenticated group rather than
	// its scoped group, so it answers for a key with no scopes at all. Nothing
	// in the response says so and there is no catalog to look it up in.
	const quota = await call(key, { path: '/api/v1/quotas/status', auditable: false });
	row('status', quota.status);
	for (const line of quotaHeaders(quota.headers)) note(line);
	if (quota.status === 200 && quota.body && typeof quota.body === 'object') {
		const body = quota.body as Record<string, unknown>;
		row('body', 'requests_limit' in body ? body : 'no quota row, so unlimited');
	}
	note('The headers are on every response, including the ones the engine refuses.');

	step(2, `The feed, page one. GET /api/v1/content/${NOTICES}/cursor?limit=${PAGE}&populate=line`);
	const first = await call(key, {
		path: `/api/v1/content/${NOTICES}/cursor?limit=${PAGE}&populate=line`
	});
	row('status', first.status);
	printPage(first.body);

	const nextCursor = cursorOf(first.body);
	if (nextCursor) {
		step(3, 'The same read, one cursor along');
		const second = await call(key, {
			path: `/api/v1/content/${NOTICES}/cursor?limit=${PAGE}&cursor=${nextCursor}&populate=line`
		});
		row('status', second.status);
		printPage(second.body);
		note('Ordering is by row id, which is a random UUID. Compare the written timestamps:');
		note('they are not in order. The cursor is stable, not chronological.');
	} else {
		step(3, 'No next cursor, so there was only one page');
		note('Run pnpm run setup if that is a surprise.');
	}

	step(4, `The other read of the same collection. GET /api/v1/content/${NOTICES}?limit=${PAGE}`);
	const offset = await call(key, { path: `/api/v1/content/${NOTICES}?limit=${PAGE}` });
	row('status', offset.status);
	row('rows asked for', PAGE);
	row('rows returned', Array.isArray(offset.body) ? offset.body.length : 'not an array');
	note('The offset route clamps the page to 25 and answers with a bare array, no envelope');
	note('and no total. A page of two is only available on the cursor route.');

	step(5, 'What content types exist. GET /api/v1/schemas');
	const schemas = await call(key, { path: '/api/v1/schemas' });
	row('status', schemas.status);
	if (Array.isArray(schemas.body)) {
		const names = schemas.body
			.map((s) => (s as { name?: string }).name ?? '')
			.filter((n) => n.startsWith('mobile_'));
		row('this app owns', names.join(', ') || 'none');
		row('types visible', schemas.body.length);
		note('Every type on the engine, not only the ones this app owns. The key names its');
		note('own in a schemas list that the engine stores and then never reads.');
	}

	step(6, `A write the key was not minted for. POST /api/v1/content/${NOTICES}`);
	const write = await call(key, {
		method: 'POST',
		path: `/api/v1/content/${NOTICES}`,
		body: { data: { title: 'Unauthorized notice', slug: 'mobile-notice-should-not-exist' } }
	});
	row('status', write.status);
	row('body', write.body);
	row('content-type', write.contentType || 'absent');
	note('403 from the scope check: POST derives content:write and the key holds content:read.');
	note('The refusal is JSON text served as text/plain, so a client that parses by');
	note('content type has to special-case it.');

	step(7, 'The admin router, with the same key. GET /api/admin/api-keys');
	const admin = await call(key, { router: 'admin', path: '/api/admin/api-keys?limit=25' });
	row('status', admin.status);
	row('body', admin.body);
	note('The path derives api-keys:read, which this key does not hold. Worth knowing what');
	note('the refusal is not: the admin routes are role gated, and a key carrying no role');
	note('passes every role gate. Scopes are the only thing standing here.');

	heading('What the console should show');
	const log = callLog();
	const metered = log.filter((c) => c.router === 'public').length;
	const audited = log.filter((c) => c.router === 'public' && c.auditable && !c.scopeRefused).length;
	row('requests metered', metered);
	row('audit rows', audited);
	note('Metering is wired ahead of the scope check, so a refusal is billed. The audit');
	note('middleware is wired after it, so a refusal is not recorded, and the quota status');
	note('route carries no audit middleware at all. The gap is the two of them.');
	note('The admin call is neither: metering runs on the public router only.');
});

function printPage(body: unknown): void {
	if (!body || typeof body !== 'object' || !('data' in body)) {
		row('body', body);
		return;
	}
	const rows = (body as { data?: unknown[] }).data ?? [];
	for (const entry of rows) {
		const e = entry as { id: string; created_at: string; data: Record<string, unknown> };
		const line = e.data.line as { title?: string } | null;
		row(
			`${e.id.slice(0, 8)} ${(line?.title ?? 'Network wide').padEnd(18)}`,
			`${String(e.data.title)}  [written ${e.created_at}]`
		);
	}
	row('next_cursor', (body as { next_cursor?: string }).next_cursor || 'empty');
}

function cursorOf(body: unknown): string {
	if (!body || typeof body !== 'object') return '';
	return (body as { next_cursor?: string }).next_cursor ?? '';
}
