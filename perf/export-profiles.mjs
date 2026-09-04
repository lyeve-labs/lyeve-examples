// export-profiles.mjs: write the benchmark repository's application profiles
// from the example apps.
//
//   node perf/export-profiles.mjs [--out ../benchmarks/profiles/profiles.json]
//
// A benchmark profile and an example app describe the same application, and
// keeping the two in step by hand did not work: the profiles drifted until they
// were driving field names and a query syntax the engine does not have.
//
// So the schemas are not written twice. Each app declares only what it cannot
// derive, in `apps/<name>/benchmark.json`: seed volumes at benchmark scale, the
// arrival rate, the thresholds and the weighted request mix. The content types
// come from the running engine, which is the only authority on what the app
// actually provisioned.
//
// That means the stack has to be up and seeded. It is the right requirement: a
// profile generated from a cold engine would describe types that do not exist.
//
// The output is committed in the benchmark repository, which stays runnable on
// its own. This script removes the drift, not the independence.
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const APPS = join(REPO, 'apps');

const outArg = process.argv.indexOf('--out');
const OUT = resolve(outArg > -1 ? process.argv[outArg + 1] : join(REPO, '../benchmarks/profiles/profiles.json'));

const API = (process.env.LYEVE_API_URL || 'http://localhost:4402').replace(/\/$/, '');
const ADMIN = (process.env.LYEVE_ADMIN_URL || 'http://localhost:4401').replace(/\/$/, '');
const EMAIL = process.env.LYEVE_EMAIL || 'admin@lyeve.example';
const PASSWORD = process.env.LYEVE_PASSWORD || 'Admin12345678';

/**
 * The profile vocabulary is deliberately not the engine's.
 *
 * Profiles are compared across platforms, so they describe a field in neutral
 * terms and each target's seeder maps them onto its own types. The engine has
 * one string type where the profile has two, and the difference matters: the
 * seeder fills `text` with a paragraph and `string` with a short unique value,
 * so emitting `text` for a slug would seed 2000 identical paragraphs into a
 * unique column and every insert after the first would be refused.
 *
 * Long-form is therefore decided by name. It is a heuristic, and it is the only
 * one in this file.
 */
const LONG_FORM = new Set([
	'body', 'excerpt', 'description', 'summary', 'bio', 'notes', 'note',
	'message', 'content', 'standfirst', 'cover_letter', 'detail', 'answer'
]);

const TYPE = {
	text: (name) => (LONG_FORM.has(name) ? 'text' : 'string'),
	number: () => 'integer',
	boolean: () => 'boolean',
	json: () => 'json',
	datetime: () => 'timestamp',
	email: () => 'string',
	url: () => 'string'
};

