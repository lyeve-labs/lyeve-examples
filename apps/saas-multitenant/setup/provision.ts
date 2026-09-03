/**
 * Creates this example's content types, three demo tenants and their keys.
 *
 * Safe to run more than once: applying a schema that exists is accepted, a
 * tenant whose slug is taken is reused, a profile that exists is left alone,
 * a quota is an upsert, and a tenant that already holds a key gets no second
 * one.
 */
import { applySchemas, belongsTo, createContent, LyeveError, lyeveFromEnv } from '../src/lib/lyeve/index.ts';
import { PLANS, PROFILES, TENANT_PREFIX } from '../src/lib/schemas.ts';
import { ensureTenant, listApiKeys, mintApiKey, upsertQuota } from '../src/lib/server/platform.ts';
import { ensureProfile, listPlans } from '../src/lib/server/profiles.ts';

const client = lyeveFromEnv();

const MB = 1024 * 1024;
const GB = 1024 * MB;

// Order matters: the relation on a profile emits a foreign key against the
// plans table, so plans must exist before profiles points at them.
await applySchemas(client, [
	{
		name: PLANS,
		display_name: 'Plans',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'monthly_price_usd', field_type: 'number' },
			{ name: 'included_requests', field_type: 'number' },
			{ name: 'included_storage_mb', field_type: 'number' },
			{ name: 'included_bandwidth_gb', field_type: 'number' }
		]
	},
	{
		name: PROFILES,
		display_name: 'Tenant profiles',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			// The join key back to sys_tenants. The engine offers no relation to
			// a tenant, so the slug is carried as an indexed column.
			{ name: 'tenant_slug', field_type: 'text', required: true, indexed: true },
			{ name: 'contact_name', field_type: 'text' },
			{ name: 'contact_email', field_type: 'email' },
			{ name: 'region', field_type: 'text' },
			{ name: 'notes', field_type: 'text' },
			{ name: 'logo_media_id', field_type: 'text' },
			belongsTo('plan', PLANS)
		]
	}
]);
console.log('content types ready');

const planSeeds = [
	{
		slug: 'starter',
		title: 'Starter',
		price: 49,
		requests: 250_000,
		storageMb: 5_000,
		bandwidthGb: 100,
		summary: 'One project, one region, and email support answered inside a business day.'
	},
	{
		slug: 'growth',
		title: 'Growth',
		price: 199,
		requests: 2_000_000,
		storageMb: 50_000,
		bandwidthGb: 1_000,
		summary: 'Separate staging and production projects, scheduled exports, a 99.9 percent availability target.'
	},
	{
		slug: 'scale',
		title: 'Scale',
		price: 749,
		requests: 10_000_000,
		storageMb: 250_000,
		bandwidthGb: 5_000,
		summary: 'Multi-region reads, a named account engineer, and a one hour first response on severity one.'
	}
];

const existingPlans = await listPlans(client);
const seededPlanSlugs = new Set(existingPlans.map((p) => p.data.slug));

for (const plan of planSeeds) {
	if (seededPlanSlugs.has(plan.slug)) continue;
	await createContent(client, {
		schema: PLANS,
		// Content slugs are unique per tenant across every schema, not per
		// schema, so every example has to prefix its own.
		slug: `saas-plan-${plan.slug}`,
		title: plan.title,
		body: {
			slug: plan.slug,
			summary: plan.summary,
			monthly_price_usd: plan.price,
			included_requests: plan.requests,
			included_storage_mb: plan.storageMb,
			included_bandwidth_gb: plan.bandwidthGb
		}
	});
	console.log(`plan ${plan.slug} created`);
}

const plans = await listPlans(client);
const planBySlug = new Map(plans.map((p) => [p.data.slug, p]));

const tenantSeeds = [
	{
		handle: 'northwind',
		name: 'Northwind Trading Co',
		plan: 'growth',
		contactName: 'Priya Raman',
		contactEmail: 'priya.raman@northwind-trading.example',
		region: 'eu-west-1',
		notes: 'Moved off a self-hosted install in March. Staging and production still share one key, which is on the list to split.',
		keyName: 'Northwind storefront renderer',
		keyLimit: 0
	},
	{
		handle: 'calder_labs',
		name: 'Calder Labs',
		plan: 'starter',
		contactName: 'Tomas Berg',
		contactEmail: 'tomas.berg@calderlabs.example',
		region: 'us-east-1',
		notes: 'Research group with spiky traffic around publication dates. Left on a soft limit on purpose, so a spike degrades instead of failing.',
		keyName: 'Calder Labs figure exporter',
		keyLimit: 50_000
	},
	{
		handle: 'meridian_freight',
		name: 'Meridian Freight',
		plan: 'scale',
		contactName: 'Ana Duarte',
		contactEmail: 'ana.duarte@meridianfreight.example',
		region: 'ap-southeast-2',
		notes: 'Drives a public tracking portal off scheduled reads every ninety seconds. Bandwidth is the line that matters here, not request count.',
		keyName: 'Meridian tracking portal',
		keyLimit: 0
	}
];

for (const seed of tenantSeeds) {
	const slug = `${TENANT_PREFIX}${seed.handle}`;
	const plan = planBySlug.get(seed.plan);
	if (!plan) throw new Error(`plan ${seed.plan} was seeded but did not read back`);

	try {
		await ensureTenant(client, { slug, name: seed.name, plan: seed.plan });
	} catch (err) {
		if (err instanceof LyeveError && err.status === 402) {
			console.error(
				`tenant ${slug} refused: this license does not grant tenant provisioning, or its tenant ceiling is reached`
			);
			process.exit(1);
		}
		throw err;
	}

	await ensureProfile(client, {
		tenantSlug: slug,
		companyName: seed.name,
		contactName: seed.contactName,
		contactEmail: seed.contactEmail,
		region: seed.region,
		notes: seed.notes,
		planId: plan.id
	});

	await upsertQuota(client, slug, {
		requests_limit: plan.data.included_requests ?? 0,
		storage_bytes_limit: (plan.data.included_storage_mb ?? 0) * MB,
		bandwidth_bytes_limit: (plan.data.included_bandwidth_gb ?? 0) * GB,
		is_hard_limit: false,
		block_on_exceeded: false
	});

	// The raw key is returned exactly once and is deliberately not printed. A
	// seeded key exists so the tenant page has rows to show and so the usage
	// plugin recognizes the tenant at all. Mint a fresh one from the UI when you
	// want a secret you can actually use.
	const keys = await listApiKeys(client, slug);
	if (keys.length === 0) {
		await mintApiKey(client, slug, {
			name: seed.keyName,
			scopes: ['content:read', 'schemas:read'],
			monthly_limit: seed.keyLimit
		});
	}

	console.log(`tenant ${slug} ready on the ${seed.plan} plan`);
}

console.log(`seeded ${planSeeds.length} plans and ${tenantSeeds.length} tenants`);
