/**
 * The engine's audit trail, filtered to the DSAR operations.
 *
 * The filter names are worth getting right, because a wrong one is not an
 * error. `GET /api/admin/audit-log` reads only the parameters it knows and
 * ignores the rest, so `?resource=gdpr_dsar` or `?type=...` returns the whole
 * log and looks like a filter that matched everything.
 *
 * The ones that exist: `actor` (a user UUID, and a malformed one is a 400),
 * `action`, `resource_type`, `resource_id`, `from` and `to` (RFC 3339, and `to`
 * must be after `from`), `tenant_id`, `limit` (default 50, capped at 500) and
 * `offset`.
 *
 * Every one of them is exact equality. There is no prefix match, so "every
 * gdpr.* action" is not one request: it is either one request per action name,
 * or the `resource_type` both of them share. This app uses the shared
 * resource_type, which is the cheaper half of that choice.
 */
import { lyeve } from './lyeve';

/** Both DSAR handlers file under this resource_type, whatever the action. */
export const DSAR_RESOURCE_TYPE = 'gdpr_dsar';

/**
 * The namespaced actions the DSAR handlers write. `gdpr.export.all_tenants` is
 * a separate action from `gdpr.export` rather than a flag on it, because an
 * cross-tenant export reads every tenant's data for one identifier and the trail
 * has to say that is what happened.
 */
export const DSAR_ACTIONS = ['gdpr.export', 'gdpr.export.all_tenants', 'gdpr.erase'] as const;
export type DsarAction = (typeof DSAR_ACTIONS)[number];

export interface AuditEntry {
	id: string;
	sequence: number;
	tenantId: string;
	userId: string | null;
	action: string;
	resourceType: string;
	resourceId: string;
	ip: string;
	userAgent: string;
	createdAt: string;
	chainHash: string;
}

export interface AuditPage {
	entries: AuditEntry[];
	total: number;
	limit: number;
	offset: number;
	/**
	 * The log had entries still queued when the total was counted, so the total
	 * is short by an unknown amount. Writes are asynchronous, and a read that
	 * cannot confirm the queue drained says so rather than answering a number
	 * that looks settled.
	 */
	pendingWrites: boolean;
}

export interface AuditQuery {
	action?: string;
	resourceType?: string;
	from?: string;
	to?: string;
	limit?: number;
	offset?: number;
}

export async function loadAudit(query: AuditQuery): Promise<AuditPage> {
	const q = new URLSearchParams();
	if (query.action) q.set('action', query.action);
	if (query.resourceType) q.set('resource_type', query.resourceType);
	if (query.from) q.set('from', query.from);
	if (query.to) q.set('to', query.to);
	q.set('limit', String(query.limit ?? 50));
	q.set('offset', String(query.offset ?? 0));

	const res = await lyeve.request<{
		data?: RawAuditEntry[];
		total?: number;
		limit?: number;
		offset?: number;
		pending_writes?: boolean;
	}>('admin', `/api/admin/audit-log?${q.toString()}`);

	return {
		entries: (res.data ?? []).map(toEntry),
		total: res.total ?? 0,
		limit: res.limit ?? 50,
		offset: res.offset ?? 0,
		pendingWrites: res.pending_writes ?? false
	};
}

/**
 * How many entries each DSAR action holds.
 *
 * One request per action, because `action` is exact equality and the engine
 * offers no group-by. Three requests to fill three numbers is the honest cost
 * of a counter on this route.
 */
export async function loadDsarCounts(): Promise<Record<DsarAction, number>> {
	const pages = await Promise.all(
		DSAR_ACTIONS.map((action) => loadAudit({ action, limit: 25 }))
	);
	const counts = {} as Record<DsarAction, number>;
	DSAR_ACTIONS.forEach((action, i) => {
		counts[action] = pages[i].total;
	});
	return counts;
}

/**
 * Reports whether a value arrived masked.
 *
 * The audit route is not on the masking middleware's exempt list, so an
 * identifier that is an address comes back as the replacement token and the
 * trail cannot say which subject an export was about. An identifier that is an
 * account id arrives intact, because a UUID matches no rule. The page shows
 * which of the two happened rather than presenting a placeholder as the value.
 */
export function isMasked(value: string): boolean {
	return /^\[redacted-[a-z]+\]$/.test(value.trim());
}

interface RawAuditEntry {
	id: string;
	sequence?: number;
	tenant_id?: string;
	user_id?: string | null;
	action?: string;
	resource_type?: string;
	resource_id?: string;
	ip?: string;
	user_agent?: string;
	created_at?: string;
	chain_hash?: string;
}

function toEntry(raw: RawAuditEntry): AuditEntry {
	return {
		id: raw.id,
		sequence: raw.sequence ?? 0,
		tenantId: raw.tenant_id ?? '',
		userId: raw.user_id ?? null,
		action: raw.action ?? '',
		resourceType: raw.resource_type ?? '',
		resourceId: raw.resource_id ?? '',
		ip: raw.ip ?? '',
		userAgent: raw.user_agent ?? '',
		createdAt: raw.created_at ?? '',
		chainHash: raw.chain_hash ?? ''
	};
}
