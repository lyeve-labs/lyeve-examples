/**
 * Sets aside a checkpoint that was written against a database that is gone.
 *
 * A checkpoint records which source rows reached the engine, and `--resume`
 * skips them. It does not record which database they reached. After the
 * database is replaced (a fresh stack, a restore, another machine) a resumed
 * stage skips every row, imports nothing, and still reports success. When the
 * engine holds no migrated entry of any content type a checkpoint says it
 * filled, the checkpoint is renamed with a `.stale` suffix and the stage starts
 * over.
 *
 * A database that holds some of those entries is left alone. Which rows it
 * lost cannot be told from here, and starting over would insert the rest twice.
 *
 * Run from the app directory, naming the stages about to resume:
 *   node --experimental-strip-types migration/check-checkpoints.ts authors-and-pages posts
 */
import { existsSync } from 'node:fs';
import { readFile, rename } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { lyeveFromEnv, listContent } from '../src/lib/lyeve/index.ts';

const CHECKPOINTS = join(process.cwd(), 'migration', 'reports', 'checkpoints');
// The name the tool always writes in its working directory.
const FILE = 'cmsctl_migrate_csv_checkpoint.json';

type Checkpoint = { schemas?: { schema: string; migrated_ids: string[] | null }[] | null };

const client = lyeveFromEnv();

// Every mapping writes the source row's key into legacy_id, so an entry without
// one was not migrated: the control page setup writes beside the imported
// pages is such an entry, and it must not make a lost import look present.
async function holdsMigrated(schema: string): Promise<boolean> {
	for (let offset = 0; ; offset += 200) {
		let rows;
		try {
			rows = await listContent<{ legacy_id?: string }>(client, schema, { limit: 200, offset });
		} catch (err) {
			// A content type that was never applied reads as not found, which
			// means the same here as an empty one.
			if ((err as { status?: number }).status === 404) return false;
			throw err;
		}
		if (rows.some((row) => row.data.legacy_id)) return true;
		if (rows.length < 200) return false;
	}
}

for (const stage of process.argv.slice(2)) {
	const file = join(CHECKPOINTS, stage, FILE);
	if (!existsSync(file)) continue;
	const checkpoint = JSON.parse(await readFile(file, 'utf8')) as Checkpoint;
	const claimed = (checkpoint.schemas ?? [])
		.filter((s) => (s.migrated_ids ?? []).length > 0)
		.map((s) => s.schema);
	if (claimed.length === 0) continue;
	const held = await Promise.all(claimed.map(holdsMigrated));
	if (held.some(Boolean)) continue;
	const aside = `${file}.${new Date().toISOString().replace(/[:.]/g, '-')}.stale`;
	await rename(file, aside);
	console.log(
		`  ${stage}: the engine holds no ${claimed.join(' or ')} entry the checkpoint lists, so it was set aside as ${relative(process.cwd(), aside)}`
	);
}
