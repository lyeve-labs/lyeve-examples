import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { findReaderByEmail, listReaders } from '$lib/server/members';
import { describeQuota, readEntitlements } from '$lib/server/entitlements';
import { SESSION_COOKIE, signReaderId } from '$lib/server/session';
import type { Reader } from '$lib/server/tiers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { reader } = await parent();

	// The roster is only fetched for the signed-out page that displays it. A
	// signed-in reader has no business receiving the subscriber list.
	const wanted: Promise<Reader[]> = reader ? Promise.resolve([]) : listReaders();
	const [entitlements, roster] = await Promise.all([readEntitlements(), wanted]);

	return {
		reader,
		entitlements: entitlements && {
			plan: entitlements.plan,
			state: entitlements.state,
			features: entitlements.features,
			quota: describeQuota(entitlements.tenant_quota)
		},
		// Shown because the demo has no sign-up and no password. A real site
		// would never publish its subscriber list.
		roster: roster.map((r) => ({ email: r.email, name: r.name, tier: r.tier, status: r.status }))
	};
};

export const actions: Actions = {
	signin: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');

		const reader = await findReaderByEmail(email);
		if (!reader) return fail(400, { email, error: 'No member is registered with that email.' });

		cookies.set(SESSION_COOKIE, signReaderId(reader.id), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24 * 7
		});
		redirect(303, '/account');
	},

	signout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/');
	}
};
