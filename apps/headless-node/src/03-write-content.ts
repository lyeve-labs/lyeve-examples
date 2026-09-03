/**
 * Step 3. Write content, through the door that counts.
 *
 *   pnpm write-content
 *
 * There are two write paths and they are not equivalent.
 *
 *   POST /api/v1/content/{type}   body {"data": {...}}
 *       Writes straight into the generated table. Readable from the v1 router.
 *       Invisible to search and invisible in the admin UI, permanently, with no
 *       error at any point. @lyeve-labs/client-rest exports this one as
 *       createContent().
 *
 *   POST /api/admin/content       body {schema, slug, title, body, status}
 *       Writes the catalog row and mirrors it into the generated table.
 *       Readable from v1, findable by search, editable by a human in the admin.
 *
 * Use the admin route for everything you would be sad to lose. The SDK ships no
 * wrapper for it, so this is a plain post. Step 5 demonstrates what the other
 * route costs.
 *
 * The seed runs to 26 entries on purpose. Paging behavior is invisible on a
 * collection that fits in one page, and a demonstration that cannot fail is
 * not a demonstration.
 *
 * Safe to run repeatedly. Each entry is looked up by slug first.
 */
import { ApiError, type HttpClient } from '@lyeve-labs/client';
import { ARTICLES, AUTHORS, SLUG_PREFIX, heading, note, row, run, section, signIn, signedInClient } from './lyeve.ts';

interface Entry {
	id: string;
	schema: string;
	slug: string;
	title: string;
	status: string;
	created_at: string;
}

interface Draft {
	title: string;
	summary: string;
	body: string;
	read_minutes: number;
}

function slugFor(title: string): string {
	return SLUG_PREFIX + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function findBySlug(client: HttpClient, slug: string): Promise<Entry | null> {
	try {
		return await client.get<Entry>(`/api/admin/content/slug/${encodeURIComponent(slug)}`);
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) return null;
		throw err;
	}
}

interface Written {
	entry: Entry;
	created: boolean;
}

async function publish(
	client: HttpClient,
	schema: string,
	slug: string,
	title: string,
	fields: Record<string, unknown>
): Promise<Written> {
	const existing = await findBySlug(client, slug);
	if (existing) return { entry: existing, created: false };

	const created = await client.post<Entry>('/api/admin/content', {
		schema,
		slug,
		title,
		// title is required at the top level and again inside body. The top-level
		// one names the entry in the catalog. The one inside body is a column
		// on the generated table, and body is validated against the type's own
		// fields, where title is declared required.
		body: { title, slug, ...fields },
		// draft is the default. Only admin and super_admin may set published.
		status: 'published'
	});
	return { entry: created, created: true };
}

/**
 * Two long pieces and twenty-four short ones. The first two carry the words
 * step 5 searches for, so keep "backpressure" out of everything else.
 */
