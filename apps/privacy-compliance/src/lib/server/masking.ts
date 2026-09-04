/**
 * The response-masking rules, and the log of every response that carried PII.
 *
 * Both routes are reads. There is no POST: the rule set is compiled into the
 * plugin, in a fixed priority order, and nothing on the HTTP surface adds to it
 * or turns one off. A masking policy is a deploy, not a setting.
 */
import { lyeve } from './lyeve';

export interface MaskRule {
	name: string;
	description: string;
	pattern: string;
	replacement: string;
	priority: number;
}

export interface RuleSet {
	rules: MaskRule[];
	tags: { tag: string; meaning: string }[];
	/**
	 * Rules whose own description came back masked. The middleware rewrites
	 * every JSON response on the admin router that is not on the exempt list,
	 * and this route is not on it, so a rule that describes what it matches
	 * matches its own description on the way out.
	 */
	selfMasked: string[];
}

export async function loadRules(): Promise<RuleSet> {
	const res = await lyeve.request<{
		presets?: MaskRule[];
		mask_tags?: Record<string, string>;
	}>('admin', '/api/admin/pii/rules');

	const rules = (res.presets ?? []).slice().sort((a, b) => a.priority - b.priority);
	const replacements = rules.map((r) => r.replacement).filter(Boolean);
	const tags: Record<string, string> = res.mask_tags ?? {};

	return {
		rules,
		tags: Object.entries(tags).map(([tag, meaning]) => ({ tag, meaning })),
		selfMasked: rules
			.filter((r) => replacements.some((token) => r.description.includes(token)))
			.map((r) => r.name)
	};
}

export interface AccessEntry {
	id: string;
	viewerUserId: string;
	viewerRole: string;
	piiTypes: string[];
	recordType: string;
	recordId: string;
	accessedAt: string;
	tenantId: string;
}

export interface AccessPage {
	entries: AccessEntry[];
	total: number;
	limit: number;
	offset: number;
}

/**
 * Reads the PII access log.
 *
 * One entry per response that carried PII, including the responses this desk
 * itself asks for. An export writes an entry even though the DSAR paths are
 * exempt from the rewrite: the exemption suppresses the masking, not the
 * record, which is the right way round for a route whose whole job is handing
 * over somebody's personal data.
 *
 * `pii_type` is the comma-joined list of rule names that matched, one entry per
 * match rather than per distinct rule, so a page of fifteen addresses records
 * EMAIL fifteen times. The count is a rough measure of how much was in the
 * response, not of how many kinds.
 */
export async function loadAccessLog(limit = 25, offset = 0): Promise<AccessPage> {
	const res = await lyeve.request<{
		data?: RawAccessEntry[];
		total_count?: number;
		limit?: number;
		offset?: number;
	}>('admin', `/api/admin/pii/access-log?limit=${limit}&offset=${offset}`);

	return {
		entries: (res.data ?? []).map(toAccessEntry),
		total: res.total_count ?? 0,
		limit: res.limit ?? limit,
		offset: res.offset ?? offset
	};
}

interface RawAccessEntry {
	id: string;
	viewer_user_id?: string;
	viewer_role?: string;
	pii_type?: string;
	record_type?: string;
	record_id?: string;
	accessed_at?: string;
	tenant_id?: string;
}

function toAccessEntry(raw: RawAccessEntry): AccessEntry {
	const types = (raw.pii_type ?? '')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
	return {
		id: raw.id,
		viewerUserId: raw.viewer_user_id ?? '',
		viewerRole: raw.viewer_role ?? '',
		piiTypes: types,
		recordType: raw.record_type ?? '',
		recordId: raw.record_id ?? '',
		accessedAt: raw.accessed_at ?? '',
		tenantId: raw.tenant_id ?? ''
	};
}

/** Distinct rule names in an entry, with how many times each matched. */
export function summarizePiiTypes(types: string[]): { name: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
	return [...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
