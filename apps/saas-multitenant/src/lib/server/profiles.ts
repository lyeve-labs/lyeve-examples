import {
	createContent,
	listContent,
	related,
	relationId,
	type ContentEntry,
	type LyeveClient
} from '../lyeve/index.ts';
import { PLANS, PROFILES } from '../schemas.ts';

/**
 * The customer record that sits beside the engine's tenant row.
 *
 * `sys_tenants` holds a slug, a display name, a plan string and an enabled
 * flag, and nothing else. The billing contact, the region and the account notes
 * are application data, so they live in a content type like anything else.
 *
 * Every profile is written under the operator's own tenant, not the customer's.
 * It is the control panel's data about the customer, not the customer's data.
 */

export interface PlanData {
	title: string;
	slug: string;
	summary?: string;
	monthly_price_usd?: number;
	included_requests?: number;
	included_storage_mb?: number;
	included_bandwidth_gb?: number;
}

export interface ProfileData {
	title: string;
	slug: string;
	/** The engine tenant slug. The join key between content and sys_tenants. */
	tenant_slug: string;
	contact_name?: string;
	contact_email?: string;
	region?: string;
	notes?: string;
	logo_media_id?: string;
}

export interface Profile {
	id: string;
	title: string;
	tenantSlug: string;
	contactName: string;
	contactEmail: string;
	region: string;
	notes: string;
	logoId: string | null;
	planId: string | null;
	planTitle: string | null;
}

export async function listPlans(client: LyeveClient): Promise<ContentEntry<PlanData>[]> {
	return listContent<PlanData>(client, PLANS, { limit: 200 });
}

/**
 * Profiles with their plan inflated in one round trip.
 *
 * Without `populate` the relation reads back as `plan_id` and the bare `plan`
 * key is null, so the plan name would cost one request per row.
 */
export async function listProfiles(client: LyeveClient): Promise<Profile[]> {
	const rows = await listContent<ProfileData>(client, PROFILES, {
		limit: 200,
		populate: ['plan']
	});
	return rows.map(toProfile);
}

export async function getProfile(
	client: LyeveClient,
	tenantSlug: string
): Promise<Profile | null> {
	// filters[] is exact equality, which is all a lookup by join key needs.
	const [row] = await listContent<ProfileData>(client, PROFILES, {
		limit: 25,
		filters: { tenant_slug: tenantSlug },
		populate: ['plan']
	});
	return row ? toProfile(row) : null;
}

export interface NewProfile {
	tenantSlug: string;
	companyName: string;
	contactName: string;
	contactEmail: string;
	region: string;
	notes?: string;
	planId?: string | null;
}

/** Returns the existing profile untouched when the tenant already has one. */
export async function ensureProfile(client: LyeveClient, input: NewProfile): Promise<Profile> {
	const existing = await getProfile(client, input.tenantSlug);
	if (existing) return existing;

	await createContent(client, {
		schema: PROFILES,
		// Content slugs are unique per tenant across every schema, not per
		// schema, so a bare "northwind" would collide with any other example
		// that used it. Prefixing is not decoration.
		slug: contentSlugFor(input.tenantSlug),
		title: input.companyName,
		body: {
			slug: contentSlugFor(input.tenantSlug),
			tenant_slug: input.tenantSlug,
			contact_name: input.contactName,
			contact_email: input.contactEmail,
			region: input.region,
			notes: input.notes ?? '',
			// A relation is written under its own name and read back as
			// `<field>_id`. Passing null would fail validation, so an unset plan
			// is simply omitted.
			...(input.planId ? { plan: input.planId } : {})
		}
	});

	const created = await getProfile(client, input.tenantSlug);
	if (!created) throw new Error(`profile for ${input.tenantSlug} was written but did not read back`);
	return created;
}

function contentSlugFor(tenantSlug: string): string {
	return `saas-profile-${tenantSlug.replace(/_/g, '-')}`;
}

function toProfile(row: ContentEntry<ProfileData>): Profile {
	const data = row.data as unknown as Record<string, unknown>;
	return {
		id: row.id,
		title: row.data.title,
		tenantSlug: row.data.tenant_slug,
		contactName: row.data.contact_name ?? '',
		contactEmail: row.data.contact_email ?? '',
		region: row.data.region ?? '',
		notes: row.data.notes ?? '',
		logoId: row.data.logo_media_id || null,
		planId: relationId(data, 'plan'),
		planTitle: related<{ title: string }>(data, 'plan')?.title ?? null
	};
}