const articles: Draft[] = [
	{
		title: 'Backpressure is a product decision',
		summary: 'Dropping work, queueing it and refusing it are three different promises to the person waiting.',
		read_minutes: 4,
		body: [
			'A saturated system has three honest answers and no fourth one. It can queue the work and answer late, it can refuse the work and answer now, or it can drop the work and answer as though nothing happened. Backpressure is the machinery for choosing between them, and the choice does not belong to the platform team alone.',
			'The reason it keeps landing on the platform team is that the symptom is technical. Latency climbs, a buffer fills, an alert fires. The fix, though, is a sentence about the product: an upload that cannot be accepted right now should fail loudly, and a metrics sample that cannot be accepted right now should be dropped in silence. Nothing in the runtime knows which of those it is holding.',
			'Write the answer down per queue, next to the code. A queue with no documented overflow behavior has one anyway, and it is whatever the default buffer size happens to imply.'
		].join('\n\n')
	},
	{
		title: 'Migrations are not deployments',
		summary: 'Shipping code is reversible in a way that shipping a schema change is not, and treating them alike costs you the difference.',
		read_minutes: 6,
		body: [
			'A deployment can be rolled back by putting the previous artifact where the current one is. A migration cannot, because the previous artifact does not know how to read what the new one wrote. The two operations look alike in a pipeline and behave nothing alike at three in the morning.',
			'The practical consequence is ordering. A column has to exist before the code that reads it ships, and it has to keep existing until every process that reads it has stopped. That is two deployments around one migration, in that order, and skipping the first is the most common cause of a release that works on the machine that ran the migration and nowhere else.',
			'None of this needs a framework. It needs the schema change to be a separate, reviewed, forward-only artifact, and it needs somebody to say out loud which deployment it goes between.'
		].join('\n\n')
	},
	{
		title: 'The retry storm starts after the fix',
		summary: 'Recovery is the peak, not the return to normal.',
		read_minutes: 2,
		body: 'Every client that failed during the outage is holding work it intends to send the moment you come back, and most of them are holding it on a fixed interval. The first minute after recovery carries the outage and the backlog at once, which is why a service can survive the incident and fall over on the way out of it. Jitter on the client is the cheap half of the fix. A warm-up limit on the server is the half that works when the client is somebody else.'
	},
	{
		title: 'A cache is a second source of truth',
		summary: 'Naming it a cache does not exempt it from correctness.',
		read_minutes: 3,
		body: 'The moment two places can answer the same question, you own a consistency problem, and calling one of them a cache only decides who wins by default. The useful discipline is to write down what a stale answer costs, per key, before adding the cache. Some keys can be minutes behind and nobody notices. Some are entitlement checks, where being one second behind is the whole bug.'
	},
	{
		title: 'Timeouts belong to the caller',
		summary: 'The service cannot know how long its answer is worth waiting for.',
		read_minutes: 2,
		body: 'A five second budget is generous for a page render and absurd for a health probe, and both of them are calling the same endpoint. Put the deadline where the impatience is: the caller sets it, passes it down, and every layer below shortens it rather than replacing it. A server-side timeout is a backstop against leaked work, not a service level.'
	},
	{
		title: 'Idempotency keys are cheaper than reconciliation',
		summary: 'Deciding what a repeated request means is a five minute conversation or a five week project.',
		read_minutes: 3,
		body: 'Any write reachable over a network will arrive twice, because the client that timed out has no way to know whether the first attempt landed. Accepting a key on the request and remembering it turns that into a no-op. Refusing to think about it turns it into a report that two of everything exists, produced by finance, six weeks later.'
	},
	{
		title: 'The queue is not the problem',
		summary: 'A growing queue is a measurement, and consumers that cannot keep up are the finding.',
		read_minutes: 2,
		body: 'Depth alarms get wired to the wrong page because the queue is the thing with a number on it. What the number says is that arrivals exceed departures, and nothing in the broker can change either rate. Alarm on consumer lag and on the age of the oldest message. Depth on its own cannot distinguish a slow consumer from a busy morning.'
	},
	{
		title: 'Log the decision, not the data',
		summary: 'A log line that repeats a field you already store has told you nothing.',
		read_minutes: 2,
		body: 'The lines worth keeping are the ones that say why the code took the branch it took: which rule matched, which limit was hit, which candidate was rejected and on what grounds. Those are unreconstructable after the fact. The record itself is in the database, and printing it again mostly buys you a bill and a compliance question.'
	},
	{
		title: 'Feature flags are inventory',
		summary: 'Every flag is a branch you have promised to keep working.',
		read_minutes: 3,
		body: 'Two flags are four code paths, and only one of the four is ever exercised in anger. Flags are worth their cost while a decision is genuinely open, and they turn into unreviewed conditional logic the day after it closes. Give each one an owner and a removal date at the moment it is created, because nobody has ever gone looking for a flag to delete.'
	},
	{
		title: 'Read replicas move the problem, not the load',
		summary: 'A replica answers stale reads. Deciding which reads can be stale is still the work.',
		read_minutes: 3,
		body: 'Pointing reads at a replica is a configuration change; deciding which reads survive replication lag is a design change. The read that breaks is always the one immediately after a write, where the user expects to see what they just did. Route by intent rather than by verb, and give the read-after-write path the primary.'
	},
	{
		title: 'Health checks that call dependencies lie',
		summary: 'A probe that fails when your database is slow removes the last instance that was still serving cached pages.',
		read_minutes: 2,
		body: 'Readiness should answer whether this process can serve traffic, not whether the whole system is healthy. Fold a dependency into the probe and one slow dependency drains the entire pool, converting degradation into an outage. Check dependencies on a separate endpoint that alarms and never gates.'
	},
	{
		title: 'Pagination without an order is a lottery',
		summary: 'Offset paging over an unordered query returns rows twice and skips others.',
		read_minutes: 2,
		body: 'No ORDER BY means no guarantee, and the plan is free to differ between the query for page one and the query for page two. The duplicates and the gaps are both real and both silent. If the collection is being written while it is read, keyset paging over a stable key is the only version that holds.'
	},
	{
		title: 'The error message is part of the API',
		summary: 'Callers parse it whether you meant them to or not.',
		read_minutes: 2,
		body: 'Ship a machine-readable code and a human-readable message, and change them on different schedules. Without a code, the only thing a client can key off is the prose, and the harmless copy edit becomes an outage for somebody who never saw the change. Without a message, the person reading the log has to go and find the source.'
	},
	{
		title: 'Nullable is a decision, not a default',
		summary: 'Every nullable column is a question the schema declined to answer.',
		read_minutes: 3,
		body: 'A column that allows null is claiming that the absence of a value is meaningful, and half the time it is really claiming that nobody knew what the value should be at insert time. Those need different fixes: the first is a real optional field, the second is a missing default or a missing step in the write path. Deciding late means every reader has to decide too.'
	},
	{
		title: 'Rate limits protect the wrong thing by default',
		summary: 'Per-IP is easy to implement and rarely the unit you care about.',
		read_minutes: 3,
		body: 'One tenant behind one NAT looks like one caller, and one abusive tenant with a hundred workers looks like a hundred well-behaved ones. Limit on the identity that owns the cost: the account, the key, the tenant. Keep an IP limit for the routes that have no identity yet, which is login and little else.'
	},
	{
		title: 'Backups you have not restored are a rumor',
		summary: 'The restore is the feature. The backup is the prerequisite.',
		read_minutes: 3,
		body: 'A nightly job that reports success proves that a file was written, not that a system can be rebuilt from it. The parts that fail in practice are the parts nobody rehearses: a missing extension, an encryption key on the machine that died, a schema newer than the dump. Restore into a scratch environment on a schedule and measure how long it took.'
	},
	{
		title: 'Soft delete is a filter you will forget',
		summary: 'Every query written after the column exists has to remember it.',
		read_minutes: 2,
		body: 'Adding deleted_at is one migration and a permanent tax: from then on, every read that omits the predicate returns rows the product says do not exist. If deletion has to be reversible, prefer moving the row somewhere that cannot be selected by accident. If it does not, delete it.'
	},
	{
		title: 'Two clocks are one bug',
		summary: 'Comparing a timestamp from one machine with one from another is arithmetic on two different opinions.',
		read_minutes: 3,
		body: 'Durations computed across hosts inherit the drift between them, which is usually small and occasionally negative. Anything that decides ordering, expiry or eligibility should read one clock, and that clock should belong to the database or to a single service. Store instants in UTC and keep the local rendering at the edge.'
	},
	{
		title: 'Connection pools are a shared budget',
		summary: 'The database has a limit, and every process is spending against it.',
		read_minutes: 3,
		body: 'Ten instances with a pool of twenty is two hundred connections, and the database was configured for a hundred. The failure arrives as timeouts in the application and looks nothing like the cause. Size pools from the database limit downwards, not from the instance upwards, and count the workers, the cron jobs and the migration runner.'
	},
	{
		title: 'A retry without a budget is an outage amplifier',
		summary: 'Three retries at every layer is twenty-seven requests.',
		read_minutes: 3,
		body: 'Retries compose multiplicatively down a call chain, so a policy that is reasonable in isolation becomes a load test the moment three services each hold one. Decide which layer owns the retry, give it a total budget rather than a count, and make every layer below it fail fast.'
	},
	{
		title: 'Schema names are an interface',
		summary: 'Renaming a type is a breaking change to everything that reads it.',
		read_minutes: 2,
		body: 'A content type name reaches URLs, cached responses, dashboards and code you do not own. Choosing carefully once is cheaper than the migration that follows a rename, and a prefix that keeps two teams out of one namespace costs nothing at the time it is chosen.'
	},
	{
		title: 'Observability is a design constraint',
		summary: 'You cannot instrument a decision the code never made explicitly.',
		read_minutes: 3,
		body: 'If the choice is buried in a chain of implicit fallbacks, no amount of tracing recovers which one applied. Name the decision, give it a value, emit it once. The work is in the code that decides, not in the collector.'
	},
	{
		title: 'Denormalize on read, not on hope',
		summary: 'Copy a field when a measured query needs it, not when the model looks tidier.',
		read_minutes: 3,
		body: 'A duplicated field is a write path that has to be kept correct forever, in exchange for a join you may not have needed. Measure the join first. When the copy is genuinely worth it, write both places in one transaction and add the check that proves they still agree.'
	},
	{
		title: 'The staging environment is not the product',
		summary: 'It differs in the ways that matter and agrees in the ways that do not.',
		read_minutes: 2,
		body: 'Staging has a tenth of the data, none of the traffic shape and a different set of secrets, so the bugs it catches are the ones a test would have caught more cheaply. Keep it for rehearsing the deployment and the migration, which are the parts that genuinely need somewhere to fail. Do not ask it to predict performance.'
	},
	{
		title: 'Config that can be wrong should fail at boot',
		summary: 'A missing key discovered on the first request is an outage with a stack trace.',
		read_minutes: 2,
		body: 'Validate everything the process needs while it is still starting, then hold the parsed values immutably. Reading an environment variable in a handler defers the failure to whichever unlucky request arrives first, and spreads the same typo across every log in the system.'
	},
	{
		title: 'Ownership beats process',
		summary: 'A rule with no owner is a rule that quietly stops applying.',
		read_minutes: 2,
		body: 'Checklists decay because nobody is accountable for the item, not because the item was wrong. Name a person per constraint and give them the ability to say no. The check that has an owner survives the quarter; the check that has a document does not.'
	}
];

