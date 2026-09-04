/**
 * The knowledge base this example searches.
 *
 * Search cannot be judged on three rows. Ranking only shows itself when several
 * hundred documents compete for the same query, a synonym only earns its keep
 * when the vocabulary genuinely splits, and an analytics summary of two queries
 * says nothing. So the corpus is built here rather than typed out: ten
 * subjects, each with ten failure modes, six operating contexts and six
 * paragraphs of diagnosis, composed into 420 distinct articles.
 *
 * It is deterministic. Article n is always the same article, so a reader can
 * follow the examples in the README and see the numbers the README quotes.
 *
 * Nothing here is filler. Every paragraph is about the thing its title names,
 * because a search index full of interchangeable text ranks interchangeably and
 * proves nothing about the ranker.
 */

export interface Article {
	slug: string;
	title: string;
	summary: string;
	body: string;
	keywords: string;
	category: string;
}

export interface Category {
	slug: string;
	title: string;
}

interface Failure {
	slug: string;
	/** A noun phrase that opens the title. */
	phrase: string;
	summary: string;
	lead: string;
	keywords: string;
}

interface Context {
	slug: string;
	/** A prepositional phrase that closes the title. */
	phrase: string;
	summaryTail: string;
	para: string;
}

interface Subject {
	id: string;
	category: string;
	keyword: string;
	failures: Failure[];
	contexts: Context[];
	notes: string[];
}

