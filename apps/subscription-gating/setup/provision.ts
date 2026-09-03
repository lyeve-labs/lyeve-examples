/**
 * Creates the subscription site's content types and seeds them.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * each seed checks its own content type, so a partial run finishes rather than
 * duplicating what already landed.
 */
import { lyeveFromEnv, applySchemas, listContent, createContent } from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const ARTICLES = 'sub_articles';
const MEMBERS = 'sub_members';

await applySchemas(client, [
	{
		name: ARTICLES,
		display_name: 'Subscription Articles',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'excerpt', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			// The engine has no enum type, so the two allowed values are a
			// convention the application enforces. Indexed because the tier is
			// the one column a listing filters on.
			{ name: 'tier', field_type: 'text', indexed: true }
		]
	},
	{
		name: MEMBERS,
		display_name: 'Members',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			// Indexed because the webhook finds a member by it, and that lookup
			// is on the path of every provider retry.
			{ name: 'email', field_type: 'email', indexed: true },
			{ name: 'tier', field_type: 'text', indexed: true },
			{ name: 'status', field_type: 'text' }
		]
	}
]);
console.log('content types ready');

const articles = [
	{
		slug: 'what-a-read-replica-does-not-give-you',
		title: 'What a Read Replica Does Not Give You',
		tier: 'free',
		excerpt:
			'A replica moves reads off the primary. It does not move writes, and it does not make a slow query fast.',
		body: 'A read replica gets proposed whenever a database runs hot. Sometimes it is the right answer. It is worth being precise about what it buys, because teams add one, watch the primary stay hot, and conclude that replication is broken.\n\nA replica takes read traffic off the primary. That is the whole of it. Writes still land on one machine, the primary still pays to ship its log, and a query that scans four million rows scans four million rows on the replica too.\n\nThe failure that follows is lag. The moment a request writes a row and reads it back from the replica you have a race, and it resolves in favor of the bug on exactly the machines where lag is worst. Route read-after-write to the primary and everything else to the replica, or accept that some people will not see their own edit.\n\nThere is a second cost nobody budgets for. Every replica is another pool, another set of credentials, another thing to fail over, another surface where a migration arrives out of order. The operational load is real even when the query load moves.\n\nAdd a replica when the primary is CPU-bound on reads and the queries are already as good as they will get. Add an index when it is not.'
	},
	{
		slug: 'reading-a-flame-graph-without-guessing',
		title: 'Reading a Flame Graph Without Guessing',
		tier: 'free',
		excerpt: 'Width is time. Height is nesting. Most misreadings confuse the two.',
		body: 'A flame graph has one axis that means something and one that does not. Width is the share of samples a frame appeared in. Height is how deep the call stack was. The horizontal order is alphabetical, so a frame further right is not later, and a tall spike is not slow.\n\nThat single confusion produces most of the wrong conclusions. A deep stack looks dramatic and costs nothing. A wide, shallow plateau three frames from the bottom is the thing paying your cloud bill.\n\nStart at the bottom and walk up while the width holds. The frame where a wide bar splits into many narrow ones is where the work spreads out, and that is usually the honest place to intervene. Optimizing above the split moves a sliver; optimizing at or below it moves the plateau.\n\nSelf time and total time are different questions. A frame can be wide because it is slow or because everything it calls is slow. Coloring by self time answers the first, which is the one you can act on directly.\n\nAnd take the graph from production traffic. A profile of a synthetic loop tells you what the loop does, which you already knew.'
	},
	{
		slug: 'the-cost-of-a-retry-you-did-not-bound',
		title: 'The Cost of a Retry You Did Not Bound',
		tier: 'free',
		excerpt: 'Three retries at every layer is not three attempts. It is twenty-seven.',
		body: 'Retries are the cheapest reliability you can buy and the easiest to buy too much of. A transient failure resolved by a second attempt is a real win. The trouble starts when every layer buys the same win independently.\n\nA client that retries three times, calling a gateway that retries three times, calling a service that retries three times, produces twenty-seven requests for one user action. Under normal conditions nobody notices. Under the load that made the first attempt fail, that multiplier is what turns a slow dependency into a dead one.\n\nThe fix is not to remove retries. It is to decide, once, which layer owns them, and to make every other layer fail fast. A retry budget expressed as a fraction of live traffic is better still: it caps the multiplier no matter how many hops the request takes.\n\nJitter matters as much as the count. Retrying on a fixed delay synchronizes every failed caller into the same instant, so recovery arrives as a thundering herd against a service that has not finished recovering.\n\nAnd retry only what is safe to repeat. An unbounded retry on a non-idempotent write is not resilience, it is a duplicate charge with a stack trace.'
	},
	{
		slug: 'connection-pools-are-not-caches',
		title: 'Connection Pools Are Not Caches',
		tier: 'member',
		excerpt:
			'A bigger pool does not buy throughput. Past the point the database can serve, it buys queueing you cannot see.',
		body: 'The pool size argument usually goes: requests are waiting on the database, so raise the pool. It works once, which is what makes it hard to stop doing.\n\nA connection is not a resource that produces work. It is permission to ask a machine with a fixed number of cores and a fixed number of spindles to do some. Past the point where that machine saturates, every additional connection converts waiting-in-your-app into waiting-inside-the-database, where your metrics cannot see it and where the database is now paying context-switch and lock-contention costs it was not paying before.\n\nThe symptom is distinctive. Latency gets worse as the pool gets larger, throughput plateaus or drops, and the database reports high active-session counts with low CPU utilization. That combination means contention, and no amount of extra permission to queue will fix it.\n\nThe useful number is roughly the number of cores the database can actually spend on your workload, plus a small allowance for the time a session spends blocked on disk. For most workloads on most machines that is a small two-digit number, and it is far below what people configure.\n\nA pool also has a second job that gets forgotten: it is a bulkhead. Sizing it at the database ceiling means one misbehaving endpoint can consume every connection and starve the rest of the application. Separate pools for separate workloads cost a little headroom and buy the ability to have one slow report without an outage.\n\nThe last part is the timeout. A pool without an acquisition timeout does not shed load, it absorbs it, and a request that has been waiting ninety seconds for a connection is one nobody is still around to receive. Set the timeout below the client deadline and let the request fail while failing is still cheap.'
	},
	{
		slug: 'migrations-that-run-while-traffic-does',
		title: 'Migrations That Run While Traffic Does',
		tier: 'member',
		excerpt:
			'Every safe migration is the same trick: never let the schema and the code disagree about a column at the same time.',
		body: 'A migration taken during a maintenance window has one hard part, which is the window. A migration taken under live traffic has one hard part too, and it is that the old code and the new schema exist at the same instant.\n\nThe discipline that survives this is expand and contract. Add the new column, deploy code that writes both and reads the old, backfill, deploy code that reads the new, and only then drop the old. Four deploys where one felt sufficient. Each of them is reversible on its own, which is the property you are actually buying.\n\nRenaming is the case that catches people. A rename is a drop and an add wearing one statement, and it breaks every process still running the previous release the moment it commits. There is no version of a rename that is safe in one step, which is why the expand-and-contract version is the only version.\n\nAdding a NOT NULL column with a default is safe on a modern engine and catastrophic on an old one, because the old one rewrites the table while holding a lock. Knowing which one you are on is not a detail. Test the statement against the same major version you run.\n\nThe backfill is where the outage usually happens. A single UPDATE over ten million rows holds one transaction open for the duration, bloats the write-ahead log, and blocks vacuum from reclaiming anything behind it. Batch it, keyed on the primary key, with a pause between batches and a bound on how long each one may hold. A backfill that takes six hours and disturbs nothing is a better backfill than one that takes eleven minutes and takes the site with it.\n\nLast, take the lock timeout seriously. A migration that waits for a lock queues every reader behind it, so an ALTER that would have completed instantly turns into an outage caused entirely by waiting. Set a short lock timeout and let the migration fail and retry rather than let it block the front door.'
	},
	{
		slug: 'budgeting-for-the-backfill-you-have-not-written',
		title: 'Budgeting for the Backfill You Have Not Written Yet',
		tier: 'member',
		excerpt:
			'Every schema decision commits you to a data migration later. The cheap ones are the ones you priced at the time.',
		body: 'A schema is a set of promises about what the data means. Changing a promise means rewriting every row that was written under the old one, and that rewrite is a project with a cost, a duration and a failure mode. Almost nobody prices it when the promise is made.\n\nThe pattern is easy to spot in hindsight. A status column that started as two values and now has nine. A JSON blob that absorbed six fields because adding a column felt heavy. A timestamp stored in local time because the first users were in one country. Each was the fast decision, and each has a backfill attached with an interest rate.\n\nThe question worth asking at design time is not whether the model is right. It is how many rows would have to be rewritten if it turns out to be wrong, and whether that rewrite can be done incrementally. A model you can fix ten thousand rows at a time is a model you can fix. One that demands a single consistent cutover across a billion rows is one you will live with instead.\n\nThis is what makes a version column on a wide table worth its storage. It lets old and new interpretations coexist, which converts a cutover into a migration you can run at whatever pace the system tolerates and stop halfway through without damage.\n\nBackfills also need an owner and a finish line. A backfill that reached ninety-four percent and got deprioritized leaves you permanently reading both formats, forever, which is worse than either format. Track it like a deploy and close it out.\n\nThe cheapest backfill remains the one written at the same time as the schema change that requires it, by the person who still remembers why. Six months later that person is answering from memory, and the memory is wrong in the specific way that matters.'
	},
	{
		slug: 'why-your-p99-moved-and-your-dashboard-did-not',
		title: 'Why Your p99 Moved and Your Dashboard Did Not',
		tier: 'member',
		excerpt:
			'Averaging a percentile across instances produces a number that is not a percentile of anything.',
		body: 'A tail-latency dashboard that stays flat while users complain is usually not lying about the data. It is computing something that was never the quantity you wanted.\n\nThe first cause is averaging percentiles. Each instance reports its own p99, and the dashboard takes the mean across instances. The mean of ten p99s is not the p99 of the combined population and can sit well below it, especially when one instance is the sick one. Percentiles do not average. They have to be recomputed from the underlying distribution, which means shipping histograms rather than summaries.\n\nThe second is the aggregation window. A p99 over five minutes hides a thirty-second stall completely, because the stall is well under one percent of the window. Users experienced a total outage; the graph experienced a rounding error. Shorter windows, or a max-over-time on a shorter inner window, will show it.\n\nThe third is where the measurement is taken. Server-side latency starts when the handler begins and ends when it returns. It excludes queueing in the accept backlog, time on the load balancer and everything the client spent on DNS and the handshake. A p99 that looks healthy at the handler and terrible at the edge is not a contradiction, it is two different measurements, and only one of them is what anyone experienced.\n\nThe fourth is sampling that is not uniform. Traces sampled at one percent, dropped when the buffer is full, will systematically drop the slow requests, because a system under stress is the system whose buffers are full. The tail disappears from the data exactly when it appears in production.\n\nHistograms with fixed buckets, computed at the edge, aggregated by summing buckets and never by averaging quantiles. It is more storage and it is the only version that answers the question.'
	},
	{
		slug: 'draining-a-node-without-dropping-a-request',
		title: 'Draining a Node Without Dropping a Request',
		tier: 'member',
		excerpt:
			'Between the moment a node is marked unhealthy and the moment traffic stops arriving, it must keep serving.',
		body: 'A rolling deploy that drops a handful of requests per node is usually blamed on the orchestrator. It is more often a sequencing mistake in the application, and the sequence is short enough to get right.\n\nWhen a shutdown signal arrives, the instinct is to stop accepting connections. That is the wrong first move. The load balancer does not know yet. It is still routing, its health check runs on an interval, and every request it sends during that interval hits a socket that is already closed.\n\nThe correct order starts with failing the readiness probe while continuing to serve. That is the whole trick: unhealthy to the balancer, fully functional to traffic. Wait out at least the probe interval times the unhealthy threshold, plus the propagation delay of the balancer itself, before touching the listener.\n\nOnly then stop accepting new connections, and let the in-flight requests finish against a deadline. The deadline needs to be shorter than the orchestrator termination grace period, or the process is killed mid-request and the careful drain achieves nothing.\n\nKeep-alive connections are the part that gets missed. A client holding an idle keep-alive will reuse it for its next request regardless of what the balancer decided. Sending a Connection: close on responses during the drain retires those sockets in an orderly way instead of having them fail on the next use.\n\nBackground work needs its own drain. A worker that pulled a job and is halfway through it should finish or return the job to the queue explicitly. Exiting and letting a visibility timeout eventually expire works, but it means the job is invisible for the length of that timeout, which is the kind of delay that shows up as an unexplained gap in a downstream pipeline.\n\nDone properly, a drain takes tens of seconds per node and nobody notices. Done in the wrong order it takes no time at all and produces exactly the error rate you deployed to avoid.'
	}
];