await run(async () => {
	heading('03  Write content');

	const client = signedInClient(await signIn());

	section('An author');
	const authorSlug = `${SLUG_PREFIX}priya-raman`;
	const author = await publish(client, AUTHORS, authorSlug, 'Priya Raman', {
		bio: 'Works on ingest pipelines. Spends most of her time explaining that the queue is not the problem.'
	});
	row(authorSlug, `${author.created ? 'created' : 'already present'}, id ${author.entry.id}`);

	section('Articles, each pointing at that author');
	let created = 0;
	for (const article of articles) {
		const written = await publish(client, ARTICLES, slugFor(article.title), article.title, {
			summary: article.summary,
			body: article.body,
			read_minutes: article.read_minutes,
			// The relation is written under the field name. It reads back under
			// author_id. Step 4 shows both halves of that.
			author: author.entry.id
		});
		if (written.created) created++;
	}
	row('entries', articles.length);
	row('created now', created);
	row('already present', articles.length - created);

	section('Rules the admin write enforces');
	note('slug is required, normalized, and rejects control characters and percent signs.');
	note('slug is unique per tenant across every content type at once, not per type. A collision answers 409.');
	note('status defaults to draft. Only admin and super_admin may set published directly.');
	note('The body is validated against the type, so a field the type does not declare is refused rather than ignored.');
	note('A validation failure answers 422 with {"errors":[...]} and no top-level error key.');
});