const SUBJECTS: Subject[] = [
	{
		id: 'postgres',
		category: 'postgresql',
		keyword: 'postgres',
		failures: [
			{
				slug: 'autovacuum-behind',
				phrase: 'Autovacuum falling behind',
				summary: 'Dead tuples accumulate faster than autovacuum removes them, and every scan pays for them.',
				lead: 'A table that takes constant updates carries a dead tuple for every row version it replaces. Autovacuum reclaims them, but it runs with a cost limit, and a table whose churn exceeds that limit never gets back to a clean state. The visible symptom is a sequential scan that reads far more pages than the live row count justifies.',
				keywords: 'autovacuum, bloat, dead tuples, vacuum'
			},
			{
				slug: 'flush-spikes',
				phrase: 'Write latency spiking on a fixed cycle',
				summary: 'Write latency jumps on a fixed cycle because the whole dirty buffer set is flushed at once.',
				lead: 'A checkpoint writes every dirty shared buffer to disk, and if the interval is long and the buffer pool is large that is a great deal of writing arriving together. Latency graphs show a sawtooth whose period matches the checkpoint timeout exactly. The fix is to spread the work rather than reduce it.',
				keywords: 'flush, wal, write latency, dirty buffers'
			},
			{
				slug: 'xid-wraparound',
				phrase: 'Transaction ID wraparound warnings',
				summary: 'The oldest unfrozen transaction is old enough that the database is counting down to a forced shutdown.',
				lead: 'Transaction ids are a finite counter, and rows carry the id that created them. If the oldest unfrozen row is too old, the database starts warning, then refuses new transactions rather than lose the ability to tell past from future. Every warning names a specific relation, and that relation is almost always one autovacuum has been unable to finish.',
				keywords: 'wraparound, freeze, xid, autovacuum'
			},
			{
				slug: 'replica-lag',
				phrase: 'Replica lag climbing',
				summary: 'A standby applies WAL more slowly than the primary produces it, so reads served from it go stale.',
				lead: 'Replay is single-threaded. A primary that spreads its writes across many concurrent sessions can generate WAL faster than one recovery process can apply it, and the gap grows monotonically until the write rate drops. Any read routed to that standby is answering from an older version of the database than the caller expects.',
				keywords: 'replication, lag, standby, wal replay'
			},
			{
				slug: 'idle-in-transaction',
				phrase: 'Sessions stuck idle in transaction',
				summary: 'An open transaction holding no lock still pins the oldest snapshot and blocks cleanup.',
				lead: 'A session that has issued a statement and then gone quiet without committing keeps its snapshot alive. Nothing older than that snapshot can be vacuumed, so bloat accumulates across the whole database because of one connection doing nothing. The state is visible in the activity view and is almost always an application that forgot a commit on an error path.',
				keywords: 'idle in transaction, snapshot, bloat, connection'
			},
			{
				slug: 'toast-bloat',
				phrase: 'TOAST table bloat',
				summary: 'Large values live in a side table that grows on its own schedule and is easy to miss.',
				lead: 'A value too large for a page is stored out of line in an associated TOAST table, compressed and chunked. Updating the row rewrites those chunks, so a column holding documents produces dead tuples in a relation that never appears in the table size a dashboard reports. Sizing the base table alone understates the disk the table actually occupies.',
				keywords: 'toast, bloat, large values, storage'
			},
			{
				slug: 'lock-queue',
				phrase: 'A lock queue behind one ALTER TABLE',
				summary: 'One statement waiting for an exclusive lock stops every statement queued behind it.',
				lead: 'A schema change takes an access exclusive lock, and it waits for the current readers to finish before it takes one. While it waits, every new reader queues behind it, because lock requests are granted in order. A change that would have taken milliseconds turns into a full outage for as long as the longest running query in front of it.',
				keywords: 'lock, ddl, alter table, blocking'
			},
			{
				slug: 'plan-flip',
				phrase: 'A query plan that flipped to a sequential scan',
				summary: 'The planner stopped choosing the index, and the statistics explain why.',
				lead: 'A plan is chosen from estimates, and estimates come from sampled statistics. When the sample stops matching the data, the estimated row count for a predicate drifts, and past a threshold the planner decides a scan is cheaper than an index lookup. The plan did not degrade; the input to the decision did.',
				keywords: 'query plan, statistics, analyze, seq scan'
			},
			{
				slug: 'temp-file-spill',
				phrase: 'Sorts spilling to temporary files',
				summary: 'A sort or hash larger than the work memory allowance finishes on disk instead of in memory.',
				lead: 'Each sort node gets its own work memory allowance, and a query with several of them can use several multiples of the configured value. When a node exceeds its allowance it writes runs to temporary files and merges them, which turns a memory operation into an IO operation. The log records the file size, which is the number to size against.',
				keywords: 'work_mem, sort, temp files, spill'
			},
			{
				slug: 'wal-growth',
				phrase: 'WAL growing without bound',
				summary: 'Something is holding WAL segments the database would otherwise recycle.',
				lead: 'WAL segments are recycled once no consumer needs them. A replication slot for a standby that has gone away, or an archive command that keeps failing, pins them indefinitely, and the volume fills at the rate the database writes. The disk is the symptom. The held resource is the cause, and it has a name in the catalog.',
				keywords: 'wal, replication slot, archive, disk full'
			}
		],
		contexts: [
			{
				slug: 'under-load',
				phrase: 'under sustained load',
				summaryTail: 'Under sustained write load the margin that hid the problem disappears.',
				para: 'Under sustained load the database has no idle window to catch up in. Maintenance work that assumed a quiet period competes with foreground queries for the same buffers and the same IO, so the backlog grows during exactly the hours it most needs to shrink.'
			},
			{
				slug: 'after-a-bulk-import',
				phrase: 'after a bulk import',
				summaryTail: 'A bulk import concentrates a month of change into a few minutes, which is what exposes it.',
				para: 'A bulk import changes the shape of the table faster than the machinery around it can react. Statistics describe the table as it was before the load, free space maps are stale, and the first queries after the import are planned against a database that no longer exists. Running the statistics update as the last step of the import is cheaper than diagnosing it afterwards.'
			},
			{
				slug: 'on-a-read-replica',
				phrase: 'on a read replica',
				summaryTail: 'On a replica the same fault has a different remedy, because the replica cannot write.',
				para: 'A replica cannot fix this itself. It has no authority to change the data, so anything that depends on writing has to happen on the primary and arrive through replication. That inverts the usual debugging order: the evidence is on the replica and the cause is upstream of it.'
			},
			{
				slug: 'during-a-rolling-deploy',
				phrase: 'during a rolling deploy',
				summaryTail: 'A rolling deploy runs two versions at once, and both of them are talking to this database.',
				para: 'During a rolling deploy two application versions hold connections at the same time, and they do not agree about the schema. Whatever the new version needs has to be tolerable to the old one for the length of the rollout, which is why the change that is safe to deploy is rarely the change that is simplest to write.'
			},
			{
				slug: 'in-a-multi-tenant-database',
				phrase: 'in a multi-tenant database',
				summaryTail: 'With every tenant in one table the blast radius is every tenant.',
				para: 'When every tenant shares the table, one tenant is enough to cause this for all of them. The largest tenant sets the table statistics, the shape of the index and the duration of the maintenance window, and a query tuned against the median tenant plans badly for the outlier. Tenant identity belongs in the leading column of the index for exactly this reason.'
			},
			{
				slug: 'after-a-version-upgrade',
				phrase: 'after a version upgrade',
				summaryTail: 'The upgrade did not cause it so much as stop hiding it.',
				para: 'After a major version upgrade the planner is new, the defaults may have moved, and the statistics were reset. Behavior that looks like a regression is often the new version making a different, defensible choice with worse inputs. Refresh the statistics before concluding anything about the release.'
			}
		],
		notes: [
			'Start from the catalog rather than from the graph. The database knows which relation is affected, which session holds what, and how old the oldest snapshot is, and every one of those is a single query away. A dashboard aggregates that away, which is useful for noticing and useless for diagnosing.',
			'Measure before and after with the same query. Fixes in this area are easy to believe in and hard to verify, because load varies on its own. Capture the plan, the buffer counts and the wall clock for one representative statement, change one thing, and capture them again.',
			'Configuration is the last resort, not the first. Raising a limit buys time proportional to how much you raised it, and the underlying rate is unchanged. It is worth doing to survive the afternoon and worth undoing once the cause is fixed.',
			'The cost is paid on read even when the cause is write. Extra pages, extra tuples and stale statistics all land on the reader, which is why the first complaint comes from a query that has not changed in months.',
			'Keep the remedy inside a maintenance path the database already has. Hand-written cleanup that duplicates vacuum, reindex or analyze tends to take heavier locks than the built-in version and to skip the bookkeeping the planner depends on.',
			'Write the number down. The useful artifact from this kind of investigation is not the fix but the threshold: the size, the rate or the duration at which the behavior changed, because that is what tells you when it is coming back.'
		]
	},
	{
		id: 'mysql',
		category: 'mysql',
		keyword: 'mysql',
		failures: [
			{
				slug: 'gap-lock-deadlock',
				phrase: 'Deadlocks between two inserts',
				summary: 'Two sessions inserting adjacent keys deadlock on the gap between them, not on a row.',
				lead: 'Under repeatable read, an insert takes a lock on the gap before the key as well as the key itself, which is how the isolation level prevents phantom rows. Two sessions inserting into the same range can each hold the gap the other needs. Neither statement touches a row the other touched, so the deadlock report reads as though nothing conflicted.',
				keywords: 'deadlock, gap lock, innodb, repeatable read'
			},
			{
				slug: 'rows-affected-lies',
				phrase: 'An update that reports zero rows changed',
				summary: 'The row matched and the value was identical, so the count says nothing happened.',
				lead: 'By default the affected row count reports rows changed, not rows matched. An update that writes the value already stored returns zero, and application code that treats zero as not found then reports a missing record. The client flag that switches to matched rows fixes the read and breaks every upsert that uses the count to tell an insert from an update.',
				keywords: 'rows affected, found rows, update, upsert'
			},
			{
				slug: 'collation-case-fold',
				phrase: 'Two identifiers that collide on case',
				summary: 'A case-insensitive collation makes two distinct values equal, including in a unique index.',
				lead: 'The default collation folds case, so a lookup for one spelling returns the row stored under another and a unique index refuses the second spelling as a duplicate. This is correct behavior for prose and wrong for identifiers. A column that holds a key needs a binary or case-sensitive collation declared on the column, not fixed in the query.',
				keywords: 'collation, case sensitivity, unique index, charset'
			},
			{
				slug: 'sort-memory',
				phrase: 'Out of sort memory during a large read',
				summary: 'Every selected column goes into the sort buffer, so wide rows exhaust it long before the row count does.',
				lead: 'The sort buffer holds the columns being selected, not just the sort key. A query that orders a few thousand rows carrying a document column can exceed the buffer while a query ordering a million narrow rows fits comfortably. The remedy is usually to sort keys and fetch rows in a second statement rather than to raise the buffer.',
				keywords: 'sort buffer, out of sort memory, order by, memory'
			},
			{
				slug: 'implicit-conversion',
				phrase: 'An index the query refuses to use',
				summary: 'A parameter of a different type forces a conversion, and the conversion rules out the seek.',
				lead: 'Comparing a string column to a numeric parameter converts the column, not the parameter, and a converted column cannot be seeked. The plan shows a full scan against an index that exists and is perfectly usable. The type of the bind parameter is the whole cause, and it is invisible in the SQL text.',
				keywords: 'implicit conversion, index, full scan, bind parameter'
			},
			{
				slug: 'metadata-lock',
				phrase: 'Everything blocked on a metadata lock',
				summary: 'One long transaction that touched a table stops any change to that table, and then stops all readers.',
				lead: 'A metadata lock is held for the whole transaction, not just the statement. A schema change waits for it, and new queries queue behind the waiting change. The blocking session is often reported as sleeping, which sends people looking for a slow query when the problem is a transaction that never ended.',
				keywords: 'metadata lock, ddl, blocking, transaction'
			},
			{
				slug: 'temp-table-on-disk',
				phrase: 'Temporary tables written to disk',
				summary: 'An internal temporary table exceeds its memory limit and is converted, and the query slows by an order of magnitude.',
				lead: 'Some plans materialize an intermediate result. While it fits in memory the cost is invisible; when it does not, the engine converts it to an on-disk table mid-query. The statement is the same statement it was yesterday, and the only difference is that the intermediate result crossed a threshold nobody was watching.',
				keywords: 'temporary table, tmp_table_size, disk, plan'
			},
			{
				slug: 'autoinc-gaps',
				phrase: 'Gaps in an auto-increment sequence',
				summary: 'A rolled back insert consumes its id, and the id is never reissued.',
				lead: 'The counter is not transactional. A failed or rolled back insert still advanced it, so the sequence has holes, and any code that treats the id as a count or expects contiguity is wrong. This is a design constraint rather than a fault, and the only real bug is the assumption.',
				keywords: 'auto increment, sequence, gaps, rollback'
			},
			{
				slug: 'binlog-growth',
				phrase: 'Binary logs filling the volume',
				summary: 'Retention is expressed in time or size, and neither matches the rate at which the logs are produced.',
				lead: 'Binary logs are retained until an expiry rule removes them, and the rule is fixed while the write rate is not. A batch job that rewrites a large table produces more log in an hour than the previous week, and the disk fills while retention is still nominally correct. Replicas that have fallen behind extend the problem, because a log a replica still needs cannot be purged.',
				keywords: 'binlog, retention, disk full, replication'
			},
			{
				slug: 'connection-storm',
				phrase: 'Max connections reached in seconds',
				summary: 'A stall upstream converts into a connection storm, and the storm outlives the stall.',
				lead: 'When queries slow down, callers keep arriving and each takes a connection, so the connection count rises as a direct consequence of latency. The limit is reached, new callers are refused, and their retries add load to a server that is already saturated. The failure is self-sustaining and does not end when the original slowdown does.',
				keywords: 'max connections, too many connections, storm, retry'
			}
		],
		contexts: [
			{
				slug: 'under-load',
				phrase: 'under sustained load',
				summaryTail: 'Load is what turns the latent version of this into the visible one.',
				para: 'At low volume the server absorbs this. Concurrency is what changes it: the same statements interleave, the same locks overlap, and the queue that was always theoretically possible becomes the normal state of the server.'
			},
			{
				slug: 'after-a-schema-change',
				phrase: 'after a schema change',
				summaryTail: 'The schema change is the event; the behavior was waiting for it.',
				para: 'A schema change resets more than the column list. Index selectivity moves, cached plans are discarded, and the first traffic after the change is planned against fresh and often thin statistics. Anything that was marginal before the change is decided differently after it.'
			},
			{
				slug: 'on-a-replica',
				phrase: 'on a replica',
				summaryTail: 'On a replica the symptom appears where the cause is not.',
				para: 'The replica applies what the primary decided. Anything the primary did cheaply because of an in-memory advantage may be expensive to replay, and a replica sized for reads rather than for writes falls behind while looking idle on every CPU graph.'
			},
			{
				slug: 'during-a-batch-job',
				phrase: 'during a batch job',
				summaryTail: 'The batch job is the only caller doing this, and it is enough.',
				para: 'A batch job is a single caller with none of the natural pacing of user traffic. It holds one transaction for a long time, touches rows in an order nothing else uses, and produces a burst of change with no gaps in it. Almost every problem in this area is easiest to reproduce by running one.'
			},
			{
				slug: 'in-a-multi-tenant-database',
				phrase: 'in a multi-tenant database',
				summaryTail: 'One table for every tenant means one tenant can do this to all of them.',
				para: 'With tenants sharing tables, the noisy one sets the conditions everyone else runs under. Locks taken for one tenant queue statements for another, and the index that suits the average tenant is the wrong index for the largest. Scoping every statement by tenant is a correctness requirement first and a performance one second.'
			},
			{
				slug: 'after-a-failover',
				phrase: 'after a failover',
				summaryTail: 'Failover promoted a server that was configured for a different job.',
				para: 'After a failover the new primary is a machine that has spent its life as a replica. Its buffer pool is warm for the read traffic it used to serve, its configuration may differ in exactly the settings that matter here, and the caches the application relied on are cold. Several unrelated regressions in the first hour usually have this one cause.'
			}
		],
		notes: [
			'Read the error text literally. This server distinguishes matched from changed, sleeping from idle, and locked from waiting, and each of those distinctions is the answer to a different question. Paraphrasing the message loses the one word that identifies the layer.',
			'Reproduce with two sessions before believing any explanation that involves locking. A single client cannot show a conflict, and a theory about concurrency that has never been run against two connections is a guess.',
			'Check the isolation level before the query. Behavior that looks like a bug in a statement is frequently correct behavior for the level the connection is running at, and the level is set somewhere far from the SQL.',
			'Prefer a change to the schema over a change to the session. A collation, a column type or an index declared on the table is the same for every client; a setting applied per connection is one forgotten connection away from being wrong again.',
			'Instrument the count, not just the duration. Rows examined, rows sent and temporary tables created explain slow statements that timing alone cannot, because two plans with the same duration today diverge as the table grows.',
			'The fix that survives is the one that removes the condition. Raising a buffer, extending a timeout or adding a retry all make this less frequent, which is worse than making it impossible, because it now happens only when someone is not looking.'
		]
	},
	{
		id: 'pooling',
		category: 'connection-pooling',
		keyword: 'pooling',
		failures: [
			{
				slug: 'pool-exhaustion',
				phrase: 'Connection pool exhaustion',
				summary: 'Every connection is checked out and callers queue for one that never comes back.',
				lead: 'A pool is a fixed number of permissions to talk to the database. When every one is held, callers wait, and the wait is added to a request that has not started its work yet. The graph that identifies this is the checkout wait time, which rises long before any query gets slower.',
				keywords: 'pool exhaustion, checkout, wait, saturation'
			},
			{
				slug: 'leaked-connection',
				phrase: 'A leaked connection',
				summary: 'A connection taken and never returned reduces the pool by one, permanently.',
				lead: 'A connection is returned by a deferred close on the happy path and by nothing at all on some error path. Each leak shrinks the effective pool, so throughput degrades in steps rather than smoothly, and the shape of the decline points straight at an error branch. Restarting the process hides it until the next occurrence.',
				keywords: 'leak, close, defer, pool size'
			},
			{
				slug: 'oversized-pool',
				phrase: 'A pool larger than the database can serve',
				summary: 'More connections than cores turns application waiting into database contention.',
				lead: 'Past the point where the database saturates, an extra connection does not add throughput. It moves the queue from the application, where it is measurable, into the database, where it shows up as lock contention and context switching. Latency gets worse as the pool gets larger, which is the signature of this mistake.',
				keywords: 'pool size, contention, throughput, sizing'
			},
			{
				slug: 'session-state-leak',
				phrase: 'Session state surviving a return to the pool',
				summary: 'Closing a pooled connection returns the session, it does not end it.',
				lead: 'Whatever the last caller set on the session is still set for the next one: a search path, a role, a temporary table, a session-level lock. Returning the connection is bookkeeping in the pool, not a reset at the server. Anything that must not outlive the request has to be undone explicitly, or the connection has to be discarded rather than returned.',
				keywords: 'session state, reset, search_path, advisory lock'
			},
			{
				slug: 'no-max-lifetime',
				phrase: 'Connections that live forever',
				summary: 'Without a maximum lifetime a pool never migrates off a server that is being replaced.',
				lead: 'A pool with no lifetime cap keeps working connections indefinitely, which is efficient and makes the pool blind to changes behind it. After a failover, a resize or a certificate rotation, the old endpoint stays in use for as long as the connections survive. A bounded lifetime is what makes the topology change take effect without a restart.',
				keywords: 'max lifetime, failover, rotation, dns'
			},
			{
				slug: 'unbounded-queue',
				phrase: 'An unbounded checkout queue',
				summary: 'Waiting without a limit converts an overload into a timeout for every caller instead of a refusal for some.',
				lead: 'When the pool is full, a caller either waits or is refused. Waiting without a bound means every request in the system eventually accumulates behind the same limit, and the whole service crosses its deadline at once. A short bounded wait sheds the excess and keeps the requests that can still be served inside their budget.',
				keywords: 'queue, timeout, load shedding, backpressure'
			},
			{
				slug: 'per-request-pool',
				phrase: 'A pool constructed per request',
				summary: 'A pool created inside a handler is not a pool, and it opens a connection every time.',
				lead: 'Pooling only works if the pool outlives the requests that use it. Constructing one per request pays the full connection cost, including authentication and TLS, on every call, and holds far more sockets open than the configured maximum implies. The symptom is a connection count that tracks request rate exactly.',
				keywords: 'pool lifecycle, singleton, connect cost, sockets'
			},
			{
				slug: 'health-check-cost',
				phrase: 'Health checks consuming the pool',
				summary: 'A liveness probe that takes a connection competes with the traffic it is meant to protect.',
				lead: 'A probe that checks the database by borrowing a connection is indistinguishable from a request during a saturation event. It waits, it times out, the instance is marked unhealthy, and it is removed from rotation while it is still capable of serving. The probe caused the removal, not the fault it was watching for.',
				keywords: 'health check, probe, readiness, saturation'
			},
			{
				slug: 'transaction-held-across-io',
				phrase: 'A transaction held across a network call',
				summary: 'A connection checked out for the duration of an external request multiplies the time it is unavailable.',
				lead: 'A handler that opens a transaction, calls another service and then commits holds the connection for the whole round trip. The pool is now sized by the slowest dependency rather than by the database. A dependency that gets slower reduces effective pool capacity without touching the database at all.',
				keywords: 'transaction, external call, hold time, latency'
			},
			{
				slug: 'no-connect-timeout',
				phrase: 'No timeout on acquiring a connection',
				summary: 'A missing deadline turns a temporary shortage into an unbounded hang.',
				lead: 'Every wait in a request path needs a deadline, and connection acquisition is the wait people forget. Without one, a caller blocks until something else fails, and the resulting stack trace points at whatever timed out first rather than at the pool. The deadline should be short enough that the caller can still do something useful with the failure.',
				keywords: 'timeout, deadline, acquire, hang'
			}
		],
		contexts: [
			{
				slug: 'under-load',
				phrase: 'under sustained load',
				summaryTail: 'The pool is the first place sustained load becomes visible.',
				para: 'A pool is the narrowest part of the request path, so sustained load registers here before it registers anywhere else. Checkout wait is the leading indicator, and it moves while every other graph still looks healthy.'
			},
			{
				slug: 'during-a-rolling-deploy',
				phrase: 'during a rolling deploy',
				summaryTail: 'Half the fleet is new and half is old, and they are sharing one database.',
				para: 'During a rollout the number of processes holding connections is temporarily larger than the steady state, because the new instances start before the old ones drain. Any per-instance pool size multiplied by that peak has to remain inside the database limit, or the deploy itself causes the outage.'
			},
			{
				slug: 'behind-a-proxy',
				phrase: 'behind a connection proxy',
				summaryTail: 'There are now two pools, and only one of them is configured where you are looking.',
				para: 'With a proxy in the path there are two pools: the application to the proxy, and the proxy to the database. Transaction pooling at the proxy also changes what a session can carry, because a session-scoped setting no longer belongs to the caller that set it. Sizing one side alone gets the arithmetic wrong.'
			},
			{
				slug: 'in-a-serverless-runtime',
				phrase: 'in a serverless runtime',
				summaryTail: 'A runtime that scales instances scales pools with them.',
				para: 'A runtime that creates an instance per burst of traffic creates a pool per instance, and the database sees the sum. Reuse between invocations is not guaranteed, so the effective connection count is set by the platform rather than by the configuration file. This is the environment where an external proxy stops being optional.'
			},
			{
				slug: 'after-a-failover',
				phrase: 'after a failover',
				summaryTail: 'The pool is still holding connections to a server that is no longer the primary.',
				para: 'After a failover the pool holds connections to an endpoint that has changed role. Some of them are dead and will be discovered on next use, some are alive and now read-only, and the pool cannot tell the difference until a statement fails. Bounded lifetimes and a check on checkout are what shorten the confusion.'
			},
			{
				slug: 'in-a-multi-tenant-database',
				phrase: 'in a multi-tenant service',
				summaryTail: 'One tenant can consume the pool every other tenant needs.',
				para: 'A shared pool is a shared resource, so one tenant issuing heavy queries reduces the capacity available to all of them. Per-tenant limits inside one pool, or a small pool per tier, is the only structure that keeps a single caller from setting everyone else latency.'
			}
		],
		notes: [
			'Measure checkout wait separately from query duration. They are added together in the number a user experiences and have completely different causes, and a single latency figure hides which one moved.',
			'Size the pool from the database, not from the application. The useful ceiling is what the database can actually spend on this workload, and it is usually a small two-digit number, far below what people configure.',
			'A pool is also a bulkhead. Sized at the database ceiling it protects nothing, because one misbehaving caller can consume every connection. Sized deliberately smaller, it limits the damage a single service can do.',
			'Return the connection in the same function that took it. Ownership that crosses a function boundary is where leaks live, and no amount of testing on the happy path finds them.',
			'Prove a leak with the pool statistics, not by reading code. In-use, idle and wait counts over time show a leak as a staircase, and the step lines up with the request that caused it.',
			'Treat acquisition as part of the request budget. If the budget is two hundred milliseconds, a connection wait of two hundred milliseconds has already spent it, and continuing to the query is work nobody will read.'
		]
	},
	{
		id: 'indexing',
		category: 'indexes-and-plans',
		keyword: 'indexing',
		failures: [
			{
				slug: 'wrong-column-order',
				phrase: 'A composite index in the wrong order',
				summary: 'The leading column decides what the index can be seeked for, and this one is not it.',
				lead: 'A composite index supports a prefix of its columns. Ordered by the low-selectivity column first, it cannot answer a query that filters on the other one, and the plan falls back to a scan even though every column it needs is present. Which column leads is the whole design decision.',
				keywords: 'composite index, column order, prefix, selectivity'
			},
			{
				slug: 'function-on-column',
				phrase: 'A function applied to the indexed column',
				summary: 'Wrapping the column in a function hides it from the index.',
				lead: 'An index stores the column value, so a predicate on a transformation of that value cannot use it. Lowercasing, casting or date-truncating the column in the where clause turns a seek into a scan. Either index the expression or move the transformation to the parameter side.',
				keywords: 'sargable, expression index, function, where clause'
			},
			{
				slug: 'unused-index',
				phrase: 'An index nothing uses',
				summary: 'Every write pays for it and no read benefits, and the usage statistics say so.',
				lead: 'An index has a permanent cost on insert, update and delete and a benefit only when a query chooses it. Indexes accumulate over years, and a meaningful fraction of them have never been read. The catalog counts scans per index, which makes this the rare tuning question with an unambiguous answer.',
				keywords: 'unused index, write amplification, index bloat, catalog'
			},
			{
				slug: 'missing-covering-column',
				phrase: 'An index that forces a heap lookup',
				summary: 'One column outside the index turns an index-only scan into a fetch per row.',
				lead: 'When every column a query needs is in the index, the table itself is never read. Adding one selected column that is not in the index reintroduces a lookup for each matching row, and at a few thousand rows that dominates the query. Including the column is often cheaper than the fetch it removes.',
				keywords: 'covering index, index only scan, include, heap fetch'
			},
			{
				slug: 'low-cardinality-index',
				phrase: 'An index on a low-cardinality column',
				summary: 'A column with three distinct values cannot narrow anything, so the planner ignores it.',
				lead: 'An index earns its cost by eliminating rows. A boolean or a status with a handful of values does not eliminate enough for a lookup to beat a scan, so the planner declines to use it and the write cost is paid for nothing. Combined with a selective column in a composite index, the same column is useful.',
				keywords: 'cardinality, selectivity, boolean, planner'
			},
			{
				slug: 'stale-statistics',
				phrase: 'Stale statistics choosing the wrong index',
				summary: 'The planner is deciding with a description of the table from before it grew.',
				lead: 'Estimates come from a sample, and the sample is refreshed on a schedule that does not know about your import. A table whose distribution has shifted produces confident estimates that are wrong by orders of magnitude, and the plan follows the estimate. Refreshing statistics is the first thing to try and the last thing people try.',
				keywords: 'statistics, analyze, estimate, cardinality'
			},
			{
				slug: 'index-on-growing-key',
				phrase: 'Contention on a monotonically increasing key',
				summary: 'Every insert lands on the same index page, and that page becomes the bottleneck.',
				lead: 'An index on a timestamp or a sequence puts every new row at the right edge. The page split, the buffer and the lock are all in one place, so insert throughput is limited by a single page regardless of how many cores are available. Distributing the leading value, or accepting a different key, is the structural answer.',
				keywords: 'hot page, sequence, insert contention, page split'
			},
			{
				slug: 'duplicate-indexes',
				phrase: 'Two indexes that do the same job',
				summary: 'An index whose columns are a prefix of another index is redundant, and both are maintained.',
				lead: 'An index on one column and another on that column plus a second are not two useful indexes. The narrower one is answerable by the wider one, so it contributes nothing to reads and its full cost to writes. These accumulate when different people add an index for different queries without looking at what exists.',
				keywords: 'redundant index, prefix, maintenance, write cost'
			},
			{
				slug: 'partial-index-mismatch',
				phrase: 'A partial index the query cannot match',
				summary: 'The predicate has to imply the index predicate, and almost does.',
				lead: 'A partial index only covers rows satisfying its condition, and the planner must be able to prove the query is inside that condition. A query filtering on a status the index does not mention, or on a range the planner cannot prove is a subset, gets no benefit at all. The index is not broken; the implication does not hold.',
				keywords: 'partial index, filtered index, predicate, implication'
			},
			{
				slug: 'index-created-online-blocking',
				phrase: 'Index creation blocking writes',
				summary: 'A plain index build takes a lock that stops writes for the duration.',
				lead: 'Building an index reads the whole table, and by default it does so under a lock that excludes writes. On a large table that is an outage measured in minutes. The concurrent variant trades a longer build and a chance of leaving an invalid index behind for not blocking, which is the right trade in production.',
				keywords: 'create index, concurrently, lock, online ddl'
			}
		],
		contexts: [
			{
				slug: 'on-a-large-table',
				phrase: 'on a large table',
				summaryTail: 'Everything in this area is invisible until the table stops fitting in memory.',
				para: 'On a small table the wrong choice costs nothing, because reading everything is cheap and everything is cached. Size is what converts a modeling error into an incident, and the point at which it converts is when the working set stops fitting in memory.'
			},
			{
				slug: 'after-a-bulk-delete',
				phrase: 'after a bulk delete',
				summaryTail: 'Deleting rows does not shrink the structure that indexed them.',
				para: 'A bulk delete leaves the index the size it was, with pages that are mostly empty and still have to be read. Scans get slower after removing data, which is counterintuitive enough that people look everywhere else first. Rebuilding the index is what actually reclaims the space.'
			},
			{
				slug: 'in-a-multi-tenant-database',
				phrase: 'in a multi-tenant table',
				summaryTail: 'The tenant column belongs at the front of the index, and often is not there.',
				para: 'Every query in a multi-tenant table filters by tenant, so tenant is the column that has to lead. An index that omits it forces the tenant predicate to be applied after the fact, which means reading other tenants rows in order to discard them, and that is both slow and a boundary worth not testing.'
			},
			{
				slug: 'under-mixed-read-write',
				phrase: 'under mixed read and write traffic',
				summaryTail: 'Read tuning and write tuning point in opposite directions here.',
				para: 'With reads and writes on the same table, an index is a trade rather than an improvement. Each one added for a query is paid for by every insert and update, so the correct number is the smallest set that answers the queries that matter, not one per query.'
			},
			{
				slug: 'across-three-dialects',
				phrase: 'across three database engines',
				summaryTail: 'The same modeling decision has three different spellings and three different failure modes.',
				para: 'Supporting more than one engine means the index that is obviously right on one is unavailable or spelled differently on another. Expression indexes, included columns and filtered indexes all exist in some form on each, with different restrictions, so the portable design is the one built from ordinary columns in a deliberate order.'
			},
			{
				slug: 'after-a-version-upgrade',
				phrase: 'after a version upgrade',
				summaryTail: 'The planner changed its mind, and it was allowed to.',
				para: 'A new version can cost the same plan differently, add a plan shape that did not exist, and start or stop using an index it previously ignored. The regression is real and the cause is usually statistics rather than the planner, so refresh them before opening an argument with the release notes.'
			}
		],
		notes: [
			'Write the query first and let it tell you what to index. An index chosen before the access pattern exists is a guess, and it is a guess that costs every write until somebody audits it.',
			'Read the plan, not the duration. Two plans with the same wall clock today diverge as the table grows, and the plan is what tells you which one is about to become a problem.',
			'Count buffers as well as rows. A plan reading ten times the pages the result needs is doing something the row counts do not show, and page counts survive a warm cache better than timings do.',
			'An index is a claim about how the data will be read. Declaring a slug indexed says every page load looks a record up by it; declaring a body indexed says something nobody meant.',
			'Check the catalog before adding anything. Usage counts, sizes and duplicates are all recorded, so the question of whether an index earns its cost has an answer that does not require an opinion.',
			'Verify on a copy at production size. Every conclusion in this area is a function of volume, and a conclusion drawn on a thousand rows does not transfer to ten million.'
		]
	},
	{
		id: 'caching',
		category: 'caching',
		keyword: 'caching',
		failures: [
			{
				slug: 'stampede',
				phrase: 'A cache stampede on expiry',
				summary: 'Every caller misses at the same instant and they all recompute the same value.',
				lead: 'A popular key that expires at a fixed time sends every concurrent request to the origin together. The origin is sized for the miss rate, not for the whole read volume, so it fails, and the failure prevents the cache being refilled. A single flight lock, or an early asynchronous refresh, is what breaks the pattern.',
				keywords: 'stampede, thundering herd, expiry, single flight'
			},
			{
				slug: 'stale-after-write',
				phrase: 'A read serving the value before the write',
				summary: 'The write updated the record and something is still answering from the old copy.',
				lead: 'A write path that updates the database and forgets one cache leaves a copy that is authoritative for as long as its lifetime lasts. The bug is intermittent by construction, because it depends on which layer answers. Enumerating every cache a value passes through is the only reliable way to find the one that was missed.',
				keywords: 'invalidation, stale read, write through, consistency'
			},
			{
				slug: 'unbounded-cache',
				phrase: 'A cache with no size limit',
				summary: 'A cache without eviction is a memory leak with a good name.',
				lead: 'An in-process map that stores whatever it is asked to store grows until the process is killed. It looks like a cache and behaves like a leak, and the hit rate usually looks excellent right up to the restart. A bounded size with an eviction policy is what makes it a cache.',
				keywords: 'eviction, lru, memory leak, bounded'
			},
			{
				slug: 'cache-key-collision',
				phrase: 'Two requests sharing one cache key',
				summary: 'A key that omits a parameter serves one caller the other caller answer.',
				lead: 'Any input that changes the response has to appear in the key. Omitting the tenant, the locale or the permission scope produces a key that is correct for one caller and wrong for the next, and the wrongness is a data disclosure rather than a performance problem. Build the key from the whole input, deliberately.',
				keywords: 'cache key, tenant, isolation, disclosure'
			},
			{
				slug: 'negative-caching-missing',
				phrase: 'A miss that is never cached',
				summary: 'Not-found answers are recomputed every time, so absence is the most expensive result.',
				lead: 'When only successful lookups are cached, every request for something that does not exist reaches the origin. A crawler or a broken client asking for absent keys then applies full load with a perfect miss rate. Caching the negative result briefly costs almost nothing and removes the whole class of traffic.',
				keywords: 'negative caching, not found, miss, crawler'
			},
			{
				slug: 'vary-mishandled',
				phrase: 'A shared cache ignoring the request that varies',
				summary: 'One cached response is served to callers who sent different headers.',
				lead: 'A response that depends on a header must declare it, or a shared cache is entitled to reuse the response for a request that sent something different. Compression, language and authorization are the usual three. The result is a response that is correct for the first caller and mystifying for everyone after.',
				keywords: 'vary, shared cache, cdn, headers'
			},
			{
				slug: 'ttl-too-long',
				phrase: 'A lifetime chosen for the hit rate',
				summary: 'The lifetime was tuned to improve the graph, and the correctness budget was never stated.',
				lead: 'Extending a lifetime improves hit rate monotonically, so an unconstrained optimization always makes it longer. The cost is staleness, which is invisible in cache metrics and visible to users. The number worth writing down is how stale the value is allowed to be, and the lifetime follows from it.',
				keywords: 'ttl, staleness, hit rate, tradeoff'
			},
			{
				slug: 'cache-as-source-of-truth',
				phrase: 'A cache treated as the source of truth',
				summary: 'Something writes only to the cache, so the value cannot survive an eviction.',
				lead: 'Once a write lands in the cache and nowhere else, an eviction is data loss and a restart is worse. This happens gradually: a field is added to the cached object for convenience and never added to the store. The test is whether flushing the cache is safe, and it should always be safe.',
				keywords: 'source of truth, durability, flush, write path'
			},
			{
				slug: 'warm-process-hides-break',
				phrase: 'A warm process hiding a broken dependency',
				summary: 'The instance that never restarted is the only one that still works.',
				lead: 'A process holding a cached artifact keeps serving after the source of that artifact has become unusable. The fleet looks healthy while the next restart is guaranteed to fail, and the instance that proves the problem is the one that was recycled. Any conclusion drawn from a long-running process needs a cold start to confirm it.',
				keywords: 'warm cache, cold start, dependency, restart'
			},
			{
				slug: 'per-instance-divergence',
				phrase: 'Per-instance caches answering differently',
				summary: 'Each instance has its own copy, so the answer depends on which one you reach.',
				lead: 'With a cache inside each process, invalidation has to reach all of them, and a request routed to a different instance sees a different version. The user experience is a value that changes when the page is reloaded. Either move the cache behind a shared store or make the lifetime short enough that divergence does not matter.',
				keywords: 'coherence, fan out, invalidation, sticky'
			}
		],
		contexts: [
			{
				slug: 'behind-a-cdn',
				phrase: 'behind a CDN',
				summaryTail: 'With a CDN in front there are at least three caches, and they expire independently.',
				para: 'A CDN adds a cache you do not control and cannot easily inspect, with its own lifetime and its own idea of what varies. Purges are eventually consistent, so a fix deployed and verified locally can still be wrong for someone on another edge for minutes afterwards.'
			},
			{
				slug: 'in-a-multi-tenant-service',
				phrase: 'in a multi-tenant service',
				summaryTail: 'A shared cache in a multi-tenant service is a boundary, whether it was designed as one or not.',
				para: 'In a multi-tenant service the cache key carries the isolation. Any key that can be constructed without the tenant is a path by which one tenant reads another tenant data, and it will not show up in a functional test because both callers get plausible answers.'
			},
			{
				slug: 'during-a-deploy',
				phrase: 'during a deploy',
				summaryTail: 'A deploy empties in-process caches and changes the shape of what is cached.',
				para: 'A deploy discards every in-process cache at once, so the origin sees the full read volume with no hits at all for the first seconds. If the cached shape also changed, old and new entries coexist and the code has to tolerate both, which is why cached values need a version in the key.'
			},
			{
				slug: 'under-a-traffic-spike',
				phrase: 'under a traffic spike',
				summaryTail: 'A spike is where the cache either absorbs the load or amplifies it.',
				para: 'A spike changes the ratio between hits and misses, and a cache that helps at steady state can hurt during one, because concurrent misses on the same key multiply the work rather than sharing it. Behavior under a spike is the only interesting question about a cache.'
			},
			{
				slug: 'with-an-external-store',
				phrase: 'with an external cache store',
				summaryTail: 'Moving the cache out of process adds a dependency that can be slow as well as absent.',
				para: 'An external store makes the cache coherent and adds a network hop that can time out. A lookup that fails has to fall through to the origin rather than fail the request, and the timeout for that lookup has to be much shorter than the work it was avoiding, or the cache becomes the slowest path.'
			},
			{
				slug: 'for-authenticated-responses',
				phrase: 'for authenticated responses',
				summaryTail: 'Anything cached for a signed-in user is one key mistake from being everyone response.',
				para: 'Caching authenticated responses means the identity is part of the key and part of the correctness argument. The safe default is not to cache them at all, and to cache the expensive pieces that are genuinely shared instead, keyed by what they actually depend on.'
			}
		],
		notes: [
			'State the staleness budget before choosing a lifetime. Every other decision follows from how out of date the value is allowed to be, and without that number the lifetime is chosen to make a graph look better.',
			'Make flushing safe and then flush often in development. A cache you are afraid to clear has become part of the data model, and the fear is the signal.',
			'Cache the expensive thing, not the whole response. A response contains cheap parts and one costly part, and caching the costly part alone keeps the key simple and the correctness argument short.',
			'Instrument misses by key shape. An aggregate hit rate hides one key with a terrible ratio, and that one key is usually the entire cost.',
			'Include a version in the key. Changing the cached shape then costs nothing, because old entries become unreachable rather than misinterpreted.',
			'Verify with a cold process. A conclusion from a warm instance is a statement about that instance, and the fleet is made of instances that have all restarted recently.'
		]
	},
	{
		id: 'queues',
		category: 'queues-and-jobs',
		keyword: 'queues',
		failures: [
			{
				slug: 'poison-message',
				phrase: 'A poison message blocking the queue',
				summary: 'One message that always fails is retried forever and nothing behind it is processed.',
				lead: 'A strictly ordered consumer that retries on failure stops at the first message it cannot handle. Throughput goes to zero while the queue depth climbs, and the log fills with the same error at the retry interval. A dead letter destination after a bounded number of attempts is what keeps one bad message from being an outage.',
				keywords: 'poison message, dead letter, retry, ordering'
			},
			{
				slug: 'at-least-once-duplicate',
				phrase: 'Duplicate side effects from at-least-once delivery',
				summary: 'The message was delivered twice and the handler was not written for it.',
				lead: 'At-least-once delivery is the normal guarantee, so a handler will see the same message again after a timeout, a rebalance or a redeploy. Anything that charges, sends or increments has to be keyed on something stable so the second execution is a no-op. Without that key, correctness depends on a delivery guarantee nobody offers.',
				keywords: 'idempotency, at least once, duplicate, dedupe'
			},
			{
				slug: 'visibility-timeout-too-short',
				phrase: 'A job redelivered while it is still running',
				summary: 'The handler takes longer than the visibility timeout, so the queue hands the job to a second worker.',
				lead: 'The queue treats an unacknowledged message as lost after a fixed interval. A handler that occasionally exceeds it gets a second worker on the same job, and the two of them race. The symptom is duplicate work only on the slowest cases, which makes it look like a data problem rather than a timeout.',
				keywords: 'visibility timeout, redelivery, ack, race'
			},
			{
				slug: 'unbounded-retry',
				phrase: 'Retries with no ceiling',
				summary: 'Retrying a permanent failure forever spends capacity on work that cannot succeed.',
				lead: 'A failure that will never succeed does not become successful with more attempts. Unbounded retries consume the same worker slots as real work and grow the queue while looking busy. The distinction the handler must make is between a retryable failure and a rejected one, and only the first should be tried again.',
				keywords: 'retry, backoff, permanent failure, capacity'
			},
			{
				slug: 'no-backoff',
				phrase: 'Immediate retries amplifying an outage',
				summary: 'Retrying without delay turns a dependency blip into sustained load on the thing that is failing.',
				lead: 'A retry loop with no delay sends the maximum possible request rate at a dependency that is already struggling, and prevents it recovering. Exponential delay with jitter keeps the work while removing the amplification. The jitter matters as much as the exponent, because synchronized retries are their own spike.',
				keywords: 'backoff, jitter, retry storm, amplification'
			},
			{
				slug: 'ordering-assumed',
				phrase: 'Handlers that assume ordering',
				summary: 'Two messages about the same entity arrive out of order and the later state is overwritten.',
				lead: 'Ordering is guaranteed only inside a partition, and only if nothing retries. A handler that applies whatever it receives will happily apply an old state after a new one, and the record ends up correct or not depending on timing. Carrying a version or a timestamp in the message and refusing to go backwards is what makes it deterministic.',
				keywords: 'ordering, partition, version, out of order'
			},
			{
				slug: 'lag-invisible',
				phrase: 'Consumer lag nobody is watching',
				summary: 'The consumer is healthy, the producer is healthy, and the gap between them is growing.',
				lead: 'Process health says nothing about whether a consumer is keeping up. Lag is the only metric that does, and it is the one most often missing, so the first sign of a problem is a downstream complaint about data that is hours old. Lag and its rate of change belong on the same graph.',
				keywords: 'consumer lag, backlog, monitoring, throughput'
			},
			{
				slug: 'large-payload',
				phrase: 'A message carrying its whole payload',
				summary: 'Putting the document in the message makes every hop pay for it and eventually exceeds the size limit.',
				lead: 'A queue is good at small messages and bad at large ones. Embedding a document means the broker stores it, every retry re-sends it, and one day a slightly larger document is rejected outright. Sending an identifier and letting the handler fetch the current version is both smaller and fresher.',
				keywords: 'payload size, claim check, broker, limits'
			},
			{
				slug: 'work-lost-on-shutdown',
				phrase: 'Work lost on shutdown',
				summary: 'The process exits while a handler is mid-flight and the message is neither done nor returned.',
				lead: 'A worker that exits without draining leaves messages in an ambiguous state, and whether they are reprocessed depends on the acknowledgment mode. Handling the termination signal, stopping the fetch, finishing what is in flight and then exiting is a small amount of code that removes an entire class of incident during every deploy.',
				keywords: 'graceful shutdown, sigterm, drain, in flight'
			},
			{
				slug: 'fanout-self-trigger',
				phrase: 'A handler that triggers itself',
				summary: 'The side effect of the job produces the event that schedules the job.',
				lead: 'A handler that writes to the same store that publishes the events it consumes closes a loop. It runs, it writes, the write emits an event, and it runs again, at whatever rate the infrastructure allows. Filtering the event by its source, or excluding the handler own writes, is the only thing standing between this and an unbounded spend.',
				keywords: 'event loop, fan out, recursion, filter'
			}
		],
		contexts: [
			{
				slug: 'under-a-backlog',
				phrase: 'under a backlog',
				summaryTail: 'A backlog changes the behavior of the consumer, not just its schedule.',
				para: 'With a backlog, the consumer runs at maximum rate against every downstream dependency at once, which is a load profile it never sees at steady state. Draining a backlog frequently causes a second incident downstream, so the drain rate needs a limit of its own.'
			},
			{
				slug: 'during-a-deploy',
				phrase: 'during a deploy',
				summaryTail: 'A deploy stops consumers mid-message and starts new ones with different code.',
				para: 'During a deploy, messages produced by the new version are consumed by the old one and the other way round. Both directions have to be tolerable for the length of the rollout, which means a message format change is two deploys: accept the new field, then start sending it.'
			},
			{
				slug: 'with-multiple-consumers',
				phrase: 'with several consumers on one topic',
				summaryTail: 'More consumers is the fix for throughput and the cause of everything else here.',
				para: 'Adding consumers removes the throughput constraint and removes the ordering that came with a single one. Each consumer sees a subset, rebalances move partitions between them, and a message can be delivered again after a rebalance, so anything that was accidentally safe with one worker has to be made explicitly safe.'
			},
			{
				slug: 'in-a-multi-tenant-service',
				phrase: 'in a multi-tenant service',
				summaryTail: 'A shared queue lets one tenant work delay every other tenant work.',
				para: 'A single queue for every tenant means the largest tenant sets the wait time for the smallest. A per-tenant fairness rule, or a separate queue for bulk work, is what stops one import from delaying every interactive job in the system.'
			},
			{
				slug: 'against-a-third-party-api',
				phrase: 'against a third-party API',
				summaryTail: 'The dependency has its own limits, and it will not raise them for your backlog.',
				para: 'A dependency you do not own has a rate limit, a timeout and its own bad days. The worker has to treat a refusal as information rather than as an error to retry immediately, and its concurrency has to be bounded by the dependency allowance rather than by the number of workers available.'
			},
			{
				slug: 'with-scheduled-jobs',
				phrase: 'with scheduled jobs',
				summaryTail: 'A schedule concentrates load on the hour, and every instance has the same clock.',
				para: 'Scheduled work arrives simultaneously across the fleet, so a job that is trivial individually is a spike collectively. Spreading the start over the interval, and making the schedule owned by one instance rather than all of them, converts a periodic incident into a background cost.'
			}
		],
		notes: [
			'Make every handler idempotent and stop reasoning about delivery guarantees. It is a smaller amount of work than the analysis it replaces, and it holds under retries, rebalances and redeployments without further thought.',
			'Distinguish retryable from rejected at the point of failure. The handler is the only place with enough context to tell a temporary outage from an invalid message, and the queue cannot infer it.',
			'Graph lag, not health. A consumer can be perfectly healthy and hours behind, and only one of those two facts is worth waking someone up for.',
			'Bound everything: attempts, concurrency, payload size and runtime. Each bound turns an unbounded failure into a visible one, and a visible failure is a dead letter you can read.',
			'Put the identifier in the message and the data in the store. The handler then works on the current version rather than the version at publish time, which removes a whole category of stale-write bug.',
			'Test the shutdown path. It runs on every deploy, several times a day, and it is the least exercised code in most workers.'
		]
	},
	{
		id: 'tls',
		category: 'tls-and-certificates',
		keyword: 'tls',
		failures: [
			{
				slug: 'expired-certificate',
				phrase: 'An expired certificate',
				summary: 'Renewal was automated, the reload was not, and the served certificate is the old one.',
				lead: 'Automatic renewal writes a new file. Something still has to make the process use it, and a server that reads the certificate once at startup keeps presenting the expired one until it is restarted. The renewal logs look perfect, which is why this failure is usually discovered by a user.',
				keywords: 'expiry, renewal, reload, acme'
			},
			{
				slug: 'incomplete-chain',
				phrase: 'An incomplete certificate chain',
				summary: 'The leaf is served without its intermediate, so validation depends on what the client already has.',
				lead: 'A server must send the intermediates needed to link its leaf to a trusted root. Omitting them works in browsers that cache intermediates and fails in the clients that do not, which is every command line tool and most language runtimes. The bug reproduces on some machines and not others, and the difference is a cache.',
				keywords: 'chain, intermediate, trust store, validation'
			},
			{
				slug: 'hostname-mismatch',
				phrase: 'A hostname the certificate does not cover',
				summary: 'The name in the request is not in the subject alternative names.',
				lead: 'Validation is against the alternative names, and the common name has been ignored for years. A certificate issued for the apex does not cover a subdomain, and a wildcard covers exactly one label. The error text names both the requested host and the presented names, which is enough to settle it.',
				keywords: 'san, hostname, wildcard, mismatch'
			},
			{
				slug: 'sni-missing',
				phrase: 'A client that sends no server name',
				summary: 'Without a server name the server has to guess which certificate to present, and it guesses the default.',
				lead: 'A host serving several names selects the certificate from the name in the handshake. A client that omits it, which happens with older libraries and with direct connections by address, gets the default certificate and a mismatch. The fix is on the client, but the diagnosis has to come from the server logs.',
				keywords: 'sni, handshake, virtual host, default certificate'
			},
			{
				slug: 'clock-skew',
				phrase: 'A handshake refused for clock skew',
				summary: 'The certificate is valid and one of the two machines disagrees about the time.',
				lead: 'Validity is a pair of timestamps checked against the local clock. A machine minutes ahead rejects a freshly issued certificate as not yet valid, and one behind accepts an expired one. Container hosts and virtual machines resumed from a snapshot are the usual sources, and the error names a time that is the clue.',
				keywords: 'clock skew, ntp, not yet valid, validity'
			},
			{
				slug: 'client-cert-not-sent',
				phrase: 'A client certificate that is never sent',
				summary: 'Mutual authentication is configured on the server and the client is not offering anything.',
				lead: 'Mutual TLS requires the client to have a certificate, a key and a reason to send them. A client library that has the files but no configuration pointing at them completes the handshake without offering one, and the server refuses with an error about the client rather than about the configuration. Verifying with a command line client first separates the two.',
				keywords: 'mtls, client certificate, mutual auth, key'
			},
			{
				slug: 'protocol-floor-raised',
				phrase: 'An old client cut off by a protocol floor',
				summary: 'Disabling an outdated protocol version removed the only version some clients speak.',
				lead: 'Raising the minimum version is correct and it is a breaking change for anything that has not been updated. The failure is at the handshake, before any request, so there is no application log entry and no status code. Handshake failures by version, recorded before the change, are what make the decision measurable rather than hopeful.',
				keywords: 'tls version, deprecation, handshake failure, compatibility'
			},
			{
				slug: 'key-permissions',
				phrase: 'A private key the server cannot read',
				summary: 'The file is present and the process does not have permission to open it.',
				lead: 'A key readable only by root and a server that drops privileges do not combine. The process starts, fails to load the key and either exits or falls back to serving without TLS, and which of those happens depends on the server. Deployment tooling that copies files as one user for a process running as another is the common cause.',
				keywords: 'permissions, private key, ownership, startup'
			},
			{
				slug: 'ocsp-stapling-stale',
				phrase: 'A stale revocation response',
				summary: 'The stapled response has expired and strict clients treat that as a failure.',
				lead: 'A server can staple a signed statement that its certificate is not revoked, and that statement has its own short lifetime. A server that fetches it once, or that cannot reach the responder, staples something out of date, and a client configured to require a fresh response refuses the connection. Most clients are lenient, which is why this is discovered by the strictest one.',
				keywords: 'ocsp, stapling, revocation, freshness'
			},
			{
				slug: 'proxy-terminates-tls',
				phrase: 'A proxy that terminates and forgets to say so',
				summary: 'The application believes the request arrived in plain text and starts redirecting.',
				lead: 'When a proxy terminates TLS, the connection it makes to the application is not encrypted, and the application has to be told the original scheme by a header. Without it, a redirect to the secure version produces a loop, because each request looks insecure again. Trusting that header requires knowing the proxy is the only source of it.',
				keywords: 'termination, forwarded proto, redirect loop, proxy'
			}
		],
		contexts: [
			{
				slug: 'behind-a-load-balancer',
				phrase: 'behind a load balancer',
				summaryTail: 'There are two handshakes, and the one you can see is not the one that failed.',
				para: 'With a load balancer in front there are two TLS connections with independent configuration, certificates and versions. A client-facing fix has no effect on the internal hop, and a failure on the internal hop is reported to the user as a generic gateway error with nothing in it.'
			},
			{
				slug: 'in-a-container-image',
				phrase: 'in a container image',
				summaryTail: 'The trust store is part of the image, and a minimal image may not have one.',
				para: 'A container carries its own trust store, and a minimal base image may carry none at all. Verification then fails for every host, which looks like a network problem and is a missing package. The certificates a build machine trusts are not the certificates the container trusts.'
			},
			{
				slug: 'during-a-rotation',
				phrase: 'during a certificate rotation',
				summaryTail: 'Rotation is the window where old and new must both be acceptable.',
				para: 'A rotation has an overlap during which some parties hold the old material and some the new. Anything that pins a single certificate, or that reloads at a different moment from its peers, breaks inside that window. Accepting both for the length of the overlap is the only ordering that does not drop traffic.'
			},
			{
				slug: 'for-an-internal-service',
				phrase: 'for an internal service',
				summaryTail: 'Internal traffic gets a private authority, and half the tooling does not know about it.',
				para: 'Internal services are usually issued by a private authority, so every client needs that authority added deliberately. Language runtimes, command line tools and sidecars each have their own way of being told, and finding the one that was missed is most of the work.'
			},
			{
				slug: 'from-a-mobile-client',
				phrase: 'from a mobile client',
				summaryTail: 'The client is a version of the app you shipped a year ago and cannot change.',
				para: 'A mobile client cannot be updated on your schedule. Whatever it trusted and whichever protocol versions it spoke when it shipped are the constraints, possibly for years, and a pinned certificate in a released app makes rotation a release rather than an operation.'
			},
			{
				slug: 'in-a-staging-environment',
				phrase: 'in a staging environment',
				summaryTail: 'Staging is where the certificate is different, and where the difference gets normalized.',
				para: 'Staging often runs with a self-signed certificate and a client configured to skip verification, and that configuration has a way of reaching production. A staging environment with a real certificate from a real authority is worth the trouble precisely because it removes the temptation.'
			}
		],
		notes: [
			'Read the handshake with a command line client before reading any code. It prints the presented chain, the negotiated version and the verification result, and it is the same view every other client has.',
			'Check the served certificate, not the file on disk. The interesting question is what the process is presenting on the port, and a reload that did not happen is the most common reason the two differ.',
			'Automate renewal and the reload together. Renewal alone converts an annual outage into a monthly one, and the reload is the half that is usually left as a manual step.',
			'Alert on remaining validity, with enough margin to act. A week is not enough for anything that needs a change request, and the alert has to fire on the certificate being served rather than the one that was issued.',
			'Send the intermediates. It costs a few hundred bytes and removes an entire class of report that only reproduces on other people machines.',
			'Never disable verification to get past this. It is the one shortcut in this area that turns a broken connection into a silently insecure one, and it always outlives the debugging session.'
		]
	},
	{
		id: 'dns',
		category: 'dns-and-discovery',
		keyword: 'dns',
		failures: [
			{
				slug: 'cached-record',
				phrase: 'A cached record pointing at the old host',
				summary: 'The record was changed and something is still resolving the previous answer.',
				lead: 'A resolver keeps an answer for the lifetime the record declared, and so does every resolver between it and the client. Traffic continues to the old address for that long, and a runtime that caches indefinitely continues after that. The change is correct at the authority and irrelevant to the process that already resolved.',
				keywords: 'ttl, cache, propagation, resolver'
			},
			{
				slug: 'jvm-style-forever-cache',
				phrase: 'A runtime that caches a lookup forever',
				summary: 'The process resolved the name once at startup and will never look again.',
				lead: 'Some runtimes cache a successful resolution for the process lifetime by default. Every subsequent connection goes to an address that may have been reassigned, and no amount of lowering the record lifetime helps. This is why long-lived clients need a bounded connection lifetime as well as a bounded cache.',
				keywords: 'resolver cache, process lifetime, restart, address'
			},
			{
				slug: 'search-domain-suffix',
				phrase: 'A short name resolving somewhere unexpected',
				summary: 'A name without a trailing dot is tried against every search domain in order.',
				lead: 'An unqualified name is expanded with each configured search domain until one answers. Inside a cluster that produces several failed lookups before the right one, and occasionally an answer from the wrong namespace that happens to exist. Fully qualifying the name removes both the latency and the ambiguity.',
				keywords: 'search domain, ndots, fqdn, resolv.conf'
			},
			{
				slug: 'negative-cache',
				phrase: 'A negative answer cached after the record was created',
				summary: 'The failed lookup was cached, so creating the record does not fix it immediately.',
				lead: 'A resolver caches the absence of a record as well as its presence, for a lifetime the zone declares. Creating the record does not clear that memory, so a client that asked too early keeps failing after the problem is fixed. Knowing the negative lifetime is what tells you how long to wait before concluding the fix did not work.',
				keywords: 'negative caching, nxdomain, soa, minimum ttl'
			},
			{
				slug: 'ipv6-first',
				phrase: 'A connection attempt to an unreachable address family',
				summary: 'The name resolves to both families, the client prefers one, and that one has no route.',
				lead: 'A name with records for both address families gives the client a choice, and the default preference is not always the one that works. Where the preferred family has no route, every connection waits for a timeout before falling back, so requests succeed and take seconds. The fix is either a route or an explicit preference, not a change to the name.',
				keywords: 'ipv6, dual stack, happy eyeballs, timeout'
			},
			{
				slug: 'resolver-single-point',
				phrase: 'One resolver for the whole fleet',
				summary: 'Every lookup goes through one component, and it is now a dependency of everything.',
				lead: 'A single resolver, or a single cluster service, is on the path of every outbound connection in the system. When it degrades, every service reports a different symptom, and the shared cause is invisible unless resolution latency is measured somewhere. It deserves the redundancy of a database and rarely gets it.',
				keywords: 'resolver, single point of failure, latency, coredns'
			},
			{
				slug: 'srv-record-ignored',
				phrase: 'A client ignoring the port in a service record',
				summary: 'The record carries a host and a port, and the client used its own default port.',
				lead: 'Service records exist to publish both the host and the port, and a client that resolves only the host connects to whatever port it was configured with. It works while the two agree and breaks silently the first time the service moves. Either use a library that reads the record properly or stop publishing one.',
				keywords: 'srv, service discovery, port, client library'
			},
			{
				slug: 'wildcard-shadowing',
				phrase: 'A wildcard record answering for a name that should not exist',
				summary: 'A wildcard in the zone means no name under it can ever be absent.',
				lead: 'A wildcard answers for every name that has no more specific record, so a typo resolves, a decommissioned host resolves, and a health check against a name that should be gone succeeds. The absence you were relying on to detect a mistake cannot happen while the wildcard is there.',
				keywords: 'wildcard, zone, shadowing, typo'
			},
			{
				slug: 'reverse-lookup-timeout',
				phrase: 'A reverse lookup on the request path',
				summary: 'Something is resolving the client address, and the resolution is timing out.',
				lead: 'Logging, authentication and access rules sometimes resolve the client address to a name. When the reverse zone is missing or unreachable, each request waits for the lookup to time out, and the delay is a fixed several seconds that looks like the application being slow. Turning the lookup off is usually the whole fix.',
				keywords: 'reverse dns, ptr, timeout, logging'
			},
			{
				slug: 'stale-service-endpoints',
				phrase: 'Endpoints that outlive the pods behind them',
				summary: 'Discovery is still advertising an instance that has gone away.',
				lead: 'Service discovery is eventually consistent, so for a short window after an instance terminates its address is still handed out. Connections to it are refused or, worse, time out. Retrying on a different address and removing the instance from rotation before it stops accepting are what shorten the window to something invisible.',
				keywords: 'endpoints, readiness, deregistration, draining'
			}
		],
		contexts: [
			{
				slug: 'in-a-kubernetes-cluster',
				phrase: 'in a Kubernetes cluster',
				summaryTail: 'Cluster resolution has its own rules, and they surprise people who know DNS.',
				para: 'Cluster resolution adds search domains, a dots threshold and a cluster service in the path. A name that resolves from a laptop can take several queries inside a pod, and the extra queries all go through one component whose latency belongs on a dashboard.'
			},
			{
				slug: 'during-a-migration',
				phrase: 'during a migration',
				summaryTail: 'A migration is the plan that depends on a record change taking effect.',
				para: 'Cutting over by changing a record means the cutover takes as long as the longest cache in the path, and there is no way to make it atomic. A plan that requires both sides to work during that window is a plan; a plan that switches at an instant is a hope.'
			},
			{
				slug: 'from-a-long-lived-process',
				phrase: 'from a long-lived process',
				summaryTail: 'A process that has been up for weeks is the one holding the oldest answer.',
				para: 'A long-lived process is where stale resolution lives. It resolved once, possibly at startup, possibly before the change, and nothing in its normal operation will make it reconsider. Bounded connection lifetimes are what force a fresh lookup without a restart.'
			},
			{
				slug: 'across-two-regions',
				phrase: 'across two regions',
				summaryTail: 'The same name answers differently depending on where the question was asked.',
				para: 'With region-aware answers the same name resolves differently by location, which is the point and also the reason a test from one region proves nothing about another. Reproducing a resolution problem requires asking from the place that has it.'
			},
			{
				slug: 'behind-a-corporate-resolver',
				phrase: 'behind a corporate resolver',
				summaryTail: 'The resolver in the middle has opinions, and some of them are rewrites.',
				para: 'A corporate or captive resolver may rewrite answers, block record types or return an address for a name that does not exist. Comparing the answer from the local resolver with the answer from the authority is the fastest way to find out which of those is happening.'
			},
			{
				slug: 'for-a-third-party-endpoint',
				phrase: 'for a third-party endpoint',
				summaryTail: 'The record belongs to someone else, and they can change it without telling you.',
				para: 'A dependency name is under someone else control, and its addresses, families and lifetimes can change at any time. Pinning an address for a third party endpoint is convenient for exactly as long as it takes them to move it.'
			}
		],
		notes: [
			'Query the authority and the local resolver separately. When the two answers differ, the problem is a cache or a rewrite in between, and that single comparison eliminates most of the possibilities.',
			'Fully qualify names in configuration. The trailing dot removes the search list, saves the failed lookups and makes the name mean the same thing from every machine.',
			'Lower the lifetime before the change, not during it. A short lifetime is only useful if it was already in effect when the old answer was cached.',
			'Measure resolution latency as its own metric. It is on the path of every outbound call, it fails in ways that look like the application, and almost nobody graphs it.',
			'Bound connection lifetime as well as cache lifetime. It is the only thing that makes a long-lived process notice that an address has changed.',
			'Write down the negative lifetime for the zone. It is the number that tells you how long a fix takes to be observable, and it is the reason a correct fix looks like it did nothing.'
		]
	},
	{
		id: 'observability',
		category: 'observability',
		keyword: 'observability',
		failures: [
			{
				slug: 'averages-hide-tails',
				phrase: 'An average that hides the tail',
				summary: 'The mean is flat while the slowest requests get much slower.',
				lead: 'A mean is dominated by the many fast requests, so a small fraction becoming much slower barely moves it. Users experience the tail, and the tail is where retries, timeouts and abandonment come from. A high percentile and a maximum tell the story that an average is arithmetically unable to tell.',
				keywords: 'average, percentile, tail latency, distribution'
			},
			{
				slug: 'percentile-of-percentiles',
				phrase: 'A percentile computed from percentiles',
				summary: 'Averaging one instance quantile with another produces a number that is not a quantile of anything.',
				lead: 'A quantile cannot be averaged. Taking the ninety-ninth percentile from each instance and computing the mean gives a value that is neither the fleet figure nor a bound on it, and it is usually optimistic. Correct aggregation needs histogram buckets summed before the quantile is estimated.',
				keywords: 'aggregation, histogram, quantile, buckets'
			},
			{
				slug: 'cardinality-explosion',
				phrase: 'A label with unbounded values',
				summary: 'A user identifier in a label multiplies the series count until the metrics store gives up.',
				lead: 'Every distinct combination of label values is a separate time series. Putting an identifier, a path with parameters or an error message into a label makes the series count grow with traffic, and the collector fails or starts dropping. The rule is that a label value has to come from a small fixed set.',
				keywords: 'cardinality, labels, series, metrics store'
			},
			{
				slug: 'log-without-context',
				phrase: 'A log line with no request identity',
				summary: 'The error is recorded and nothing connects it to the request that caused it.',
				lead: 'A message without a correlation identifier cannot be joined to anything: not to the request, not to the user, not to the other twelve lines the same request produced. Adding the identifier at the boundary and carrying it through the context is the difference between logs you can query and logs you can only read.',
				keywords: 'correlation id, request id, structured logging, context'
			},
			{
				slug: 'sampled-away',
				phrase: 'The trace for the failure that was sampled out',
				summary: 'Head sampling made the decision before anything went wrong.',
				lead: 'A fixed sampling rate decided at the start of the request keeps a representative set of normal traces and discards the interesting ones. The failures you most want are rare, which is exactly why they are not sampled. Keeping every error and every slow request, and sampling only the fast successes, costs little and changes what the data is for.',
				keywords: 'sampling, tracing, tail sampling, retention'
			},
			{
				slug: 'clock-based-duration',
				phrase: 'A duration measured with the wall clock',
				summary: 'A clock adjustment during the request produces a negative or absurd duration.',
				lead: 'The wall clock can move backwards. A duration computed by subtracting two wall clock readings is wrong whenever an adjustment lands in between, which shows up as negative latencies and impossible outliers. A monotonic clock exists for this and is what every timing measurement should use.',
				keywords: 'monotonic clock, duration, ntp, outlier'
			},
			{
				slug: 'health-check-lies',
				phrase: 'A health check that reports the process, not the service',
				summary: 'The probe answers from the framework and never touches anything the request path needs.',
				lead: 'A liveness endpoint that returns a constant proves the process is running. It says nothing about whether the database is reachable or the migrations have run, so an instance can be perfectly healthy and unable to serve. A readiness check has to exercise the dependencies the request path actually uses.',
				keywords: 'health check, readiness, liveness, probe'
			},
			{
				slug: 'alert-on-symptom-absent',
				phrase: 'An alert on a cause rather than a symptom',
				summary: 'Alerts fire for conditions that are survivable and stay silent for the outage.',
				lead: 'Alerting on CPU, memory or queue depth produces pages for states the system handles fine, and misses the failure that does not happen to move any of them. Alerting on the symptom users experience, with the causes as diagnostic dashboards, changes both the volume and the usefulness of the pages.',
				keywords: 'alerting, symptom, slo, paging'
			},
			{
				slug: 'metrics-only-on-success',
				phrase: 'A counter that only increments on success',
				summary: 'The failure path returns early and never records anything.',
				lead: 'When the counter is at the end of the happy path, failures are invisible: the success rate stays at one hundred percent because the denominator is only the successes. Recording the outcome in a deferred block, with the outcome as a label, is what makes the ratio mean something.',
				keywords: 'error rate, instrumentation, defer, denominator'
			},
			{
				slug: 'dashboard-different-window',
				phrase: 'Two graphs that disagree because of their window',
				summary: 'One panel averages over five minutes and the other over one, and a spike appears in only one.',
				lead: 'A rate over a long window flattens a short spike until it is invisible, while the same data over a short window shows it clearly. Two panels on the same dashboard with different windows produce arguments about which one is broken. Neither is; the resolution is the whole difference.',
				keywords: 'rate window, resolution, smoothing, dashboard'
			}
		],
		contexts: [
			{
				slug: 'during-an-incident',
				phrase: 'during an incident',
				summaryTail: 'An incident is when you find out what you did not instrument.',
				para: 'During an incident there is no time to add instrumentation, so the investigation is bounded by what was already recorded. That is the argument for instrumenting the boundaries before anything goes wrong, because the questions asked at three in the morning are the obvious ones.'
			},
			{
				slug: 'across-many-instances',
				phrase: 'across many instances',
				summaryTail: 'Fleet-wide numbers hide the one instance that is broken.',
				para: 'Aggregated across a fleet, one bad instance is diluted by the healthy ones until it disappears. A per-instance view, or an alert on the worst rather than the mean, is what surfaces the single node with a full disk or a cold cache.'
			},
			{
				slug: 'in-a-multi-tenant-service',
				phrase: 'in a multi-tenant service',
				summaryTail: 'Aggregate health can be fine while one tenant is completely broken.',
				para: 'A multi-tenant service has a tenant dimension in every number that matters, and adding it to a metric label is exactly the cardinality decision that has to be made deliberately. Per-tenant views usually belong in logs or traces, with metrics kept to a bounded tier or plan label.'
			},
			{
				slug: 'behind-a-proxy',
				phrase: 'behind a proxy',
				summaryTail: 'The proxy and the application measure two different durations.',
				para: 'A proxy measures from when it received the request; the application measures from when it started handling it. The gap between the two is queueing, and it is invisible in both graphs individually. Comparing them is how you find out that the application is fast and the service is slow.'
			},
			{
				slug: 'with-asynchronous-work',
				phrase: 'with asynchronous work',
				summaryTail: 'The request finished and the work it scheduled has not.',
				para: 'When a request enqueues work, the response time stops being the thing users care about. The number that matters spans the request and the job, which means the correlation identifier has to travel through the queue, and almost no default instrumentation does that.'
			},
			{
				slug: 'after-a-deploy',
				phrase: 'after a deploy',
				summaryTail: 'A deploy is the most common cause and the hardest thing to see in a graph.',
				para: 'After a deploy, metric names can change, cardinality can jump and cold caches make everything slower for a few minutes. Annotating deploys on the dashboards is a one-line change that answers the first question of most investigations.'
			}
		],
		notes: [
			'Instrument the boundary, not the internals. Every call in and every call out, with duration, outcome and size, answers most questions, and internal counters answer few.',
			'Record the outcome in a deferred block so the failure path cannot skip it. A metric that only the success path reaches will always report success.',
			'Keep histograms, not averages. A histogram can be aggregated correctly across instances and can answer a question about a percentile you had not thought of yet.',
			'Alert on what the user experiences and dashboard the causes. It reduces the number of pages and increases the fraction of pages that mean something.',
			'Carry the correlation identifier everywhere, including through queues and into logs. It is the join key for the entire investigation.',
			'Look at the number of series before adding a label. The cost of a label is multiplicative, and the moment it goes wrong is the moment the metrics stop working, which is during the incident.'
		]
	},
	{
		id: 'deploys',
		category: 'releases-and-rollbacks',
		keyword: 'deploys',
		failures: [
			{
				slug: 'irreversible-migration',
				phrase: 'A migration that cannot be rolled back',
				summary: 'The code can be reverted and the schema change cannot, so rollback is not available.',
				lead: 'Dropping a column or rewriting data in the same release as the code that needs it means the release has no reverse. Once it is out, the only way forward is forward, at whatever hour the problem appears. Splitting the change so every deploy is compatible with the one before it is what keeps rollback as an option.',
				keywords: 'migration, rollback, expand contract, schema'
			},
			{
				slug: 'two-versions-one-schema',
				phrase: 'Two versions disagreeing about the schema',
				summary: 'During the rollout both versions are live and only one of them knows about the new column.',
				lead: 'A rolling deploy runs old and new code against one database. A column the new version writes and the old version does not know about is fine; a column the new version requires and the old version does not write is not. Every schema change has to be tolerable to the version it is replacing for the length of the rollout.',
				keywords: 'rolling deploy, compatibility, schema, rollout'
			},
			{
				slug: 'build-uploaded-not-deployed',
				phrase: 'A build that was uploaded but never deployed',
                summary: 'The pipeline is green and the site is serving the previous version.',
				lead: 'Upload and activate are separate steps in most hosting platforms, and a pipeline that only performs the first reports success while serving month-old bytes. Nothing in the build output is wrong, which is why this survives for weeks. Verifying the deployed version from outside, by asking the running service what it is, is the only check that catches it.',
				keywords: 'pipeline, deploy step, version endpoint, verification'
			},
			{
				slug: 'config-baked-at-start',
				phrase: 'Configuration read once at startup',
				summary: 'The value was changed and the running process is still using the one it read at boot.',
				lead: 'Configuration loaded at startup is a property of the process, not of the environment. Changing it has no effect until a restart, and a fleet with mixed uptimes has instances behaving differently for reasons nothing logs. Either reload deliberately or make a restart part of the change.',
				keywords: 'configuration, restart, environment, drift'
			},
			{
				slug: 'container-serves-birth-env',
				phrase: 'A reused container serving its creation-time settings',
				summary: 'The container was started with old settings, and restarting it does not change them.',
				lead: 'Environment is fixed when a container is created, so a container that is restarted rather than recreated keeps whatever it was born with. It answers on the right port with the wrong configuration, which makes it look correct in every check that only tests reachability. Recreation is the operation; restart is not.',
				keywords: 'container, environment, recreate, restart'
			},
			{
				slug: 'no-version-endpoint',
				phrase: 'No way to ask what version is running',
				summary: 'The only evidence of what is deployed is the pipeline that claims to have deployed it.',
				lead: 'Without an endpoint that reports the build it is serving, every question about what is live is answered by inference. A commit identifier stamped into the binary at link time and exposed on a route makes the question a single request, and makes a stale deploy immediately obvious.',
				keywords: 'version endpoint, build info, ldflags, verification'
			},
			{
				slug: 'stale-artifact-cached',
				phrase: 'A stale artifact served from a cache',
				summary: 'The new build is deployed and an intermediate cache is still handing out the old files.',
				lead: 'Static assets are cached aggressively by design, so a new build has to change their names or the old ones keep being served. Where the document that references them is also cached, the page and its assets can be from different releases, which produces failures that make no sense from either version alone.',
				keywords: 'cache busting, fingerprint, cdn, assets'
			},
			{
				slug: 'gate-outlives-its-reason',
				phrase: 'A launch gate nobody removed',
				summary: 'A flag added for a specific date is still redirecting traffic long after the date passed.',
				lead: 'A gate added for a launch has no connection to the event that justified it, so it remains after the reason expires and eventually nobody remembers what it is for. Every temporary switch needs either an expiry the code enforces or a task to remove it, and the second one is not reliable.',
				keywords: 'feature flag, launch gate, cleanup, expiry'
			},
			{
				slug: 'health-gate-bypassed',
				phrase: 'A rollout that continued past a failing instance',
				summary: 'The readiness check passed before the instance was actually able to serve.',
				lead: 'A rollout advances when instances report ready, so a check that answers before dependencies are usable lets the deploy replace every instance with a broken one. The check has to fail while the process is not able to serve, which means it has to test the things that can be missing.',
				keywords: 'readiness, rollout, canary, gate'
			},
			{
				slug: 'no-drain-on-shutdown',
				phrase: 'In-flight requests dropped on shutdown',
				summary: 'The instance exits as soon as it is told to, and the requests it was handling fail.',
				lead: 'A deploy stops instances, and an instance that exits immediately abandons whatever it was doing. Users see errors during every release, at a rate proportional to traffic, and it is usually written off as deploy noise. Stopping the intake, finishing the in-flight work and then exiting removes it.',
				keywords: 'graceful shutdown, drain, sigterm, connection'
			}
		],
		contexts: [
			{
				slug: 'with-a-schema-change',
				phrase: 'with a schema change in the release',
				summaryTail: 'The database is the part of the release that does not roll back.',
				para: 'A release containing a schema change is two releases whose order matters. The safe sequence is to add what is compatible, deploy the code that can use it, and only then remove what is no longer needed, with each step independently reversible.'
			},
			{
				slug: 'across-a-fleet',
				phrase: 'across a fleet',
				summaryTail: 'A fleet is never uniform during a deploy and sometimes not afterwards.',
				para: 'Across a fleet a deploy is a gradual state, not an event. There is always a window where behavior depends on which instance answered, and a partial rollout that stalls can leave that window open indefinitely.'
			},
			{
				slug: 'under-live-traffic',
				phrase: 'under live traffic',
				summaryTail: 'The deploy is happening while people are using it.',
				para: 'Under live traffic every step of the rollout is visible to someone. Cold caches, warm-up costs and dropped connections are all paid by real requests, which is why the interesting measure of a deploy is the error rate during it rather than the state afterwards.'
			},
			{
				slug: 'in-a-monorepo',
				phrase: 'in a monorepo',
				summaryTail: 'One commit changes several services, and they do not ship together.',
				para: 'In a monorepo a single change can affect several deployable units that are released at different times. The compatibility question is no longer between two versions of one service but between whichever versions of each happen to be live, and that set is larger than anybody checks.'
			},
			{
				slug: 'with-a-rollback-planned',
				phrase: 'with a rollback planned',
				summaryTail: 'The rollback is the part of the plan that gets tested for the first time in production.',
				para: 'A rollback that has never been executed is a hypothesis. Data written by the new version has to be readable by the old one, and any migration in the release has to have a reverse that has actually been run, or the plan is to fix forward and should say so.'
			},
			{
				slug: 'in-a-shared-environment',
				phrase: 'in a shared environment',
				summaryTail: 'Someone else is deploying to the same place at the same time.',
				para: 'In a shared environment two deploys can overlap, and a teardown belonging to one can remove what the other just started. Anything that stops or resets globally needs a scope, or the second engineer of the afternoon discovers it the hard way.'
			}
		],
		notes: [
			'Ask the running service what it is. A version endpoint stamped at build time turns every question about what is deployed into one request, and it is the check that catches an upload that never activated.',
			'Split any change that cannot be reversed. Two compatible deploys are slower to plan and much faster than the incident that follows one irreversible release.',
			'Treat the shutdown path as production code. It runs on every deploy, and it is where the errors that get dismissed as noise actually come from.',
			'Make readiness fail when the instance cannot serve. A probe that answers unconditionally is worse than none, because the rollout trusts it.',
			'Give every temporary switch an expiry the code enforces. A flag with a date in a comment outlives its reason; a flag that stops working does not.',
			'Verify from outside the system. Every internal signal is produced by the thing being tested, and the only independent evidence is a request from somewhere else.'
		]
	}
];