// Slugs are unique per tenant across every content type, not per content type,
// so a member slug carries the app prefix. A reader is looked up by email and by
// id, never by slug, so nothing in a URL depends on this.
const members = [
	{
		slug: 'sub-member-priya-raghunathan',
		title: 'Priya Raghunathan',
		email: 'priya.raghunathan@northwind-freight.example',
		tier: 'member',
		status: 'active'
	},
	{
		slug: 'sub-member-tomas-halloran',
		title: 'Tomas Halloran',
		email: 't.halloran@brightline.example',
		tier: 'member',
		status: 'past_due'
	},
	{
		slug: 'sub-member-ines-ferreira',
		title: 'Ines Ferreira',
		email: 'ines.ferreira@quarryhill.example',
		tier: 'free',
		status: 'canceled'
	}
];

// Each content type is checked separately. A run that created the articles and
// then failed part-way finishes the members on the next attempt instead of
// writing a second copy of everything.
if ((await listContent(client, ARTICLES, { limit: 25 })).length > 0) {
	console.log('articles already seeded');
} else {
	for (const article of articles) {
		await createContent(client, {
			schema: ARTICLES,
			slug: article.slug,
			title: article.title,
			body: {
				slug: article.slug,
				excerpt: article.excerpt,
				body: article.body,
				tier: article.tier
			}
		});
	}
	console.log(`seeded ${articles.length} articles`);
}

if ((await listContent(client, MEMBERS, { limit: 25 })).length > 0) {
	console.log('members already seeded');
} else {
	for (const member of members) {
		await createContent(client, {
			schema: MEMBERS,
			slug: member.slug,
			title: member.title,
			body: {
				slug: member.slug,
				// Lower-cased on the way in because the webhook finds a member
				// with filters[email]=, which is exact equality with no folding.
				email: member.email.toLowerCase(),
				tier: member.tier,
				status: member.status
			}
		});
	}
	console.log(`seeded ${members.length} members`);
}
