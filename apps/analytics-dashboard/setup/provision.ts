/**
 * Creates the one content type this dashboard owns and seeds a few notes.
 *
 * There is nothing else to provision. Every figure on the dashboard comes from
 * telemetry the engine and its plugins already keep, which is the point of the
 * example: an operator console reads what is there rather than seeding it.
 *
 * Safe to run more than once: applying an existing schema is accepted, and
 * seeding stops if notes are already present.
 */
import { lyeveFromEnv, applySchemas, listContent, createContent } from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const NOTES = 'metrics_notes';

await applySchemas(client, [
	{
		name: NOTES,
		display_name: 'Metrics notes',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'body', field_type: 'text' },
			// Free text rather than an enumeration. The engine accepts a default
			// on a field and then ignores it, emitting no DEFAULT clause, so a
			// constrained set would have to be enforced in the app anyway.
			{ name: 'kind', field_type: 'text', indexed: true }
		]
	}
]);
console.log('content type ready');

if ((await listContent(client, NOTES, { limit: 25 })).length > 0) {
	console.log('notes already seeded, nothing to do');
	process.exit(0);
}

/**
 * Seed notes describing this instance's real history, because the whole value
 * of an annotation is that it explains a figure a reader can still see.
 */
const notes = [
	{
		slug: 'metrics-note-seed-load-test-blog-posts',
		title: 'Load test against blog_posts, 20 workers',
		kind: 'load test',
		body: 'The spike that dominates the busiest-endpoints panel is a benchmark run, not traffic. Roughly twenty thousand reads of /api/v1/content/blog_posts inside one hour.\n\nWorth knowing before reading the latency percentiles for that window: the same run is why the mean of the hourly p95 values sits so far below the worst hourly p99.'
	},
	{
		slug: 'metrics-note-seed-engine-restart',
		title: 'Engine rebuilt and restarted',
		kind: 'deploy',
		body: 'Both the in-process latency tracker and every Prometheus counter started again from zero here. The apianalytics rollups did not, because they are rows in a table.\n\nWhen the health page and the requests page disagree about how many requests this instance has served, this is the reason and neither of them is wrong.'
	},
	{
		slug: 'metrics-note-seed-schema-churn',
		title: 'Schema churn from the smoke runs',
		kind: 'maintenance',
		body: 'The content activity panel shows sys_schemas as the most active content type, well ahead of anything a reader would call content. That is provisioning, not editorial work: each example app applies its own schemas, and a re-run deletes and recreates them.\n\nA production install would see this ratio inverted, and a sudden run of sys_schemas events on one would be worth investigating.'
	},
	{
		slug: 'metrics-note-seed-tenant-scores',
		title: 'Three tenants scored critical, and it is not a churn signal',
		kind: 'observation',
		body: 'The health score marks three tenants critical on a usage score of zero. They hold no content and issue no API keys, which is what the scorer measures, so the tier is arithmetically correct and operationally meaningless.\n\nRead the usage column rather than the composite. The other four components sit at their defaults for every tenant.'
	}
];

for (const note of notes) {
	await createContent(client, {
		schema: NOTES,
		slug: note.slug,
		title: note.title,
		body: { slug: note.slug, kind: note.kind, body: note.body }
	});
}

console.log(`seeded ${notes.length} notes`);