/** Articles per subject. Ten failures and six contexts give sixty pairs. */
const PER_SUBJECT = 42;

export const CATEGORIES: Category[] = [
	{ slug: 'kb-cat-postgresql', title: 'PostgreSQL' },
	{ slug: 'kb-cat-mysql', title: 'MySQL' },
	{ slug: 'kb-cat-connection-pooling', title: 'Connection pooling' },
	{ slug: 'kb-cat-indexes-and-plans', title: 'Indexes and query plans' },
	{ slug: 'kb-cat-caching', title: 'Caching' },
	{ slug: 'kb-cat-queues-and-jobs', title: 'Queues and background jobs' },
	{ slug: 'kb-cat-tls-and-certificates', title: 'TLS and certificates' },
	{ slug: 'kb-cat-dns-and-discovery', title: 'DNS and service discovery' },
	{ slug: 'kb-cat-observability', title: 'Observability' },
	{ slug: 'kb-cat-releases-and-rollbacks', title: 'Releases and rollbacks' }
];

/**
 * Articles written to make one synonym group and one ranking rule visible.
 *
 * The engine stores both and applies neither, so this app applies them itself
 * (see src/lib/server/expand.ts and src/lib/server/rank.ts). A demonstration
 * needs documents that split along the exact line the rule draws, and the rest
 * of the corpus does not, so these are written by hand.
 *
 * The synonym set: "p99" appears in exactly three articles in the whole corpus
 * and none of them uses the word latency. Searching p99 finds those three.
 * Searching p99 with the group applied also finds every article that talks
 * about latency, which is most of the observability shelf.
 *
 * The ranking set: four articles name "checkpoint" in the title and never use it
 * in the body, and three discuss it in the body and never in the title. With
 * the postgres shelf's own flush entry that makes twelve matches, four titled
 * and eight not, so raising the body weight above the title weight reverses the
 * order they come back in.
 */
