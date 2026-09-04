/**
 * Creates the status board's content types and seeds a plausible history.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the board already has services.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const SERVICES = 'status_services';
const INCIDENTS = 'status_incidents';
const UPDATES = 'status_updates';

// Order matters: a relation emits a foreign key against the target's generated
// table, so services must exist before incidents reference them, and incidents
// before their timeline entries do.
//
// No field here is called `status`. An admin write publishes the whole
// sys_content_entries row on the event stream, and that row already has a
// `status` of its own for draft and published, so a schema field of the same
// name is shadowed on every live event. The field that carries investigating,
// identified, monitoring and resolved is called `state` for that reason.
await applySchemas(client, [
	{
		name: SERVICES,
		display_name: 'Services',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'description', field_type: 'text' }
		]
	},
	{
		name: INCIDENTS,
		display_name: 'Incidents',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'severity', field_type: 'text', indexed: true },
			{ name: 'state', field_type: 'text', indexed: true },
			{ name: 'opened_at', field_type: 'datetime' },
			{ name: 'resolved_at', field_type: 'datetime' },
			belongsTo('service', SERVICES)
		]
	},
	{
		name: UPDATES,
		display_name: 'Incident updates',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'state', field_type: 'text' },
			{ name: 'posted_at', field_type: 'datetime' },
			belongsTo('incident', INCIDENTS)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, SERVICES, { limit: 25 })).length > 0) {
	console.log('board already seeded, nothing to do');
	process.exit(0);
}

/**
 * Seed times are relative to the run. A fixed date reads as a live board this
 * week and as an abandoned one next month.
 */
function hoursAgo(hours: number, minutes = 0): string {
	return new Date(Date.now() - (hours * 60 + minutes) * 60_000).toISOString();
}

const services = [
	{
		slug: 'status-service-api',
		title: 'Public API',
		description: 'REST and GraphQL, all regions'
	},
	{
		slug: 'status-service-dashboard',
		title: 'Dashboard',
		description: 'app.meridian.example'
	},
	{
		slug: 'status-service-checkout',
		title: 'Checkout',
		description: 'Card and bank transfer capture'
	},
	{
		slug: 'status-service-webhooks',
		title: 'Webhook delivery',
		description: 'Outbound delivery and retries'
	},
	{
		slug: 'status-service-search',
		title: 'Search indexing',
		description: 'Index writes and query serving'
	}
];

const serviceIds: Record<string, string> = {};
for (const service of services) {
	const { id } = await createContent(client, {
		schema: SERVICES,
		slug: service.slug,
		title: service.title,
		body: { slug: service.slug, description: service.description }
	});
	serviceIds[service.slug] = id;
}

interface SeedIncident {
	slug: string;
	title: string;
	service: string;
	severity: 'minor' | 'major' | 'critical';
	state: 'investigating' | 'identified' | 'monitoring' | 'resolved';
	openedAt: string;
	resolvedAt?: string;
	summary: string;
	timeline: { state: SeedIncident['state']; postedAt: string; summary: string }[];
}

const incidents: SeedIncident[] = [
	{
		slug: 'status-webhook-retry-backlog',
		title: 'Webhook deliveries queued behind a retry backlog',
		service: 'status-service-webhooks',
		severity: 'minor',
		state: 'monitoring',
		openedAt: hoursAgo(3, 40),
		summary:
			'A downstream endpoint returning 500s filled the shared retry queue, and deliveries to healthy endpoints are waiting behind it.',
		timeline: [
			{
				state: 'investigating',
				postedAt: hoursAgo(3, 40),
				summary:
					'Delivery latency for outbound webhooks is above ten minutes. We are looking at the retry queue.'
			},
			{
				state: 'identified',
				postedAt: hoursAgo(2, 55),
				summary:
					'One customer endpoint has been returning 500 for two hours and its retries were sharing a queue with everyone else. We have moved it to its own queue and capped its retry rate.'
			},
			{
				state: 'monitoring',
				postedAt: hoursAgo(1, 20),
				summary:
					'The backlog has drained and delivery latency is back under fifteen seconds. Watching for another hour before we close this.'
			}
		]
	},
	{
		slug: 'status-checkout-eu-west-502',
		title: 'Checkout returning 502s in eu-west',
		service: 'status-service-checkout',
		severity: 'critical',
		state: 'resolved',
		openedAt: hoursAgo(31),
		resolvedAt: hoursAgo(28, 10),
		summary:
			'A connection pool sized for the old instance count ran out after a scale-down, and checkout requests in eu-west failed at the gateway.',
		timeline: [
			{
				state: 'investigating',
				postedAt: hoursAgo(31),
				summary:
					'Card capture is failing for a large share of requests in eu-west. Other regions are unaffected. Payments are not being taken twice.'
			},
			{
				state: 'identified',
				postedAt: hoursAgo(30, 25),
				summary:
					'A scale-down last night left the checkout service with a connection pool sized for four instances rather than twelve. Requests are queuing until the gateway gives up.'
			},
			{
				state: 'monitoring',
				postedAt: hoursAgo(29, 30),
				summary:
					'Pool size corrected and the region is serving normally. We are replaying the failed captures and will contact anyone charged incorrectly, though we have found none so far.'
			},
			{
				state: 'resolved',
				postedAt: hoursAgo(28, 10),
				summary:
					'Error rates have been at baseline for the last hour and all 1,204 failed captures have been replayed. The pool size is now derived from the instance count rather than set by hand.'
			}
		]
	},
	{
		slug: 'status-search-index-lag',
		title: 'Search results up to ten minutes behind',
		service: 'status-service-search',
		severity: 'minor',
		state: 'resolved',
		openedAt: hoursAgo(76),
		resolvedAt: hoursAgo(73, 45),
		summary:
			'A reindex of the largest tenant saturated the index writer and pushed everyone else behind it.',
		timeline: [
			{
				state: 'identified',
				postedAt: hoursAgo(76),
				summary:
					'A manual reindex started this morning is consuming the whole index writer. New content is searchable, but up to ten minutes late.'
			},
			{
				state: 'resolved',
				postedAt: hoursAgo(73, 45),
				summary:
					'The reindex finished and lag is back under five seconds. Reindex jobs now run at a lower priority than live writes.'
			}
		]
	}
];

for (const incident of incidents) {
	const { id } = await createContent(client, {
		schema: INCIDENTS,
		slug: incident.slug,
		title: incident.title,
		body: {
			slug: incident.slug,
			summary: incident.summary,
			severity: incident.severity,
			state: incident.state,
			opened_at: incident.openedAt,
			...(incident.resolvedAt ? { resolved_at: incident.resolvedAt } : {}),
			// Relations are written under the field name and read back as
			// `<field>_id`.
			service: serviceIds[incident.service]
		}
	});

	let n = 0;
	for (const entry of incident.timeline) {
		n += 1;
		const slug = `${incident.slug}-update-${n}`;
		await createContent(client, {
			schema: UPDATES,
			slug,
			title: `${incident.title}: ${entry.state}`.slice(0, 200),
			body: {
				slug,
				summary: entry.summary,
				state: entry.state,
				posted_at: entry.postedAt,
				incident: id
			}
		});
	}
}

const entries = incidents.reduce((n, i) => n + i.timeline.length, 0);
console.log(`seeded ${services.length} services, ${incidents.length} incidents, ${entries} updates`);
