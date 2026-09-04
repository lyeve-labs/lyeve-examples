/**
 * Creates the transit content types, seeds them, and mints the two API keys
 * the client program uses.
 *
 * Safe to run more than once. Applying a schema that exists is accepted,
 * seeding stops if the notices are already there, and a key is minted only
 * when there is no live key of that name paired with a secret in client/.env.
 * That pairing matters: the raw key exists exactly once, in the create
 * response, so a key row we cannot pair with a local secret is useless and is
 * replaced rather than kept.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const LINES = 'mobile_lines';
const STOPS = 'mobile_stops';
const NOTICES = 'mobile_notices';

// Order matters: a relation emits a foreign key against the target's generated
// table, so the lines must exist before anything points at them.
await applySchemas(client, [
	{
		name: LINES,
		display_name: 'Transit lines',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			// No enum column exists, so the mode is plain indexed text and the
			// application decides what values are legal.
			{ name: 'mode', field_type: 'text', indexed: true },
			{ name: 'headway_minutes', field_type: 'number' }
		]
	},
	{
		name: STOPS,
		display_name: 'Stops',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'zone', field_type: 'text', indexed: true },
			belongsTo('line', LINES)
		]
	},
	{
		name: NOTICES,
		display_name: 'Service notices',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'severity', field_type: 'text', indexed: true },
			{ name: 'body', field_type: 'text' },
			{ name: 'effective_from', field_type: 'datetime' },
			belongsTo('line', LINES)
		]
	}
]);
console.log('content types ready');

async function seedContent(): Promise<void> {
	if ((await listContent(client, NOTICES, { limit: 25 })).length > 0) {
		console.log('notices already seeded, leaving the content alone');
		return;
	}

	// A slug is unique per tenant across every content type at once, not per
	// type, and every example on this engine shares the tenant. Hence the
	// prefix on all of them.
	const lines = [
		{ key: 'riverside', slug: 'mobile-line-riverside', title: 'Riverside Line', mode: 'tram', headway: 8 },
		{ key: 'harbour', slug: 'mobile-line-harbour-loop', title: 'Harbour Loop', mode: 'bus', headway: 12 },
		{ key: 'northgate', slug: 'mobile-line-northgate-express', title: 'Northgate Express', mode: 'rail', headway: 20 }
	];

	const stops = [
		{ slug: 'mobile-stop-millbank-quay', title: 'Millbank Quay', zone: 'A', line: 'riverside' },
		{ slug: 'mobile-stop-foundry-street', title: 'Foundry Street', zone: 'A', line: 'riverside' },
		{ slug: 'mobile-stop-carrow-bridge', title: 'Carrow Bridge', zone: 'B', line: 'riverside' },
		{ slug: 'mobile-stop-harbour-market', title: 'Harbour Market', zone: 'A', line: 'harbour' },
		{ slug: 'mobile-stop-slipway-road', title: 'Slipway Road', zone: 'B', line: 'harbour' },
		{ slug: 'mobile-stop-northgate-interchange', title: 'Northgate Interchange', zone: 'C', line: 'northgate' },
		{ slug: 'mobile-stop-ashfield-park', title: 'Ashfield Park', zone: 'C', line: 'northgate' }
	];

	const notices = [
		{
			slug: 'mobile-notice-carrow-bridge-track-renewal',
			title: 'Riverside Line closed at Carrow Bridge this weekend',
			severity: 'major',
			line: 'riverside',
			inDays: 2,
			body: 'Track renewal closes the viaduct from Friday 22:00 until Monday 05:00. Trams terminate at Foundry Street and a replacement bus runs every ten minutes to Millbank Quay. Journey times through the closure are about twelve minutes longer.'
		},
		{
			slug: 'mobile-notice-slipway-road-resurfacing',
			title: 'Harbour Loop diverted around Slipway Road resurfacing',
			severity: 'minor',
			line: 'harbour',
			inDays: 1,
			body: 'Buses run via Dock Approach for three weeks and do not serve Slipway Road. The nearest alternative is Harbour Market, four minutes on foot.'
		},
		{
			slug: 'mobile-notice-northgate-early-departure',
			title: 'Northgate Express gains an 06:12 departure',
			severity: 'info',
			line: 'northgate',
			inDays: 7,
			body: 'A new first train leaves Ashfield Park at 06:12 on weekdays, arriving at Northgate Interchange at 06:34. The 06:52 is unchanged.'
		},
		{
			slug: 'mobile-notice-northgate-lift-works',
			title: 'Lifts out of service at Northgate Interchange',
			severity: 'minor',
			line: 'northgate',
			inDays: 0,
			body: 'Both platform lifts are being replaced. Step-free access to the eastbound platform is unavailable until the end of the month; staff can arrange a taxi to Ashfield Park.'
		},
		{
			slug: 'mobile-notice-contactless-readers-zone-a',
			title: 'Contactless readers replaced across zone A',
			severity: 'info',
			inDays: 4,
			body: 'The older readers at zone A stops are being swapped overnight. Cards and phones keep working throughout; a reader showing no light has not been fitted yet and the next one along will take the tap.'
		}
	];

	const lineIds: Record<string, string> = {};
	for (const line of lines) {
		const { id } = await createContent(client, {
			schema: LINES,
			slug: line.slug,
			title: line.title,
			body: { slug: line.slug, mode: line.mode, headway_minutes: line.headway }
		});
		lineIds[line.key] = id;
	}

	for (const stop of stops) {
		await createContent(client, {
			schema: STOPS,
			slug: stop.slug,
			title: stop.title,
			// A relation is written under the field name and read back as
			// `<field>_id`.
			body: { slug: stop.slug, zone: stop.zone, line: lineIds[stop.line] }
		});
	}

	const now = Date.now();
	for (const notice of notices) {
		const body: Record<string, unknown> = {
			slug: notice.slug,
			severity: notice.severity,
			body: notice.body,
			// A datetime field is a TIMESTAMPTZ and takes RFC 3339.
			effective_from: new Date(now + notice.inDays * 86_400_000).toISOString()
		};
		// A network-wide notice has no line. The relation is left out rather
		// than set to null, because the write path takes the field name and
		// nothing is the honest value for absent.
		if (notice.line) body.line = lineIds[notice.line];

		await createContent(client, {
			schema: NOTICES,
			slug: notice.slug,
			title: notice.title,
			body
		});
	}

	console.log(
		`seeded ${lines.length} lines, ${stops.length} stops, ${notices.length} notices`
	);
}

interface ApiKeyRow {
	id: string;
	name: string;
	enabled: boolean;
	scopes: string[];
	monthly_limit: number;
}

interface KeySpec {
	env: string;
	name: string;
	scopes: string[];
	monthlyLimit: number;
	note: string;
}

/**
 * The two credentials the client program runs as.
 *
 * Neither carries a role. A key holding admin or super_admin is waved through
 * the scope check entirely, and a key holding no role at all is waved through
 * every role check, so on this engine a role on a machine credential removes a
 * gate rather than adding one.
 */