const DEMO: Article[] = [
	{
		slug: 'kb-vocab-p99-budget',
		title: 'Setting a p99 budget for a read path',
		summary: 'How to pick the number, and what to do when the number is exceeded.',
		body: 'A p99 budget is a statement about the slowest one request in a hundred, and it is the only figure that matches what a user notices. Pick it from the interaction rather than from the current graph: a keystroke response and a report export do not deserve the same number.\n\nOnce the figure exists, it constrains design. Every wait in the path has to fit inside it, including connection acquisition and any dependency call, and a path with three sequential dependencies cannot promise less than the sum of their own slowest cases.\n\nWhen the budget is exceeded, the useful response is to find which stage moved, not to raise the figure. A budget that is revised whenever it is missed is a description of current behavior rather than a commitment.',
		keywords: 'p99, budget, percentile, read path',
		category: 'kb-cat-observability'
	},
	{
		slug: 'kb-vocab-p99-moved',
		title: 'Reading a p99 that moved while the mean did not',
		summary: 'A change in the slowest one percent is invisible in the average by construction.',
		body: 'When the p99 rises and the mean does not, a small fraction of requests got much slower and the rest did not change. That shape points at a resource with a queue: a pool, a lock, a single-threaded stage, or one instance behaving differently from its peers.\n\nSplit the measurement before theorizing. Per-instance, per-endpoint and per-dependency views will usually show the whole increase concentrated somewhere narrow, and a narrow cause is a cause you can fix.\n\nIf the increase is uniform across every split, the queue is shared, and the most common shared queue is the connection pool. Checkout wait is the graph that settles it.',
		keywords: 'p99, mean, queue, diagnosis',
		category: 'kb-cat-observability'
	},
	{
		slug: 'kb-vocab-p99-aggregation',
		title: 'Why a fleet p99 cannot be averaged',
		summary: 'Quantiles do not add, so a mean of per-instance p99 values is not a p99.',
		body: 'A quantile is a position in a distribution, and positions from different distributions cannot be combined by averaging them. The mean of ten instance p99 values is a number with no interpretation, and in practice it understates the fleet figure.\n\nThe correct aggregation sums histogram buckets across instances and estimates the quantile from the combined histogram. That requires the instrumentation to export buckets rather than a precomputed quantile, which is a decision made when the metric is added.\n\nThe practical consequence is that a dashboard built on precomputed quantiles cannot be fixed by a different query. The data it needs was never recorded.',
		keywords: 'p99, aggregation, histogram, quantile',
		category: 'kb-cat-observability'
	},
	{
		slug: 'kb-vocab-latency-budget-hops',
		title: 'Spending a latency budget across three hops',
		summary: 'Sequential dependencies add, and the budget has to be divided before it is spent.',
		body: 'A request that calls three services in sequence has a latency floor equal to the sum of their slowest acceptable responses. Dividing the budget explicitly, and giving each hop a timeout smaller than its share, is what keeps the total bounded.\n\nTimeouts set independently by each team always sum to more than the caller can afford. The number that matters is the one the user waits for, and it has to be allocated from the top down.\n\nWhere the sum does not fit, the answer is structural: run the calls concurrently, cache one of them, or return a partial result. Tightening each hop by a few milliseconds does not close a gap of that shape.',
		keywords: 'latency, budget, timeout, dependencies',
		category: 'kb-cat-observability'
	},
	{
		slug: 'kb-vocab-latency-versus-throughput',
		title: 'Trading latency against throughput in a batch stage',
		summary: 'Batching improves the total and makes every individual item wait.',
		body: 'Batching amortizes fixed costs, so throughput improves as the batch grows. Each item, however, waits for the batch to fill, which means the latency of an individual item is set by the arrival rate rather than by the work.\n\nThat trade is usually worth making with a bound on the wait: flush when the batch is full or when a short timer expires, whichever comes first. Without the timer, a quiet period turns a fast stage into an arbitrarily slow one.\n\nThe measure to keep is both numbers. A stage optimized on throughput alone will find the largest batch it can, and the latency it produces will only be discovered downstream.',
		keywords: 'latency, throughput, batching, flush',
		category: 'kb-cat-queues-and-jobs'
	},
	{
		slug: 'kb-vocab-latency-under-retry',
		title: 'How a retry policy shapes observed latency',
		summary: 'A retry converts a fast failure into a slow success, and the graph records the sum.',
		body: 'A request that fails and is retried takes the first attempt, the backoff and the second attempt. From the caller point of view that is one slow request, and it lands in the tail of the distribution rather than in the error rate.\n\nThis is why a service can improve its error rate and get worse for users at the same time. The failures did not disappear; they were converted into latency, and the conversion rate is set by the backoff.\n\nRecord attempts as well as outcomes. Without the attempt count, a tail that is entirely made of retries is indistinguishable from a tail made of slow work, and the two have nothing in common.',
		keywords: 'latency, retry, backoff, tail',
		category: 'kb-cat-queues-and-jobs'
	},
	{
		slug: 'kb-rank-checkpoint-tuning',
		title: 'Checkpoint tuning on a write-heavy database',
		summary: 'Spreading the flush rather than shortening the interval.',
		body: 'A write-heavy database accumulates dirty buffers between flushes, and the flush is where the write latency goes. The completion target spreads the work across the interval rather than concentrating it at the end, which flattens the sawtooth without reducing the amount written.\n\nShortening the interval instead increases the total work, because pages that would have been written once are written repeatedly. It looks like it helps because each spike is smaller.\n\nThe measurement that decides it is the write latency distribution across a full interval, before and after, on the same workload.',
		keywords: 'checkpoint, tuning, write latency, buffers',
		category: 'kb-cat-postgresql'
	},
	{
		slug: 'kb-rank-checkpoint-storm',
		title: 'Diagnosing a checkpoint storm',
		summary: 'Several flushes overlapping produce a stall that looks like a lock.',
		body: 'When flushes are requested faster than they complete, they overlap, and the database spends its IO budget on them rather than on queries. The symptom is a stall with no lock waits and no slow query, which sends people looking in the wrong layer.\n\nThe log records why each flush started. A run of them attributed to log volume rather than to the timer means the interval is not the constraint; the write rate is.\n\nThe fix is to reduce the rate of change or to give the flush more room, and the choice depends on whether the write volume is load or waste.',
		keywords: 'checkpoint, storm, stall, io',
		category: 'kb-cat-postgresql'
	},
	{
		slug: 'kb-rank-checkpoint-after-import',
		title: 'Checkpoint behavior after a bulk import',
		summary: 'An import dirties everything at once and the flush arrives afterwards.',
		body: 'A bulk import touches a large fraction of the buffer pool, so the flush that follows is the largest the database will ever do. Latency for unrelated queries degrades minutes after the import finished, which breaks the connection between cause and symptom.\n\nRequesting a flush as the last step of the import moves the cost into the window that was already expected to be slow. It is one statement and it removes the surprise.\n\nStatistics belong in the same place for the same reason. Both are cheap at the end of a load and expensive to diagnose later.',
		keywords: 'checkpoint, bulk import, flush, statistics',
		category: 'kb-cat-postgresql'
	},
	{
		slug: 'kb-rank-checkpoint-and-replicas',
		title: 'Checkpoint interaction with a standby',
		summary: 'The flush on the primary becomes replay work on the replica.',
		body: 'Everything a flush writes is also written to the log, and the standby applies that log with a single process. A large flush on the primary therefore appears as a lag spike on the replica a short time later.\n\nReads routed to the standby during that window answer from an older state, which is correct behavior and surprising to a caller that just wrote. Routing a read-after-write to the primary is the usual answer.\n\nThe two graphs to compare are primary write volume and replica apply lag. The offset between them is the useful number.',
		keywords: 'checkpoint, replica, lag, replay',
		category: 'kb-cat-postgresql'
	},
	{
		slug: 'kb-rank-wal-volume-review',
		title: 'Reviewing write-ahead log volume',
		summary: 'The log records every page change, and full-page writes dominate it.',
		body: 'Log volume is driven by how many distinct pages are modified rather than by how many rows change. The first modification of a page after a checkpoint writes the whole page, so a workload that touches many pages lightly produces far more log than its row count suggests. Tuning the checkpoint interval changes how often that full-page write recurs, and one that arrives too often multiplies the volume.\n\nSpreading updates across fewer pages, by clustering related rows or batching writes to the same page, reduces the log more reliably than any setting. A flush every few seconds turns every update into a full-page write.\n\nMeasure the volume per unit of work rather than per hour. Load varies, and the ratio is what tells you whether a change helped.',
		keywords: 'wal, log volume, full page writes, batching',
		category: 'kb-cat-postgresql'
	},
	{
		slug: 'kb-rank-buffer-pool-review',
		title: 'Sizing the shared buffer pool',
		summary: 'The pool holds pages, and the interesting question is which pages.',
		body: 'A larger pool holds more pages and delays the point at which reads reach the disk. It also increases the number of dirty pages a checkpoint has to flush, so the write spike at each flush grows with it, and a pool sized purely for read hit rate produces the worst possible flush.\n\nThe working set is what matters, not the table size. A large table read through a narrow index needs very little of the pool, and a small table scanned constantly needs all of it.\n\nAdjust one dimension at a time, and watch the checkpoint write volume as well as the read hit rate. They move in opposite directions and only one of them is usually on the dashboard.',
		keywords: 'shared buffers, working set, hit rate, flush',
		category: 'kb-cat-postgresql'
	},
	{
		slug: 'kb-rank-fsync-cost-review',
		title: 'Understanding the cost of a durable write',
		summary: 'Durability is a flush to stable storage, and its cost sets the transaction floor.',
		body: 'A committed transaction is one whose log has reached stable storage, which means a flush the operating system cannot buffer away. That single operation sets the floor for transaction rate on any device, and grouping commits is how a server exceeds it. A checkpoint is a much larger version of the same operation, and its cost is paid in one burst rather than spread across transactions.\n\nGrouping trades a small delay for a large throughput gain, because several transactions share one flush. The delay is bounded and configurable, and it is invisible next to the flush itself.\n\nStorage that reports a flush as complete before it is durable makes all of this arithmetic wrong, and it is worth verifying rather than assuming, because a checkpoint depends on the same guarantee.',
		keywords: 'fsync, durability, commit, group commit',
		category: 'kb-cat-postgresql'
	}
];

