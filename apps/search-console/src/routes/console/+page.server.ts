import { fail } from '@sveltejs/kit';
import { ARTICLES } from '$lib/server/lyeve';
import { reportedTally } from '$lib/server/clicks';
import { KNOWN_BOOST_FIELDS, unmatchableRules } from '$lib/server/rank';
import {
	analytics,
	createSynonym,
	deleteRanking,
	deleteSynonym,
	describe,
	getRanking,
	listSynonyms,
	putRanking,
	reindex,
	safely,
	search,
	searchByBody,
	type BoostRule,
	type ReindexResult
} from '$lib/server/search';
import type { Actions, PageServerLoad } from './$types';

// SvelteKit rejects an unrecognized export from a page server module, so the
// tab list reaches the template through the load return rather than as one.
const TABS = ['synonyms', 'ranking', 'analytics', 'reindex', 'verbs'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
	synonyms: 'Synonyms',
	ranking: 'Ranking',
	analytics: 'Analytics',
	reindex: 'Reindex',
	verbs: 'GET and POST'
};

const WINDOWS: Record<string, { label: string; hours: number }> = {
	'1h': { label: 'last hour', hours: 1 },
	'24h': { label: 'last 24 hours', hours: 24 },
	'30d': { label: 'last 30 days', hours: 24 * 30 }
};

export const load: PageServerLoad = async ({ url }) => {
	const requested = url.searchParams.get('tab') ?? '';
	const tab: Tab = (TABS as readonly string[]).includes(requested) ? (requested as Tab) : 'synonyms';

	const rankingSchema = url.searchParams.get('schema') || ARTICLES;
	const windowKey = url.searchParams.get('window') ?? '30d';
	const chosen = WINDOWS[windowKey] ?? WINDOWS['30d'];
	const probe = url.searchParams.get('probe') ?? 'checkpoint';

	const synonyms = tab === 'synonyms' ? ((await safely(listSynonyms())) ?? []) : [];
	const ranking = tab === 'ranking' ? await safely(getRanking(rankingSchema)) : null;

	const since = new Date(Date.now() - chosen.hours * 3600 * 1000);
	const summary = tab === 'analytics' ? await safely(analytics(since)) : null;

	// The two verbs run the identical query so the reply can be compared field
	// by field rather than described.
	const byQuery = tab === 'verbs' ? await safely(search({ q: probe, schema: ARTICLES, limit: 3 })) : null;
	const byBody = tab === 'verbs' ? await safely(searchByBody({ q: probe, schema: ARTICLES, limit: 3 })) : null;

	return {
		tab,
		tabs: TABS.map((key) => ({ key, label: TAB_LABELS[key] })),
		windowKey,
		windows: Object.entries(WINDOWS).map(([key, value]) => ({ key, label: value.label })),
		probe,
		knownBoostFields: KNOWN_BOOST_FIELDS,
		synonyms: synonyms.map((group) => ({
			id: group.id,
			name: group.name,
			baseTerm: group.base_term,
			synonyms: group.synonyms,
			updatedAt: group.updated_at
		})),
		ranking: ranking
			? {
					id: ranking.id,
					stored: ranking.stored,
					schemaName: ranking.schema_name,
					titleWeight: ranking.title_weight,
					bodyWeight: ranking.body_weight,
					tagWeight: ranking.tag_weight,
					boostRules: ranking.boost_rules ?? [],
					rulesText: (ranking.boost_rules ?? [])
						.map((rule) => `${rule.field} ${rule.value ?? ''} ${rule.boost}`.trim())
						.join('\n'),
					unmatchable: unmatchableRules(ranking.boost_rules ?? []).map((rule) => rule.field)
				}
			: null,
		summary,
		tally: reportedTally(),
		verbs:
			byQuery && byBody
				? {
						query: {
							total: byQuery.total,
							limit: byQuery.limit,
							titles: byQuery.results.map((hit) => hit.title),
							ranks: byQuery.results.map((hit) => hit.rank)
						},
						body: {
							total: byBody.total,
							limit: byBody.limit,
							titles: byBody.results.map((hit) => hit.title),
							ranks: byBody.results.map((hit) => hit.rank)
						}
					}
				: null
	};
};

