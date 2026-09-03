/**
 * Creates the company site's content types, applies the forms preset, defines
 * the contact form, and seeds the company.
 *
 * Safe to run more than once. Applying a schema that already exists is
 * accepted, a preset whose types already exist answers 409 and is taken as
 * done, the form is created only when its slug is free, and every seeded
 * record is skipped when something already holds its slug, so a run that dies
 * half way through can simply be run again.
 */
import {
	LyeveError,
	lyeveFromEnv,
	applySchemas,
	belongsTo,
	getContentBySlug,
	listContent,
	createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const PAGES = 'site_pages';
const TEAM = 'site_team';
const OPENINGS = 'site_openings';

// Slugs are unique per tenant and every example shares one engine, so the
// contact form carries the app name.
const CONTACT_FORM = 'company-site-contact';

// Order matters: site_openings emits a foreign key against site_team's
// generated table, so the team has to exist before the openings reference it.
await applySchemas(client, [
	{
		name: PAGES,
		display_name: 'Site Pages',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			// The app groups pages by section to build the footer, and the engine
			// filters on exact equality, so the column is indexed.
			{ name: 'section', field_type: 'text', indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			{ name: 'hero_media_id', field_type: 'text' }
		]
	},
	{
		name: TEAM,
		display_name: 'Team',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'role', field_type: 'text' },
			{ name: 'location', field_type: 'text' },
			{ name: 'bio', field_type: 'text' },
			{ name: 'photo_media_id', field_type: 'text' },
			// The engine returns rows created_at DESC and takes no sort
			// parameter, so a running order has to be stored and applied by the
			// app.
			{ name: 'sort_order', field_type: 'number' }
		]
	},
	{
		name: OPENINGS,
		display_name: 'Job Openings',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'location', field_type: 'text', indexed: true },
			{ name: 'department', field_type: 'text', indexed: true },
			{ name: 'employment_type', field_type: 'text' },
			{ name: 'summary', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			{ name: 'sort_order', field_type: 'number' },
			belongsTo('hiring_manager', TEAM)
		]
	}
]);
console.log('content types ready');

/**
 * Applies the schema plugin's forms preset, which creates `forms` and
 * `form_submissions`. It refuses, creating nothing, when either exists.
 */
async function ensureFormsPreset(): Promise<void> {
	try {
		await client.request('admin', '/api/admin/schemas/presets/forms', { method: 'POST' });
		console.log('forms preset applied: forms, form_submissions');
	} catch (err) {
		if (!(err instanceof LyeveError) || err.status !== 409) throw err;
		console.log('forms preset already applied');
	}
}

/**
 * Defines the contact form as a `forms` record.
 *
 * The layout is JSON the app renders and validates against, so changing a
 * label or an option in the engine changes the page on the next request. The
 * preset stores it and reads nothing inside it.
 */
async function ensureContactForm(): Promise<void> {
	if (await getContentBySlug(client, 'forms', CONTACT_FORM)) {
		console.log('contact form already defined');
		return;
	}

	const layout = {
		description:
			'Tell us what you are running today and what is forcing the move. Someone who works on the platform answers, usually within a working day.',
		submit_text: 'Send message',
		success_message:
			'Thank you. Your message reached the platform team and someone will reply within one working day.',
		// The app renders a field named _website and treats a filled one as a
		// bot, answering with the ordinary success message and storing nothing.
		honeypot: true,
		fields: [
			{
				type: 'text',
				name: 'name',
				label: 'Your name',
				required: true,
				min_length: 2,
				max_length: 120
			},
			{
				type: 'email',
				name: 'work_email',
				label: 'Work email',
				placeholder: 'you@company.com',
				required: true,
				max_length: 200,
				help_text: 'We reply from a person, not from a sequence.'
			},
			{
				type: 'text',
				name: 'company',
				label: 'Company',
				required: true,
				max_length: 160
			},
			{
				type: 'select',
				name: 'team_size',
				label: 'Engineers on the team',
				required: false,
				options: ['1 to 10', '11 to 50', '51 to 250', 'More than 250']
			},
			{
				type: 'select',
				name: 'topic',
				label: 'What is this about',
				required: true,
				options: [
					'Platform evaluation',
					'Migration from another provider',
					'Security or compliance review',
					'Support for an existing deployment'
				]
			},
			{
				type: 'textarea',
				name: 'message',
				label: 'Message',
				required: true,
				rows: 6,
				min_length: 20,
				max_length: 4000,
				placeholder: 'What are you running, where, and what is the deadline?'
			}
		]
	};

	await createContent(client, {
		schema: 'forms',
		slug: CONTACT_FORM,
		title: 'Talk to an engineer',
		body: {
			name: 'Talk to an engineer',
			slug: CONTACT_FORM,
			fields: layout,
			// No notify address. The form-submitted flow template mails a
			// submission to this address. Without a flow and a mail sender it
			// would be a promise nothing keeps.
			active: true
		}
	});
	console.log('contact form defined');
}