/**
 * Builds the corpus. Deterministic: the same articles in the same order on
 * every run, so a count quoted in the README stays true.
 */
export function buildArticles(): Article[] {
	const out: Article[] = [];

	for (const subject of SUBJECTS) {
		for (let n = 0; n < PER_SUBJECT; n++) {
			const failure = subject.failures[n % subject.failures.length];
			const context = subject.contexts[Math.floor(n / subject.failures.length) % subject.contexts.length];
			// Two different notes per article, walked at a stride that is coprime
			// with the pool size so no article repeats a paragraph.
			const first = subject.notes[(n * 3) % subject.notes.length];
			const second = subject.notes[(n * 3 + 1) % subject.notes.length];

			out.push({
				slug: `kb-${subject.id}-${failure.slug}-${context.slug}`,
				title: `${failure.phrase} ${context.phrase}`,
				summary: `${failure.summary} ${context.summaryTail}`,
				body: [failure.lead, context.para, first, second].join('\n\n'),
				keywords: `${failure.keywords}, ${subject.keyword}`,
				category: `kb-cat-${subject.category}`
			});
		}
	}

	return [...out, ...DEMO];
}

/** The synonym group the console and the public page demonstrate. */
export const DEMO_SYNONYM = {
	name: 'Latency vocabulary',
	base_term: 'p99',
	synonyms: ['latency', 'percentile']
};
