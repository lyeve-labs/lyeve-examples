import { lyeve } from './lyeve';

/**
 * What `GET /api/admin/entitlements` returns, verified against a running
 * engine. The route deliberately exposes no license id, instance id or expiry:
 * only the plan, its state, the feature list the engine actually enforces, and
 * the tenant ceiling.
 */
export interface Entitlements {
	plan: string;
	state: string;
	features: string[];
	tenant_quota: number;
}

/**
 * Reads the engine's own license state.
 *
 * The route sits behind an admin role, so this works only because the
 * server-side credential is an admin one. It is an operator panel that happens
 * to be rendered here. A production site would put it behind its own staff
 * check rather than on a page any reader can reach.
 */
export async function readEntitlements(): Promise<Entitlements | null> {
	try {
		const res = await lyeve.request<Entitlements>('admin', '/api/admin/entitlements');
		return {
			plan: res.plan,
			state: res.state,
			features: Array.isArray(res.features) ? res.features : [],
			tenant_quota: typeof res.tenant_quota === 'number' ? res.tenant_quota : 0
		};
	} catch {
		// The route is admin-only, and a content page must not fail because the
		// credential cannot read it, so the panel degrades instead.
		return null;
	}
}

/** The engine treats a quota of zero as no ceiling, not as a ceiling of none. */
export function describeQuota(quota: number): string {
	return quota === 0 ? 'unlimited' : String(quota);
}