/**
 * Reads the ids of everything already in a content type, keyed by slug.
 *
 * The seed is small enough to fit in one page. A corpus that outgrew the
 * engine's 200-row ceiling would need to walk offsets instead.
 */
async function idsBySlug(schema: string): Promise<Map<string, string>> {
	const rows = await listContent<{ slug?: string }>(client, schema, { limit: 200 });
	const map = new Map<string, string>();
	for (const row of rows) {
		if (typeof row.data.slug === 'string') map.set(row.data.slug, row.id);
	}
	return map;
}

async function seedContent(): Promise<void> {
	let written = 0;

	const pageIds = await idsBySlug(PAGES);
	for (const page of PAGE_SEED) {
		if (pageIds.has(page.slug)) continue;
		await createContent(client, {
			schema: PAGES,
			slug: page.slug,
			title: page.title,
			body: {
				slug: page.slug,
				section: page.section,
				summary: page.summary,
				body: page.body
			}
		});
		written++;
	}

	const teamIds = await idsBySlug(TEAM);
	for (const member of TEAM_SEED) {
		if (teamIds.has(member.slug)) continue;
		const { id } = await createContent(client, {
			schema: TEAM,
			slug: member.slug,
			title: member.name,
			body: {
				slug: member.slug,
				role: member.role,
				location: member.location,
				bio: member.bio,
				sort_order: member.order
			}
		});
		teamIds.set(member.slug, id);
		written++;
	}

	const openingIds = await idsBySlug(OPENINGS);
	for (const role of OPENING_SEED) {
		if (openingIds.has(role.slug)) continue;
		await createContent(client, {
			schema: OPENINGS,
			slug: role.slug,
			title: role.title,
			body: {
				slug: role.slug,
				location: role.location,
				department: role.department,
				employment_type: role.employmentType,
				summary: role.summary,
				body: role.body,
				sort_order: role.order,
				// A relation is written under the field name and read back under
				// <field>_id. Populating on read is what turns it back into a
				// person. See docs/VERIFIED-RECIPE.md section 6.
				hiring_manager: teamIds.get(role.hiringManager)
			}
		});
		written++;
	}

	console.log(written === 0 ? 'company already seeded, nothing to do' : `seeded ${written} records`);
}

