import { fail, redirect } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { lyeve } from '$lib/server/lyeve';
import { TENANT_PREFIX } from '$lib/schemas';
import { ensureTenant, listQuotas, listTenants, upsertQuota } from '$lib/server/platform';
import { ensureProfile, listPlans, listProfiles } from '$lib/server/profiles';
import type { Actions, PageServerLoad } from './$types';

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

export const load: PageServerLoad = async () => {
	// The roster, the customer records and the limits come from three different
	// plugins with no join between them. The slug is the only key they share.
	const [tenants, profiles, quotas, plans] = await Promise.all([
		listTenants(lyeve),
		listProfiles(lyeve),
		listQuotas(lyeve),
		listPlans(lyeve)
	]);

	const profileBySlug = new Map(profiles.map((p) => [p.tenantSlug, p]));
	const quotaBySlug = new Map(quotas.map((q) => [q.tenant_id, q]));

	const rows = tenants
		.filter((t) => t.slug.startsWith(TENANT_PREFIX))
		.map((tenant) => {
			const profile = profileBySlug.get(tenant.slug);
			const quota = quotaBySlug.get(tenant.slug);
			return {
				id: tenant.id,
				slug: tenant.slug,
				name: tenant.name,
				plan: tenant.plan,
				enabled: tenant.enabled,
				archived: tenant.archived,
				createdAt: tenant.created_at,
				planTitle: profile?.planTitle ?? null,
				contactName: profile?.contactName ?? '',
				region: profile?.region ?? '',
				hasProfile: Boolean(profile),
				requestsLimit: quota?.requests_limit ?? 0,
				blocked: Boolean(quota?.blocked_at)
			};
		})
		// The engine has no sort parameter and returns rows created_at DESC.
		// Alphabetical is what an operations list wants, so it is applied here.
		.sort((a, b) => a.name.localeCompare(b.name));

	return {
		tenants: rows,
		plans: plans.map((p) => ({
			id: p.id,
			slug: p.data.slug,
			title: p.data.title,
			summary: p.data.summary ?? '',
			price: p.data.monthly_price_usd ?? 0,
			requests: p.data.included_requests ?? 0,
			storageMb: p.data.included_storage_mb ?? 0,
			bandwidthGb: p.data.included_bandwidth_gb ?? 0
		}))
	};
};

const HANDLE = /^[a-z][a-z0-9_]{1,40}$/;

export const actions = {
	/**
	 * Provisions one customer across three plugins: the tenant row, the profile
	 * entry and the quota. There is no transaction spanning them, so each step
	 * is written to be safe to repeat and a failed submission can simply be
	 * sent again.
	 */
	create: async ({ request }) => {
		const form = await request.formData();
		const handle = String(form.get('handle') ?? '').trim().toLowerCase();
		const company = String(form.get('company') ?? '').trim();
		const contactName = String(form.get('contact_name') ?? '').trim();
		const contactEmail = String(form.get('contact_email') ?? '').trim();
		const region = String(form.get('region') ?? '').trim();
		const planId = String(form.get('plan') ?? '').trim();

		const values = { handle, company, contactName, contactEmail, region, planId };

		if (!company) return fail(400, { ...values, error: 'A company name is required.' });
		if (!HANDLE.test(handle)) {
			return fail(400, {
				...values,
				error: 'The handle must start with a letter and hold only lowercase letters, digits and underscores.'
			});
		}
		if (!contactEmail.includes('@')) {
			return fail(400, { ...values, error: 'A billing contact email is required.' });
		}

		const plans = await listPlans(lyeve);
		const plan = plans.find((p) => p.id === planId);
		if (!plan) return fail(400, { ...values, error: 'Choose a plan.' });

		// Every example shares one engine, so a tenant this app creates carries
		// a prefix that keeps it out of everyone else's roster.
		const slug = `${TENANT_PREFIX}${handle}`;

		try {
			await ensureTenant(lyeve, { slug, name: company, plan: plan.data.slug });

			await ensureProfile(lyeve, {
				tenantSlug: slug,
				companyName: company,
				contactName,
				contactEmail,
				region: region || 'unassigned',
				planId: plan.id
			});

			await upsertQuota(lyeve, slug, {
				requests_limit: plan.data.included_requests ?? 0,
				storage_bytes_limit: (plan.data.included_storage_mb ?? 0) * MB,
				bandwidth_bytes_limit: (plan.data.included_bandwidth_gb ?? 0) * GB,
				is_hard_limit: false,
				block_on_exceeded: false
			});
		} catch (err) {
			if (err instanceof LyeveError && err.status === 402) {
				return fail(402, {
					...values,
					error: 'This license does not grant tenant provisioning, or its tenant ceiling is reached.'
				});
			}
			return fail(502, {
				...values,
				error: err instanceof LyeveError ? err.message : 'The engine refused the request.'
			});
		}

		redirect(303, `/tenants/${slug}`);
	}
} satisfies Actions;