async function token() {
	const res = await fetch(`${ADMIN}/api/admin/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: EMAIL, password: PASSWORD })
	});
	if (!res.ok) {
		throw new Error(`login failed (${res.status}); is the stack up? run make up`);
	}
	const { token } = await res.json();
	if (!token) throw new Error('login returned no token');
	return token;
}

async function engineSchemas(bearer) {
	const res = await fetch(`${API}/api/v1/schemas`, { headers: { Authorization: `Bearer ${bearer}` } });
	if (!res.ok) throw new Error(`cannot read schemas (${res.status})`);
	const list = await res.json();
	if (!Array.isArray(list)) throw new Error('schema list was not an array; the response shape changed');
	return list;
}

/** Converts one engine schema into the profile vocabulary. */
function toProfileSchema(schema) {
	const fields = [];
	const relations = [];

	for (const f of schema.fields ?? []) {
		// id, created_at and updated_at are the engine's, not the application's.
		if (f.system) continue;

		if (f.field_type === 'relation') {
			if (!f.relation_to) continue;
			relations.push({ field: f.name, to: f.relation_to, ...(f.indexed ? { indexed: true } : {}) });
			continue;
		}

		const map = TYPE[f.field_type];
		if (!map) {
			console.warn(`  warn: ${schema.name}.${f.name} has field_type ${f.field_type}, which has no profile equivalent; skipped`);
			continue;
		}
		fields.push({
			name: f.name,
			type: map(f.name),
			...(f.required ? { required: true } : {}),
			...(f.unique ? { unique: true } : {}),
			...(f.indexed ? { indexed: true } : {})
		});
	}

	return { name: schema.name, fields, ...(relations.length ? { relations } : {}) };
}

/**
 * Orders types so a relation's target is always created first.
 *
 * A relation emits a foreign key against the target's generated table, so
 * creating the referring type first fails the whole apply. Putting the
 * relation-free types first and the rest after is not enough: among the rest,
 * one can point at another. Alphabetical order gave exactly that, twice, with
 * applications before listings and lessons before modules.
 *
 * A self-reference is not a dependency, because the table exists by the time
 * its own foreign key is added. A cycle between two types cannot be ordered at
 * all, so it is reported rather than silently emitted in whatever order the
 * walk happened to reach.
 */
function inDependencyOrder(schemas) {
	const remaining = new Map(schemas.map((s) => [s.name, s]));
	const placed = new Set();
	const out = [];

	while (remaining.size > 0) {
		const ready = [...remaining.values()].filter((s) =>
			(s.relations ?? []).every((r) => r.to === s.name || placed.has(r.to) || !remaining.has(r.to))
		);
		if (ready.length === 0) {
			throw new Error(
				`content types reference each other in a cycle and cannot be ordered: ${[...remaining.keys()].join(', ')}`
			);
		}
		ready.sort((a, b) => a.name.localeCompare(b.name));
		for (const s of ready) {
			out.push(s);
			placed.add(s.name);
			remaining.delete(s.name);
		}
	}
	return out;
}

const bearer = await token();
const all = await engineSchemas(bearer);
const byName = new Map(all.map((s) => [s.name, s]));

const profiles = [];
const skipped = [];

for (const app of readdirSync(APPS).sort()) {
	const manifestPath = join(APPS, app, 'benchmark.json');
	if (!existsSync(manifestPath)) {
		skipped.push(app);
		continue;
	}
	const m = JSON.parse(readFileSync(manifestPath, 'utf8'));

	const names = all.map((s) => s.name).filter((n) => n.startsWith(m.prefix)).sort();
	if (names.length === 0) {
		throw new Error(`${app}: no content types with prefix "${m.prefix}" on the engine. Run make setup.`);
	}

	// Every type the seed volumes name has to exist, or the profile would ask
	// the seeder to fill something the engine does not have.
	for (const type of Object.keys(m.seed)) {
		if (!byName.has(type)) throw new Error(`${app}: seed names ${type}, which the engine does not have`);
	}

	const ordered = inDependencyOrder(names.map((n) => toProfileSchema(byName.get(n))));

	profiles.push({
		id: m.id,
		name: m.name,
		tagline: m.tagline,
		pairedExample: `lyeve-examples/apps/${app}`,
		realWorld: m.realWorld,
		schemas: ordered,
		seed: m.seed,
		rate: m.rate,
		thresholds: m.thresholds,
		traffic: m.traffic
	});
}

const note =
	'Real-world application profiles. Where scenarios/ tests one atomic behavior, a profile is a COMPLETE app: ' +
	'its content schema, realistic seed volumes, and a weighted traffic mix that mirrors real usage. ' +
	'GENERATED by lyeve-examples/perf/export-profiles.mjs and committed here; do not hand-edit. Each profile mirrors ' +
	'the runnable example named in pairedExample, and its content types are read from a running engine rather than ' +
	'written twice, because writing them twice is how the previous version drifted into driving a query syntax the ' +
	'engine does not have. ' +
	'Path templates say what they sample: {id:type} and {slug:type} draw from that content type, {term} is a search word. ' +
	'Queries use the syntax the engine really has: filters[column]=value for exact equality, filters[<relation>_id] for a ' +
	'relation, no sort parameter (rows arrive created_at DESC), limit clamped to 25..200, and search on the admin router. ' +
	'Field types: string|text|integer|decimal|boolean|json|timestamp|media|relation(->to).';

writeFileSync(OUT, JSON.stringify({ version: '0.3.0', note, profiles }, null, 2) + '\n');

console.log(`${profiles.length} profiles -> ${OUT}`);
for (const p of profiles) {
	const rows = Object.values(p.seed).reduce((a, b) => a + b, 0);
	console.log(
		`  ${p.id.padEnd(12)} ${String(p.schemas.length).padStart(2)} types  ` +
		`${String(p.traffic.length).padStart(2)} entries  ${String(rows).padStart(5)} rows  ${p.rate}/s`
	);
}
if (skipped.length) console.log(`\nno manifest, not benchmarked: ${skipped.join(', ')}`);