const KEY_SPECS: KeySpec[] = [
	{
		env: 'LYEVE_MOBILE_API_KEY',
		name: 'transit-app-reader',
		scopes: ['content:read', 'schemas:read'],
		monthlyLimit: 0,
		note: 'reads the feed and the content types, nothing else'
	},
	{
		env: 'LYEVE_MOBILE_PROBE_KEY',
		name: 'transit-app-quota-probe',
		scopes: [],
		monthlyLimit: 3,
		note: 'no scopes and a limit of 3, to show both refusals'
	}
];

const KEY_FILE = fileURLToPath(new URL('../client/.env', import.meta.url));

async function ensureKeys(): Promise<void> {
	const page = await client.request<{ data: ApiKeyRow[] }>(
		'admin',
		'/api/admin/api-keys?limit=500'
	);
	const existing = page?.data ?? [];
	const cached = readKeyFile();

	const out: string[] = [];
	for (const spec of KEY_SPECS) {
		const rows = existing.filter((k) => k.name === spec.name);
		const live = rows.find((k) => k.enabled);
		const secret = cached[spec.env];

		if (live && secret) {
			out.push(`${spec.env}=${secret}`);
			console.log(`key ${spec.name} kept, ${spec.note}`);
			continue;
		}

		// Deleting cascades: the key's usage rows and audit trail go with it,
		// and the tenant's recorded call count for the period drops by what it
		// had spent. That is the cost of not being able to recover a secret,
		// and it is why re-running this script does not churn the keys when
		// client/.env is intact.
		for (const row of rows) {
			await client.request('admin', `/api/admin/api-keys/${row.id}`, { method: 'DELETE' });
		}

		const minted = await client.request<ApiKeyRow & { raw_key: string }>(
			'admin',
			'/api/admin/api-keys',
			{
				method: 'POST',
				body: JSON.stringify({
					name: spec.name,
					roles: [],
					schemas: [],
					// The published SDK's create type has no scopes field, so
					// this is posted by hand. A key minted without scopes
					// authenticates and is refused everywhere that checks them.
					scopes: spec.scopes,
					monthly_limit: spec.monthlyLimit,
					expires_at: null
				})
			}
		);

		out.push(`${spec.env}=${minted.raw_key}`);
		const replaced = rows.length > 0 ? `, replacing ${rows.length} older row(s) and their meters` : '';
		console.log(`key ${spec.name} minted ${minted.raw_key.slice(0, 11)}..., ${spec.note}${replaced}`);
	}

	const header = [
		'# Written by setup/provision.ts. Gitignored, and the only copy of these',
		'# secrets: the engine stores a peppered HMAC and returns the plaintext once.',
		'# Delete this file and re-run pnpm run setup to rotate both keys.',
		''
	].join('\n');

	try {
		writeFileSync(KEY_FILE, `${header}${out.join('\n')}\n`, { mode: 0o600 });
		console.log('wrote client/.env');
	} catch (err) {
		// A read-only checkout is not a failure of provisioning. The keys are
		// minted. They just have to be pasted somewhere by hand.
		console.log(`could not write client/.env (${(err as Error).message}); the values are:`);
		for (const line of out) console.log(`  ${line}`);
	}
}

function readKeyFile(): Record<string, string> {
	try {
		const text = readFileSync(KEY_FILE, 'utf8');
		const out: Record<string, string> = {};
		for (const line of text.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq > 0) out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
		}
		return out;
	} catch {
		// No file yet, or an unreadable one. Both mean mint.
		return {};
	}
}

// Called here rather than above, because KEY_SPECS and KEY_FILE are consts and
// a top-level await that runs before them reaches a name that is not yet bound.
await seedContent();
await ensureKeys();
