/**
 * Rewrites the post export so its byline column holds LyEve ids.
 *
 * Nothing in the tool translates a source system's own key into the id the
 * destination assigned. A belongs_to column is a UUID, and the CLI passes the
 * CSV cell through untouched, so a column of legacy keys like `p-118` reaches a
 * UUID column and the insert fails. The WordPress adapter has the same shape:
 * it maps the site's numeric `author` onto `author_id` and hands the number on.
 *
 * So a relation is carried in two passes. Migrate the target type, read back the
 * ids the engine minted, then rewrite the child export with those ids in the
 * column the mapping points at. This is that middle step.
 *
 * Run from the app directory:
 *   node --experimental-strip-types migration/resolve-relations.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lyeveFromEnv, listContent } from '../src/lib/lyeve/index.ts';

const HERE = join(process.cwd(), 'migration');
const SOURCE = join(HERE, 'posts.csv');
const TARGET = join(HERE, 'posts.resolved.csv');
const AUTHORS = 'legacy_authors';
const KEY_COLUMN = 'byline_person_id';

const client = lyeveFromEnv();

/** Reads every author, not the first page, so the map is complete. */
async function authorIdsByLegacyKey(): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	for (let offset = 0; ; offset += 200) {
		let rows;
		try {
			rows = await listContent<{ legacy_id?: string; title?: string }>(client, AUTHORS, {
				limit: 200,
				offset
			});
		} catch (err) {
			// A content type that was never applied reads as not found. Treated as
			// empty so the caller reports the missing migration rather than a
			// status code.
			if ((err as { status?: number }).status === 404) return map;
			throw err;
		}
		for (const row of rows) {
			const key = row.data.legacy_id;
			if (key) map.set(key, row.id);
		}
		if (rows.length < 200) break;
	}
	return map;
}

function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					quoted = false;
				}
			} else {
				field += c;
			}
			continue;
		}
		if (c === '"') {
			quoted = true;
		} else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n') {
			row.push(field);
			field = '';
			rows.push(row);
			row = [];
		} else if (c !== '\r') {
			field += c;
		}
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.length > 1 || r[0] !== '');
}

function writeCsv(rows: string[][]): string {
	const cell = (v: string) =>
		/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
	return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

const rows = parseCsv(await readFile(SOURCE, 'utf8'));
if (rows.length < 2) throw new Error(`${SOURCE} has no data rows`);

const header = rows[0];
const keyIndex = header.indexOf(KEY_COLUMN);
if (keyIndex === -1) throw new Error(`${SOURCE} has no ${KEY_COLUMN} column`);

const ids = await authorIdsByLegacyKey();
if (ids.size === 0) {
	throw new Error(
		`no ${AUTHORS} entries in the engine. Migrate the authors export before resolving bylines.`
	);
}

const unresolved = new Set<string>();
const resolved = rows.map((row, i) => {
	if (i === 0) return row;
	const key = row[keyIndex];
	const id = ids.get(key);
	if (!id) {
		unresolved.add(key);
		return row;
	}
	const copy = row.slice();
	copy[keyIndex] = id;
	return copy;
});

// A missing byline is a data loss, not a warning. Stop and name the keys, rather
// than migrating rows whose relation column will be rejected one row at a time.
if (unresolved.size > 0) {
	throw new Error(
		`no ${AUTHORS} entry for ${[...unresolved].join(', ')}. ` +
			`Check that the authors export covers every byline in ${SOURCE}.`
	);
}

await writeFile(TARGET, writeCsv(resolved), 'utf8');
console.log(
	`resolved ${resolved.length - 1} bylines against ${ids.size} authors -> migration/posts.resolved.csv`
);