const PAGE_SEED = [
	{
		slug: 'home',
		section: 'main',
		title: 'Infrastructure you can point an auditor at',
		summary:
			'Basalt Networks runs dedicated network fabric and managed Postgres for teams whose regulator will not accept shared tenancy.',
		body: `Most platform teams do not leave the public cloud because it is slow. They leave because they cannot answer a simple question about it: which other companies were on that host, and what would it have taken for one of them to reach our data. On shared infrastructure the honest answer is a diagram and a promise.

We sell the other answer. Every Basalt customer gets its own routed segment, its own database hosts and its own encryption keys, provisioned from the same automation we use internally and handed over with the evidence that it happened. No neighbors, no noisy tenancy, no shrug in the incident review.

That costs more per gigabyte than a shared instance and we do not pretend otherwise. It costs less than the fourth month of an internal build that was scoped at six weeks, and considerably less than an enforcement action.

We are a small company on purpose. The person who picks up your escalation has commit rights on the thing that broke.`
	},
	{
		slug: 'about',
		section: 'main',
		title: 'About Basalt Networks',
		summary:
			"Founded in Amsterdam in 2019 by four engineers who had spent a decade carrying pagers for other people's platforms.",
		body: `Basalt started with a migration nobody wanted to run. A payments company had eighteen months of regulatory pressure and a Postgres fleet held together by three people who had all handed in their notice. We took the contract, moved the fleet onto dedicated hardware in two data centers, and wrote down every step because we knew we would be asked to prove it later.

We were asked to prove it later. That evidence pack became the product.

Today we run network fabric and managed database fleets for thirty one customers across financial services, health and public infrastructure. The largest keeps four hundred terabytes with us. The smallest is nine people. Both get the same on-call rota and the same twenty minute severity-one response.

We have taken no outside investment. Growth is funded by customers who renew, which is a slower way to build a company and a much better way to run one. It also means we can say no to work that would make the platform worse, and we have.

The team is deliberately senior and deliberately small. Everyone here has been woken up by a database at three in the morning, and it shows in how the platform is built.`
	},
	{
		slug: 'security-and-compliance',
		section: 'resources',
		title: 'Security and compliance',
		summary:
			'How customers are isolated, what we log, how long we keep it, and which reports we will hand your auditor.',
		body: `Isolation is physical before it is logical. Each customer is provisioned into its own routed segment with its own address space, its own database hosts and its own key material in a hardware security module we do not share. There is no multi-tenant control plane holding your data next to somebody else's row.

Encryption keys are customer-held by default. We can operate the platform without being able to read the contents of your databases, and for regulated customers that is the configuration we recommend and the one most of them run. It costs you a slower recovery path if you lose the key, which is a trade we will discuss rather than decide for you.

Access to production requires hardware-backed authentication, a named change record and a second engineer. Every session is recorded. Records are retained for thirteen months, which covers an annual audit cycle plus a month of overlap, and they are written to storage we cannot silently rewrite.

We hold ISO 27001 and complete a SOC 2 Type II every year. Both reports go out under NDA, along with the most recent penetration test and the remediation status of everything it found. We will not send you a marketing summary and call it evidence.

Vulnerability disclosure goes to security at our domain. We acknowledge within one working day, we do not require you to sign anything before reporting, and we will credit you unless you ask us not to.`
	}
];

const TEAM_SEED = [
	{
		slug: 'priya-raghunathan',
		name: 'Priya Raghunathan',
		role: 'Chief Executive Officer',
		location: 'Amsterdam',
		order: 10,
		bio: 'Ran platform engineering for a European payments processor through two regulatory audits and one very public outage. Founded Basalt to sell the runbook rather than the panic.'
	},
	{
		slug: 'tomas-lindqvist',
		name: 'Tomas Lindqvist',
		role: 'Chief Technology Officer',
		location: 'Amsterdam',
		order: 20,
		bio: 'Spent eleven years on network hardware before deciding that the interesting problems had moved up the stack. Owns the fabric design and still writes the BGP policy by hand.'
	},
	{
		slug: 'adaeze-okonkwo',
		name: 'Adaeze Okonkwo',
		role: 'VP of Engineering',
		location: 'Lisbon',
		order: 30,
		bio: 'Joined from a database vendor where she led the storage engine team. Cares more about the median recovery time than the record throughput, which is why the platform is boring in the right places.'
	},
	{
		slug: 'martin-hsieh',
		name: 'Martin Hsieh',
		role: 'Head of Site Reliability',
		location: 'Singapore',
		order: 40,
		bio: 'Built the on-call rota that covers three time zones without anyone taking a night shift. Writes the incident reviews and insists they are published internally within a week.'
	},
	{
		slug: 'clara-bengtsson',
		name: 'Clara Bengtsson',
		role: 'Director of Security',
		location: 'Stockholm',
		order: 50,
		bio: 'Came out of offensive security and now spends her time making the platform less interesting to people who do what she used to do. Owns the disclosure process and answers it personally.'
	},
	{
		slug: 'idris-farah',
		name: 'Idris Farah',
		role: 'Head of Customer Engineering',
		location: 'London',
		order: 60,
		bio: 'Runs every migration from the first architecture session to the cutover weekend. Has moved forty one platforms and lost data on none of them, a record he mentions rarely and remembers exactly.'
	}
];

