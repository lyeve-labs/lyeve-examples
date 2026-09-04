/**
 * Creates the target content types, then runs the migration.
 *
 * The tool will create a content type it cannot find, but only from the fields
 * named in the mappings file, with no index, no relation and no unique
 * constraint, and it marks its two provenance fields system, which means no
 * column is emitted for them. A schema worth keeping is declared here instead,
 * and the tool then reports each one as "already exists, skipping DDL".
 *
 * Safe to run more than once. Applying a schema that exists is accepted, and the
 * migration is skipped once the posts are in.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const AUTHORS = 'legacy_authors';
const PAGES = 'legacy_pages';
const POSTS = 'legacy_posts';

// Authors first: a relation emits a foreign key against the target's generated
// table, so legacy_authors has to exist before legacy_posts points at it.
await applySchemas(client, [
	{
		name: AUTHORS,
		display_name: 'Legacy authors',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			// The old system's own primary key. Keeping it is what makes the
			// migration re-runnable and auditable: without it there is no way to
			// say which legacy record a row came from.
			{ name: 'legacy_id', field_type: 'text', indexed: true },
			{ name: 'role', field_type: 'text' },
			{ name: 'bio', field_type: 'text' }
		]
	},
	{
		name: PAGES,
		display_name: 'Legacy pages',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'legacy_id', field_type: 'text', indexed: true },
			{ name: 'body_html', field_type: 'text' },
			{ name: 'published_at', field_type: 'datetime' }
		]
	},
	{
		name: POSTS,
		display_name: 'Legacy posts',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'legacy_id', field_type: 'text', indexed: true },
			{ name: 'standfirst', field_type: 'text' },
			{ name: 'body_html', field_type: 'text' },
			{ name: 'section', field_type: 'text', indexed: true },
			{ name: 'published_at', field_type: 'datetime' },
			belongsTo('author', AUTHORS)
		]
	}
]);
console.log('content types ready');

// One page written the way the app itself would write it, so the report page can
// put a searchable entry next to the migrated ones. Without a control, a search
// that returns nothing looks like a broken search box rather than the point.
const CONTROL_SLUG = 'migration-notes';
const controlExists = (await listContent<{ slug?: string }>(client, PAGES, { limit: 200 })).some(
	(row) => row.data.slug === CONTROL_SLUG
);
if (!controlExists) {
	await createContent(client, {
		schema: PAGES,
		slug: CONTROL_SLUG,
		title: 'Migration notes',
		body: {
			slug: CONTROL_SLUG,
			body_html:
				'<p>This page was written through the admin content route rather than imported by the tool. It carries no legacy id, because it did not come from the old system, and it is the one page on this site that search can find.</p>',
			published_at: new Date().toISOString()
		}
	});
	console.log('wrote the control page through the admin route');
}

const existing = await listContent(client, POSTS, { limit: 25 });
const reportWritten = existsSync(join(process.cwd(), 'migration', 'reports', 'run.json'));

// Never re-run over content that is already there. The tool has no upsert, and
// the only thing standing between a second run and a duplicate of every row is
// the checkpoint, which lives under migration/reports.
if (existing.length > 0) {
	if (reportWritten) {
		console.log(`${existing.length} posts already migrated; nothing to do`);
	} else {
		console.warn(
			`${existing.length} posts are already in the engine but migration/reports is empty. ` +
				'Not re-running: without the checkpoints a second pass would insert every row again. ' +
				'Delete the legacy_ content types to start over.'
		);
	}
	process.exit(0);
}

// The tool is a Go program in a sibling checkout. On a machine without a
// toolchain the schemas above are still worth having, and the report page
// explains what is missing, so this is a warning rather than a failure.
const go = spawnSync('go', ['version'], { stdio: 'ignore' });
if (go.status !== 0) {
	console.warn('go is not installed; skipping the migration. Install Go and run migration/run.sh.');
	process.exit(0);
}

const run = spawnSync('bash', [join(process.cwd(), 'migration', 'run.sh')], {
	stdio: 'inherit',
	cwd: process.cwd()
});
if (run.status !== 0) {
	console.error('migration/run.sh failed; see migration/reports for the stage logs');
	process.exit(1);
}
