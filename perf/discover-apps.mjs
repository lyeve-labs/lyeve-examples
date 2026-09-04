// discover-apps.mjs: regenerate perf/apps.json from the apps themselves.
//
//   node perf/discover-apps.mjs
//
// Reads each app's dev port from its package.json, its page routes from
// src/routes, and its content types from setup/provision.ts. Writing this down
// by hand went stale the first time an app was added, so it is derived instead.
//
// A dynamic route cannot be driven from a template: the driver has no slugs. So
// rather than inventing them, apps.json asks for a `{link}` and the driver
// follows a real link off a crawled page. That keeps the load on pages that
// exist and removes the whole class of "measured a 404" mistakes.
import { readdirSync, readFileSync, existsSync, writeFileSync, statSync, globSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const APPS = join(REPO, 'apps');

// Pages worth crawling for links beyond the home page, per app. A route that
// lists things is where the slugs are.
const EXTRA_CRAWL = {
  'company-site': ['/careers'],
  'docs-portal': ['/'],
  'events-ticketing': ['/registrations'],
  'lms-courses': ['/'],
  'marketplace': ['/'],
};

// A static path that takes a query string only the app knows how to answer.
const QUERY_PATHS = {
  blog: ['/search?q=engine'],
  'docs-portal': ['/search?q=schema'],
  'jobs-board': ['/?q=engineer'],
  // Queries the seeded corpus actually answers, so the profile measures a
  // search that returns rows rather than the empty-result path.
  'search-console': ['/?q=checkpoint', '/?q=p99'],
};

function devPort(appDir) {
  const pkgPath = join(appDir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const dev = pkg.scripts?.dev ?? '';
  const m = dev.match(/--port\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

function pageRoutes(appDir) {
  const root = join(appDir, 'src/routes');
  if (!existsSync(root)) return [];
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // A group directory in parentheses does not appear in the URL.
        const seg = entry.startsWith('(') && entry.endsWith(')') ? '' : `/${entry}`;
        walk(full, prefix + seg);
      } else if (entry === '+page.svelte') {
        out.push(prefix === '' ? '/' : prefix);
      }
    }
  };
  walk(root, '');
  return out.sort();
}

function contentTypes(appDir) {
  const provision = join(appDir, 'setup/provision.ts');
  if (!existsSync(provision)) return [];
  const src = readFileSync(provision, 'utf8');
  const names = new Set();

  // A schema object carries `fields:` or `display_name:`. A field object
  // carries `field_type:`. Matching `name:` alone collected every field name
  // in the file, which is why the window after the match is inspected.
  const isSchema = (from) => {
    const window = src.slice(from, from + 320);
    const fieldsAt = window.search(/\bfields\s*:/);
    const typeAt = window.search(/\bfield_type\s*:/);
    if (fieldsAt === -1 && !/\bdisplay_name\s*:/.test(window)) return false;
    // If a field_type appears before the fields key, this `name:` belongs to a field.
    return typeAt === -1 || fieldsAt === -1 || fieldsAt < typeAt;
  };

  for (const m of src.matchAll(/name:\s*'([a-z][a-z0-9_]*)'/g)) {
    if (isSchema(m.index)) names.add(m[1]);
  }
  // A name given as a constant, which is how the reference app declares them.
  for (const m of src.matchAll(/name:\s*([A-Z][A-Z0-9_]*)\b/g)) {
    if (!isSchema(m.index)) continue;
    const constMatch = src.match(new RegExp(`const\\s+${m[1]}\\s*=\\s*'([a-z][a-z0-9_]*)'`));
    if (constMatch) names.add(constMatch[1]);
  }
  return [...names].sort();
}

/**
 * The engine's own schema list, when it is reachable.
 *
 * Parsing content-type names out of a provisioning script is a heuristic, and
 * it was wrong: it reported `title`, `bio` and `slug` as content types for the
 * apps that declare their schemas in a shape the parser did not expect. The
 * engine knows the real answer. When it is up, the parse is filtered against
 * it and a prefix that survives pulls in its siblings. When it is not, the
 * parse stands on its own and may over-report.
 */
async function engineSchemaNames() {
	const admin = (process.env.LYEVE_ADMIN_URL || 'http://localhost:4401').replace(/\/$/, '');
	const api = (process.env.LYEVE_API_URL || 'http://localhost:4402').replace(/\/$/, '');
	try {
		const auth = await fetch(`${admin}/api/admin/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: process.env.LYEVE_EMAIL || 'admin@lyeve.example',
				password: process.env.LYEVE_PASSWORD || 'Admin12345678'
			}),
			signal: AbortSignal.timeout(5000)
		});
		if (!auth.ok) return null;
		const { token } = await auth.json();
		const res = await fetch(`${api}/api/v1/schemas`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return null;
		const list = await res.json();
		return Array.isArray(list) ? list.map((s) => s.name) : null;
	} catch {
		return null;
	}
}

const engineNames = await engineSchemaNames();
if (!engineNames) {
	console.warn('warn: engine not reachable, content types come from the parse alone and may over-report');
}

/**
 * Every content type the app names, taken from the engine's list.
 *
 * This replaced a parse of the provisioning script, which was a heuristic and
 * reported `title`, `bio` and `slug` as content types. An app that mentions
 * `hooks_orders` anywhere in its own source owns it. The engine says which
 * names are real, so nothing has to be inferred from the shape of the code.
 */
function typesTheAppNames(appDir) {
	if (!engineNames) return null;
	const files = [];
	for (const pat of ['src/**/*.ts', 'src/**/*.svelte', 'setup/**/*.ts', 'migration/**/*.ts']) {
		files.push(...globSync(join(appDir, pat)));
	}
	const text = files
		.filter((f) => !f.includes('/.svelte-kit/') && !f.includes('/node_modules/') && !f.includes('/lyeve/'))
		.map((f) => readFileSync(f, 'utf8'))
		.join('\n');
	return engineNames.filter((n) => new RegExp(`\\b${n}\\b`).test(text)).sort();
}

/**
 * Keeps the parsed names the engine confirms, then adds their siblings.
 *
 * A prefix declared in the app's benchmark.json is used too, because the parse
 * finds nothing at all in an app that builds its schema definitions rather than
 * writing them as literals, and those apps still have content types.
 */
function confirmTypes(parsed, declaredPrefix) {
	if (!engineNames) return parsed;
	const confirmed = parsed.filter((n) => engineNames.includes(n));
	const prefixes = new Set(confirmed.map((n) => n.split('_')[0]).filter((p) => p.length > 2));
	if (declaredPrefix) prefixes.add(declaredPrefix.replace(/_$/, ''));
	const siblings = engineNames.filter((n) => prefixes.has(n.split('_')[0]));
	return [...new Set([...confirmed, ...siblings])].sort();
}

/** The prefix an app declares for its load-test manifest, when it has one. */
function declaredPrefix(appDir) {
	const p = join(appDir, 'benchmark.json');
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, 'utf8')).prefix ?? null;
	} catch {
		return null;
	}
}

const apps = [];
for (const name of readdirSync(APPS).sort()) {
  const dir = join(APPS, name);
  if (!statSync(dir).isDirectory()) continue;

  const port = devPort(dir);
  const routes = pageRoutes(dir);
  if (port == null || routes.length === 0) continue; // not a page-serving app

  const staticRoutes = routes.filter((r) => !r.includes('['));
  const dynamicRoutes = routes.filter((r) => r.includes('['));

  const crawl = [...new Set(['/', ...(EXTRA_CRAWL[name] ?? [])])].filter((c) => staticRoutes.includes(c) || c === '/');

  // Weighting reflects how these pages are actually hit: a detail page is the
  // bulk of a content site's traffic, the home page is the next largest slice,
  // and the remaining static pages share what is left.
  const paths = [{ path: '/', weight: 30 }];
  if (dynamicRoutes.length) paths.push({ path: '{link}', weight: 50 });

  const others = staticRoutes.filter((r) => r !== '/');
  const queries = QUERY_PATHS[name] ?? [];
  const rest = [...others, ...queries];
  const share = rest.length ? Math.max(1, Math.floor((dynamicRoutes.length ? 20 : 70) / rest.length)) : 0;
  for (const r of rest) paths.push({ path: r, weight: share });

  // Normalize so the weights read as percentages.
  const total = paths.reduce((s, p) => s + p.weight, 0);
  if (total !== 100 && paths.length) paths[0].weight += 100 - total;

  apps.push({
    name,
    port,
    schemas: typesTheAppNames(dir) ?? confirmTypes(contentTypes(dir), declaredPrefix(dir)),
    crawl,
    dynamicRoutes,
    paths,
    thresholds: { p95_ms: 250, error_rate: 0.01 },
  });
}

const out = {
  version: '0.1.0',
  note:
    'Generated by perf/discover-apps.mjs; do not hand-edit. One entry per example app that serves pages. ' +
    '`paths` is the weighted request mix, where {link} means a real internal link discovered by crawling the ' +
    'pages in `crawl`, because a dynamic route cannot be driven from a template without inventing slugs. ' +
    '`schemas` is read from the app\'s provisioning script and is what perf/k6/engine.js drives directly. ' +
    'The p95 threshold is deliberately loose: these pages render server-side against a live engine, so they ' +
    'are not comparable with the engine-only figures.',
  apps,
};

writeFileSync(join(HERE, 'apps.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`apps.json: ${apps.length} apps`);
for (const a of apps) {
  console.log(`  ${a.name.padEnd(22)} :${a.port}  ${a.paths.length} paths  ${a.schemas.length} types  crawl ${a.crawl.join(',')}`);
}