const OPENING_SEED = [
	{
		slug: 'senior-site-reliability-engineer',
		title: 'Senior Site Reliability Engineer',
		location: 'Amsterdam',
		department: 'Infrastructure',
		employmentType: 'Full time',
		order: 10,
		hiringManager: 'martin-hsieh',
		summary:
			'Own the reliability of a fleet of dedicated Postgres clusters across two European data centers.',
		body: `You will be one of six people responsible for keeping customer databases available, and one of the people the escalation reaches when they are not. That means capacity planning, failover testing that actually fails things over, and the unglamorous work of making alerts mean something.

We run our own hardware in two facilities and a small public cloud footprint for control-plane services. The stack is Postgres, Patroni, Ceph, and a lot of Go. You do not need to have used all of it. You do need to have carried a pager for something that mattered.

The on-call rota is one week in six and covered across three time zones, so nobody works nights. Incidents get a written review within a week and the review is read.

We are looking for someone who has already learned, expensively, why a runbook is worth writing. Six or more years in an operations role, comfortable in a terminal, comfortable saying that a change is not ready.`
	},
	{
		slug: 'database-platform-engineer',
		title: 'Database Platform Engineer',
		location: 'Remote, European Union',
		department: 'Infrastructure',
		employmentType: 'Full time',
		order: 20,
		hiringManager: 'adaeze-okonkwo',
		summary:
			'Build the automation that provisions, upgrades and restores customer database fleets without a human in the path.',
		body: `Provisioning a new customer environment is currently a two-day job with three manual steps we do not like. Your first project is removing them.

After that the work is the backup and restore path: proving that every cluster can be recovered to a point in time, on a schedule, without anyone being asked to check. We restore from backup weekly on purpose and we would like that to be daily.

The code is Go with a Postgres control plane. Experience with logical replication, major-version upgrades under load, and the specific ways pg_upgrade disappoints people is worth more here than any particular framework.

This role is fully remote within the European Union. We meet in Amsterdam for three days once a quarter and pay for the travel.`
	},
	{
		slug: 'security-engineer-detection-and-response',
		title: 'Security Engineer, Detection and Response',
		location: 'Stockholm',
		department: 'Security',
		employmentType: 'Full time',
		order: 30,
		hiringManager: 'clara-bengtsson',
		summary:
			'Turn the platform audit trail into detections that fire on real behavior and stay quiet the rest of the time.',
		body: `We log a great deal and detect less of it than we should. You will close that gap: build the detection pipeline, write the rules, and own the false-positive rate as a number you are accountable for.

The interesting constraint is that customers hold their own encryption keys, so a large amount of the data is opaque to us by design. Detection has to work from metadata, access patterns and control-plane behavior rather than from content. That is harder and considerably more interesting.

You will also run the response side: the first-hour playbook, the customer notification path, and the post-incident write-up. Regulated customers have notification clocks measured in hours, so the process has to work when it is inconvenient.

Four or more years in detection engineering or incident response. Offensive security experience is welcome and not required.`
	},
	{
		slug: 'enterprise-account-executive-dach',
		title: 'Enterprise Account Executive, DACH',
		location: 'Munich',
		department: 'Revenue',
		employmentType: 'Full time',
		order: 40,
		hiringManager: 'idris-farah',
		summary:
			'Open the German-speaking market for a technical product sold to people who will read the architecture diagram.',
		body: `Our buyers are heads of platform and heads of risk, often in the same room and rarely agreeing. Deals run six to nine months, involve a security questionnaire measured in hundreds of rows, and are won by being straight about what the platform does not do.

You will be the first commercial hire in the region, working from Munich with engineering support from Amsterdam. There is a pipeline to inherit and a longer list of accounts nobody has called yet.

We do not run a script and we do not chase quarter-end. Compensation is base plus commission with no cap, and the commission plan is the same one everyone in revenue is on, published internally.

Five or more years selling infrastructure or data platforms to regulated enterprises. Fluent German and English. Comfortable saying that a prospect is a bad fit before the third meeting.`
	}
];

// The seed arrays below are const bindings, so nothing may read them until the
// module body has finished evaluating. The two calls sit here for that reason.
await ensureFormsPreset();
await ensureContactForm();
await seedContent();