/**
 * Parses the boost rule textarea: one rule per line, `field value boost`.
 *
 * The engine attaches no meaning to `field`, so any string is accepted and
 * stored. The unparseable lines are reported rather than dropped, because a
 * rule that was silently discarded looks exactly like a rule that does not work.
 */
function parseRules(text: string): { rules: BoostRule[]; rejected: string[] } {
	const rules: BoostRule[] = [];
	const rejected: string[] = [];

	for (const raw of text.split('\n')) {
		const line = raw.trim();
		if (!line) continue;
		const parts = line.split(/\s+/);
		if (parts.length < 3) {
			rejected.push(line);
			continue;
		}
		const boost = Number(parts[parts.length - 1]);
		if (!Number.isFinite(boost)) {
			rejected.push(line);
			continue;
		}
		rules.push({
			field: parts[0],
			value: parts.slice(1, -1).join(' '),
			boost
		});
	}

	return { rules, rejected };
}

/**
 * One shape for every action on this page, so the template can read
 * `form?.error` without narrowing a union of five unrelated payloads first.
 */
interface ConsoleForm {
	error?: string;
	created?: string;
	removed?: string;
	saved?: string;
	savedId?: string;
	rejectedLines?: string[];
	unmatchable?: string[];
	rankingRemoved?: string;
	reindexed?: ReindexResult;
	reindexMs?: number;
}

const accepted = (result: ConsoleForm): ConsoleForm => result;
const refused = (status: number, result: ConsoleForm) => fail(status, result);

function weight(form: FormData, key: string, fallback: number): number {
	const value = Number(form.get(key));
	return Number.isFinite(value) ? value : fallback;
}

export const actions: Actions = {
	addSynonym: async ({ request }) => {
		const form = await request.formData();
		const baseTerm = String(form.get('base_term') ?? '').trim();
		const name = String(form.get('name') ?? '').trim() || baseTerm;
		const synonyms = String(form.get('synonyms') ?? '')
			.split(',')
			.map((term) => term.trim())
			.filter(Boolean);

		if (!baseTerm) return refused(400, { error: 'A base term is required.' });
		if (synonyms.length === 0) return refused(400, { error: 'At least one synonym is required.' });

		try {
			await createSynonym({ name, base_term: baseTerm, synonyms });
			return accepted({ created: baseTerm });
		} catch (err) {
			return refused(502, { error: describe(err, 'The group was not created.') });
		}
	},

	removeSynonym: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return refused(400, { error: 'No group named.' });
		try {
			await deleteSynonym(id);
			return accepted({ removed: id });
		} catch (err) {
			return refused(502, { error: describe(err, 'The group was not removed.') });
		}
	},

	saveRanking: async ({ request }) => {
		const form = await request.formData();
		const schemaName = String(form.get('schema_name') ?? '').trim();
		if (!schemaName) return refused(400, { error: 'A schema name is required.' });

		const { rules, rejected } = parseRules(String(form.get('rules') ?? ''));

		try {
			const saved = await putRanking({
				schema_name: schemaName,
				title_weight: weight(form, 'title_weight', 1),
				body_weight: weight(form, 'body_weight', 0.4),
				tag_weight: weight(form, 'tag_weight', 0.2),
				boost_rules: rules
			});
			return accepted({
				saved: saved.schema_name,
				savedId: saved.id,
				rejectedLines: rejected,
				unmatchable: unmatchableRules(rules).map((rule) => rule.field)
			});
		} catch (err) {
			return refused(502, { error: describe(err, 'The config was not saved.') });
		}
	},

	removeRanking: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return refused(400, { error: 'No config named.' });
		try {
			await deleteRanking(id);
			return accepted({ rankingRemoved: id });
		} catch (err) {
			return refused(502, { error: describe(err, 'The config was not removed.') });
		}
	},

	/**
	 * Runs a reindex and reports exactly what came back.
	 *
	 * Synchronous, super_admin only, and not scoped to this app: with no tenant
	 * header a super_admin resolves to the implicit default tenant, which the
	 * handler maps to the whole corpus. So this rebuilds every example's content
	 * on the shared engine, and the elapsed time is measured here because the
	 * response carries none.
	 */
	reindex: async () => {
		const started = performance.now();
		try {
			const result = await reindex();
			return accepted({
				reindexed: result,
				reindexMs: Math.round(performance.now() - started)
			});
		} catch (err) {
			return refused(502, { error: describe(err, 'The reindex did not complete.') });
		}
	}
};
