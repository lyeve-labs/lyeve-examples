/** The seed catalog. Kept apart from the provisioning logic so the walk that writes it stays readable. */

export interface SeedLesson {
	slug: string;
	title: string;
	durationMinutes: number;
	body: string;
}

export interface SeedModule {
	slug: string;
	title: string;
	lessons: SeedLesson[];
}

export interface SeedCourse {
	slug: string;
	title: string;
	level: string;
	summary: string;
	body: string;
	cover: { from: [number, number, number]; to: [number, number, number] };
	modules: SeedModule[];
}

export const CURRICULUM: SeedCourse[] = [
	{
		slug: 'relational-modeling',
		title: 'Relational Modeling from First Principles',
		level: 'Beginner',
		summary:
			'Start from the relation itself and build up to a schema you can defend in review. Twelve lessons, no ORM.',
		body: 'Most database courses teach the syntax and leave the modeling to instinct. This one runs the other way. You spend the first module on what a relation actually is, so that normal forms arrive as consequences rather than rules to memorize.\n\nBy the end you will be able to look at a set of business facts, decide which of them are keys, and write the DDL without reaching for a diagram tool.',
		cover: { from: [17, 42, 74], to: [15, 118, 130] },
		modules: [
			{
				slug: 'relations-and-keys',
				title: 'Relations and Keys',
				lessons: [
					{
						slug: 'what-a-relation-really-is',
						title: 'What a Relation Really Is',
						durationMinutes: 11,
						body: 'A relation is a set of tuples over named, typed attributes. Two things follow immediately: there is no row order, and there are no duplicate rows. Every surprise you have ever had with a query that returned the same row twice starts with a table that was not a relation.\n\nWork through the difference on paper before touching a keyboard. Write out a small set of facts about library loans, then decide which attributes belong together in one relation and which do not.'
					},
					{
						slug: 'candidate-keys-and-choosing-a-primary',
						title: 'Candidate Keys and Choosing a Primary',
						durationMinutes: 14,
						body: 'A candidate key is any minimal set of attributes that identifies a tuple. A table usually has more than one. Choosing the primary key is a design decision about what the rest of the system will quote, not a technical requirement.\n\nThe practical test is stability. If an attribute can be corrected later, it is a poor primary key even when it is unique today, because every foreign key that quotes it inherits the correction.'
					},
					{
						slug: 'surrogate-keys-and-what-they-cost',
						title: 'Surrogate Keys and What They Cost',
						durationMinutes: 12,
						body: 'A surrogate key buys stability and costs meaning. Rows can no longer be compared without a join, and duplicate business facts can sit side by side under two different ids without the database noticing.\n\nThe fix is not to avoid surrogates. It is to keep the natural key as a unique constraint alongside the surrogate, so the database still enforces the rule the business actually has.'
					},
					{
						slug: 'foreign-keys-as-promises',
						title: 'Foreign Keys as Promises',
						durationMinutes: 9,
						body: 'A foreign key is a promise that the referenced row exists for as long as the reference does. Cascade behavior decides who keeps the promise when the parent goes away.\n\nPick the cascade rule from the business meaning. A loan without a member is nonsense and should cascade. An invoice without a sales rep is awkward but real, so it should nullify rather than delete history.'
					}
				]
			},
			{
				slug: 'normal-forms-in-practice',
				title: 'Normal Forms in Practice',
				lessons: [
					{
						slug: 'functional-dependencies-you-can-see',
						title: 'Functional Dependencies You Can See',
						durationMinutes: 13,
						body: 'A functional dependency says that one set of attributes determines another. Once you can spot them in sample data, the normal forms stop being a checklist and start being a description of what you already noticed.\n\nTake twenty rows of real data and mark every column that never varies while another column is held constant. Those marks are your dependencies.'
					},
					{
						slug: 'third-normal-form-without-the-jargon',
						title: 'Third Normal Form Without the Jargon',
						durationMinutes: 16,
						body: 'Third normal form asks that every non-key attribute depend on the key, the whole key, and nothing but the key. Read as a sentence it is a rule about where a fact belongs, not about how many tables you end up with.\n\nThe usual violation is a denormalized label carried alongside an id, kept because someone did not want to write a join. It survives until the label changes in one table and not the other.'
					},
					{
						slug: 'when-to-denormalize-on-purpose',
						title: 'When to Denormalize on Purpose',
						durationMinutes: 10,
						body: 'Deliberate denormalization is a caching decision with a write-path cost. It is defensible when the read pattern is fixed, the write rate is low, and something keeps the copy honest.\n\nWrite down which of those three you are relying on before you copy a column. If you cannot name the mechanism that repairs drift, you have not denormalized, you have introduced a bug with a schedule.'
					},
					{
						slug: 'modeling-time-and-history',
						title: 'Modeling Time and History',
						durationMinutes: 18,
						body: 'Any fact that can change is really two facts: the value and the period it held for. Systems that store only the current value quietly lose the ability to answer questions about last quarter.\n\nThe cheapest version is an append-only table with a valid_from column and a nullable valid_to. It is more work to query and far less work to audit.'
					}
				]
			},
			{
				slug: 'indexes-and-access-paths',
				title: 'Indexes and Access Paths',
				lessons: [
					{
						slug: 'reading-an-execution-plan',
						title: 'Reading an Execution Plan',
						durationMinutes: 15,
						body: 'An execution plan is a tree of operators, read from the leaves upward. The two numbers worth your attention are the estimated row count and the actual one, because a plan goes wrong when those diverge.\n\nStart with the deepest node where estimate and reality part company. Everything above it is a consequence, not a cause.'
					},
					{
						slug: 'composite-indexes-and-column-order',
						title: 'Composite Indexes and Column Order',
						durationMinutes: 12,
						body: 'A composite index is usable from the left. An index on (tenant_id, created_at) serves a filter on tenant alone and a filter on both, but not a filter on created_at alone.\n\nOrder the columns by how the queries filter, with equality predicates first and the range predicate last. Getting this backwards produces an index that is scanned rather than sought.'
					},
					{
						slug: 'the-cost-of-every-index-you-add',
						title: 'The Cost of Every Index You Add',
						durationMinutes: 8,
						body: 'Each index is another structure that every insert, update and delete must maintain, and another object competing for cache. A table with nine indexes has a write path nine times more expensive than the one you tested.\n\nAudit indexes the way you audit dependencies. Anything that has not served a query in a month is paying rent on space it does not use.'
					}
				]
			}
		]
	},
	{
		slug: 'content-api-design',
		title: 'Designing Content APIs',
		level: 'Intermediate',
		summary:
			'Schema-driven endpoints, relations, pagination and versioning, taken from a working headless backend.',
		body: 'A content API is judged by how well it survives its second consumer. The first client can be accommodated by anything. The second one exposes every assumption you baked into the response shape.\n\nThis course works through the decisions that matter early: how relations are expressed on the wire, how pagination is bounded, and how you add a field without breaking the mobile app that shipped last year.',
		cover: { from: [46, 26, 71], to: [147, 51, 108] },
		modules: [
			{
				slug: 'resources-and-shapes',
				title: 'Resources and Shapes',
				lessons: [
					{
						slug: 'schema-driven-endpoints',
						title: 'Schema Driven Endpoints',
						durationMinutes: 14,
						body: 'When endpoints are generated from a schema, the schema becomes the contract and the handler becomes uninteresting. That is the goal. Every hand-written handler is a place where two content types can drift apart in behavior.\n\nThe tradeoff is that anything the schema cannot express has nowhere to live. Decide early whether computed fields belong in the schema, the response layer, or the client.'
					},
					{
						slug: 'envelopes-versus-bare-arrays',
						title: 'Envelopes Versus Bare Arrays',
						durationMinutes: 9,
						body: 'A bare array is pleasant to consume and impossible to extend. The moment you need a total count or a cursor, every client has to change at once.\n\nAn envelope costs one level of nesting and buys room to add metadata later. If you ship a bare array, treat it as a permanent decision, because it is one.'
					},
					{
						slug: 'nulls-absence-and-meaning',
						title: 'Nulls, Absence and Meaning',
						durationMinutes: 11,
						body: 'A field that is null, a field that is absent, and a field that is an empty string are three different statements. Clients will treat them as one unless the API is consistent.\n\nPick a rule and write it into the reference docs. The common choice is that absent means the server did not compute it and null means the value is genuinely unset.'
					}
				]
			},
			{
				slug: 'relations-on-the-wire',
				title: 'Relations on the Wire',
				lessons: [
					{
						slug: 'ids-versus-embedded-objects',
						title: 'Ids Versus Embedded Objects',
						durationMinutes: 13,
						body: 'Returning an id keeps responses small and forces a second request. Embedding the object saves the round trip and inflates every response whether the client wanted it or not.\n\nThe usual answer is to return ids by default and let the caller opt in to embedding. That keeps the cheap case cheap and makes the expensive case a deliberate choice.'
					},
					{
						slug: 'population-depth-and-its-limits',
						title: 'Population Depth and Its Limits',
						durationMinutes: 17,
						body: 'Population resolves a stored reference into the record it points at. It follows the direction the data is stored, which means a child can be asked for its parent and a parent generally cannot be asked for its children.\n\nDepth multiplies that cost. Each level is another batch of lookups, and an unbounded depth parameter is a way for a caller to ask the database for the whole graph in one request.'
					},
					{
						slug: 'fetching-children-by-foreign-key',
						title: 'Fetching Children by Foreign Key',
						durationMinutes: 12,
						body: 'Where population cannot help, a filtered list on the foreign key column will. Ask for the children whose parent id equals the one you hold, and you have the missing direction back.\n\nThis is where an API without a set filter starts to hurt. One parent at a time is correct and chatty; a single IN clause would be one request, and its absence is a real design cost.'
					},
					{
						slug: 'avoiding-the-n-plus-one-response',
						title: 'Avoiding the N Plus One Response',
						durationMinutes: 15,
						body: 'The classic shape is a list endpoint that returns twenty items and a client that then fetches twenty related records. Moving the loop from the client to the server does not fix it, it only hides it.\n\nBatching is the fix that generalizes: collect the ids, issue one lookup, and stitch the results in memory. Everything else is a special case of that.'
					}
				]
			},
			{
				slug: 'pagination-and-change',
				title: 'Pagination and Change',
				lessons: [
					{
						slug: 'offset-pagination-and-its-drift',
						title: 'Offset Pagination and Its Drift',
						durationMinutes: 10,
						body: 'Offset pagination is easy to implement and wrong under concurrent writes. A row inserted while a client pages through results pushes an unseen row onto the next page, and a deletion skips one entirely.\n\nIt is acceptable for a static catalog and a poor fit for a feed. Know which one you are building before you pick.'
					},
					{
						slug: 'server-enforced-page-limits',
						title: 'Server Enforced Page Limits',
						durationMinutes: 8,
						body: 'A limit parameter that the server does not clamp is a denial of service waiting for a curious caller. Clamping it is standard, and so is documenting the clamp.\n\nThe part people forget is the floor. A server that silently raises a small limit to its minimum will hand back more rows than the client asked for, and a client that trusts the count will render them all.'
					},
					{
						slug: 'versioning-without-a-rewrite',
						title: 'Versioning Without a Rewrite',
						durationMinutes: 14,
						body: 'Additive change needs no version. New optional fields, new endpoints and new query parameters can all ship to an old client safely, provided the client ignores what it does not recognize.\n\nReserve a version bump for the changes that break that promise: renamed fields, narrowed types, and removed behavior. Then the version number means something when it moves.'
					}
				]
			}
		]
	},
	{
		slug: 'service-observability',
		title: 'Observability for Web Services',
		level: 'Intermediate',
		summary:
			'Logs, metrics and traces as one system, with the cardinality and alerting mistakes that follow each one.',
		body: 'Observability is not three tools bolted together. It is the ability to ask a new question about production without shipping code, and each of the three signals answers a different kind of question.\n\nThis course is built around one failing service. You instrument it, break it in a new way each module, and see which signal actually told you what happened.',
		cover: { from: [20, 61, 42], to: [110, 138, 26] },
		modules: [
			{
				slug: 'signals-and-what-they-answer',
				title: 'Signals and What They Answer',
				lessons: [
					{
						slug: 'structured-logs-that-survive-grep',
						title: 'Structured Logs That Survive Grep',
						durationMinutes: 12,
						body: 'A log line is only useful if it can be found later. Structured fields make that possible; free text prose makes it a guessing game about which words the author chose that day.\n\nAgree on the field names before the first service ships. Renaming request_id to requestId across forty repositories is a week nobody plans for.'
					},
					{
						slug: 'metrics-and-the-cardinality-trap',
						title: 'Metrics and the Cardinality Trap',
						durationMinutes: 15,
						body: 'Every distinct combination of label values is a separate time series. A label carrying a user id turns one metric into millions and takes the metrics backend with it.\n\nThe rule of thumb is that a label must have a bounded set of values you could list on a whiteboard. If you cannot list them, the value belongs in a log or a trace.'
					},
					{
						slug: 'traces-across-a-service-boundary',
						title: 'Traces Across a Service Boundary',
						durationMinutes: 16,
						body: 'A trace is worth building the moment a request crosses a process boundary, because that is where logs from two services stop lining up. Context propagation is the whole trick, and it is mostly a matter of forwarding one header consistently.\n\nSampling decisions belong at the edge. Deciding halfway through gives you traces with missing spans, which read as bugs in the system rather than in the instrumentation.'
					}
				]
			},
			{
				slug: 'instrumenting-a-real-service',
				title: 'Instrumenting a Real Service',
				lessons: [
					{
						slug: 'the-four-signals-worth-alerting-on',
						title: 'The Four Signals Worth Alerting On',
						durationMinutes: 11,
						body: 'Latency, traffic, errors and saturation cover most of what a request-driven service can do wrong. Everything else is usually a leading indicator of one of them.\n\nStart there, get them clean, and add specific alerts only when an incident proves the general ones were too slow to notice.'
					},
					{
						slug: 'percentiles-not-averages',
						title: 'Percentiles, Not Averages',
						durationMinutes: 9,
						body: 'An average latency hides the tail, and the tail is what users describe when they say the site is slow. A p99 of four seconds behind a mean of eighty milliseconds is a normal week.\n\nHistogram buckets need choosing in advance. Pick them around the thresholds you would act on, not around the numbers you have today.'
					},
					{
						slug: 'instrumenting-database-calls',
						title: 'Instrumenting Database Calls',
						durationMinutes: 13,
						body: 'Time the query, count the rows and record the statement shape, never the parameters. Parameters carry customer data into a system that was not designed to hold it.\n\nA span per query is usually right. A span per row is a way to make one slow endpoint cost more in trace storage than it did in database time.'
					}
				]
			},
			{
				slug: 'alerting-and-on-call',
				title: 'Alerting and On Call',
				lessons: [
					{
						slug: 'symptom-alerts-over-cause-alerts',
						title: 'Symptom Alerts Over Cause Alerts',
						durationMinutes: 10,
						body: 'Alert on what the user experiences, not on the mechanism you happen to suspect. A cause alert fires for a condition that is sometimes harmless, and it teaches the team to ignore the page.\n\nCause metrics still belong on the dashboard. They are how you diagnose after the symptom alert has woken someone.'
					},
					{
						slug: 'error-budgets-in-practice',
						title: 'Error Budgets in Practice',
						durationMinutes: 14,
						body: 'An error budget turns reliability into a quantity that can be spent. Ninety-nine point nine percent over thirty days is forty-three minutes of failure you are allowed to use.\n\nThe budget only works if exhausting it changes behavior. If nothing stops when the budget is gone, you have a metric, not a policy.'
					},
					{
						slug: 'runbooks-that-get-read',
						title: 'Runbooks That Get Read',
						durationMinutes: 8,
						body: 'A runbook linked from the alert itself is read. A runbook in a wiki that someone must remember to search for is not.\n\nKeep each one to the shape of the question being asked at three in the morning: what broke, what to check first, and what to do if the first check is inconclusive.'
					},
					{
						slug: 'writing-the-incident-review',
						title: 'Writing the Incident Review',
						durationMinutes: 12,
						body: 'The useful review explains why the wrong action looked correct at the time. A review that concludes someone should have been more careful teaches nothing and repeats the incident.\n\nRecord the timeline from the responders, not from the graphs. What people believed at each step is the part the graphs cannot show you.'
					}
				]
			}
		]
	},
	{
		slug: 'release-engineering',
		title: 'Release Engineering for Small Teams',
		level: 'Advanced',
		summary:
			'Branching, versioning, migrations and rollback, sized for a team that cannot staff a release manager.',
		body: 'Small teams do not fail at releases because they lack tooling. They fail because the release process lives in one person and is reconstructed from memory each time.\n\nThis course builds a release path that a new joiner can follow on their second week: one branching model, one version rule, and migrations that can be rolled back without an outage.',
		cover: { from: [74, 27, 19], to: [180, 96, 22] },
		modules: [
			{
				slug: 'branching-and-versioning',
				title: 'Branching and Versioning',
				lessons: [
					{
						slug: 'two-permanent-branches',
						title: 'Two Permanent Branches',
						durationMinutes: 11,
						body: 'One integration branch and one production branch answer almost every question a small team has about where code lives. Everything else is a short-lived branch cut from integration and merged back.\n\nThe discipline that makes it work is that neither permanent branch ever takes a direct commit. Both take merges, which keeps the history readable and the review mandatory.'
					},
					{
						slug: 'deriving-a-version-from-commits',
						title: 'Deriving a Version from Commits',
						durationMinutes: 13,
						body: 'If commit messages carry their own type, the next version number is a calculation rather than a debate. A breaking change bumps the major, a feature the minor, and everything else the patch.\n\nThe cost is that the convention has to be enforced at review time. A single untyped commit turns the calculation back into a guess.'
					},
					{
						slug: 'changelogs-people-actually-read',
						title: 'Changelogs People Actually Read',
						durationMinutes: 9,
						body: 'A changelog written for the person upgrading is a list of what they must do differently. A changelog generated from raw commit subjects is a list of what you did, which is a different document.\n\nWrite the breaking changes first, in the imperative, with the migration step attached. The rest can be generated.'
					},
					{
						slug: 'tagging-and-what-a-tag-promises',
						title: 'Tagging and What a Tag Promises',
						durationMinutes: 7,
						body: 'An annotated tag says that this exact tree was released. Moving or deleting a published tag breaks that promise for every checkout that already fetched it.\n\nIf a release is wrong, the fix is another release. Tags are cheap and history is not.'
					}
				]
			},
			{
				slug: 'database-migrations',
				title: 'Database Migrations',
				lessons: [
					{
						slug: 'expand-and-contract',
						title: 'Expand and Contract',
						durationMinutes: 16,
						body: 'A rename that ships in one step requires the code and the schema to change at the same instant, which is not something a rolling deploy can offer. Expand and contract splits it into three releases: add the new column, write to both, then drop the old one.\n\nThe middle release is the one teams skip. It is also the only one that makes the first and third safe.'
					},
					{
						slug: 'backward-compatible-schema-change',
						title: 'Backward Compatible Schema Change',
						durationMinutes: 12,
						body: 'During a deploy, two versions of the application talk to one database. Every migration therefore has to be readable by the version that has not been replaced yet.\n\nAdding a nullable column is safe. Adding a not-null column without a default is not, and neither is dropping anything the previous release still selects.'
					},
					{
						slug: 'testing-a-down-migration',
						title: 'Testing a Down Migration',
						durationMinutes: 10,
						body: 'A down migration that has never been executed is documentation, not a rollback. The test is mechanical: apply up, apply down, apply up again, and compare the schema.\n\nSome migrations genuinely cannot be reversed. Say so in the file rather than shipping a down step that silently loses the data it was meant to restore.'
					}
				]
			},
			{
				slug: 'deploying-and-rolling-back',
				title: 'Deploying and Rolling Back',
				lessons: [
					{
						slug: 'health-checks-that-mean-something',
						title: 'Health Checks That Mean Something',
						durationMinutes: 11,
						body: 'A readiness probe that returns two hundred as soon as the process starts will route traffic to an instance with no database connection. The probe has to check the dependencies the first request will use.\n\nKeep liveness and readiness separate. Restarting a healthy process because a downstream is slow turns a partial outage into a full one.'
					},
					{
						slug: 'canaries-and-honest-rollback',
						title: 'Canaries and Honest Rollback',
						durationMinutes: 14,
						body: 'A canary is only useful if someone is watching a metric that would change, and if the rollback is fast enough to be worth the wait. Ten percent of traffic for two minutes tells you about crashes and nothing about a slow leak.\n\nRehearse the rollback on a quiet afternoon. The first time you run it should not be the first time it matters.'
					},
					{
						slug: 'feature-flags-and-their-half-life',
						title: 'Feature Flags and Their Half Life',
						durationMinutes: 9,
						body: 'A flag lets a release and a launch happen on different days, which is genuinely valuable. It also doubles the number of code paths under test for as long as it exists.\n\nGive each flag an owner and a removal date when it is created. A flag with neither becomes permanent configuration that nobody dares to change.'
					}
				]
			}
		]
	}
];
