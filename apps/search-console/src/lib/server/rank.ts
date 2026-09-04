/**
 * Applies a stored ranking config to a result set, because the engine does not.
 *
 * The plugin stores a config per (tenant, schema) with a title weight, a body
 * weight, a tag weight and a list of boost rules, and serves three routes for
 * managing it. Nothing reads it. The score in a hit comes from a tsvector whose
 * weights are compiled into a database trigger, so changing the config changes
 * no ordering, and a reindex does not help because the reindex rewrites the
 * vector with the same compiled weights.
 *
 * So the weights mean whatever the application decides. This app defines them,
 * and the definition is deliberately simple enough to check by eye:
 *
 *     score = engine rank
 *           + title_weight * occurrences in the title
 *           + body_weight  * occurrences in the body text
 *           + tag_weight   * occurrences in the keywords field
 *           + the boost of every rule the hit matches
 *
 * `tag_weight` is mapped onto this app's `keywords` field rather than onto the
 * engine's own notion of tags. The engine reads tags from `meta.tags`, and the
 * admin content write path never sets meta, so the C-weighted third of every
 * vector in this corpus is empty.
 *
 * Boost rules carry a free-text field name, and the engine attaches no meaning
 * to it. This app answers four:
 *
 *     schema   the hit's content type equals the value
 *     status   the hit's status equals the value
 *     keyword  the value appears in the hit's keywords field
 *     title    the value appears in the hit's title
 *
 * Anything else is reported as unmatched rather than silently ignored, so a
 * rule that will never fire is visible on the page that created it.
 */
import type { BoostRule, RankingConfig, SearchHit } from './search';

export interface RankedHit {
	hit: SearchHit;
	engineRank: number;
	titleHits: number;
	bodyHits: number;
	keywordHits: number;
	appliedBoosts: string[];
	score: number;
}

export const KNOWN_BOOST_FIELDS = ['schema', 'status', 'keyword', 'title'];

/**
 * Splits a query into the terms to count.
 *
 * The engine's parser understands quoted phrases, `OR` and a leading minus for
 * exclusion. None of those change what a term is for counting purposes, so they
 * are stripped rather than interpreted, and an excluded term is dropped because
 * a hit cannot contain it.
 */
export function queryTerms(query: string): string[] {
	const terms = query
		.replace(/"/g, ' ')
		.split(/\s+/)
		.map((token) => token.trim().toLowerCase())
		.filter((token) => token && token !== 'or' && token !== 'and' && !token.startsWith('-'))
		.filter((token) => token.length > 1);
	return [...new Set(terms)];
}

/**
 * Counts occurrences of each term, matching a word that starts with it.
 *
 * The prefix match is an approximation of the stemming the engine does. A search
 * for `index` matches `indexes` in the database and here, and neither matches
 * `reindex`. It is close enough for a weighting and it is not the same
 * algorithm, which is worth knowing before comparing a score with the engine's.
 */
function countTerms(text: string, terms: string[]): number {
	if (!text) return 0;
	const haystack = text.toLowerCase();
	let total = 0;
	for (const term of terms) {
		const pattern = new RegExp(`\\b${escapeRegExp(term)}\\w*`, 'g');
		total += (haystack.match(pattern) ?? []).length;
	}
	return total;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boostApplies(rule: BoostRule, hit: SearchHit): boolean {
	const value = (rule.value ?? '').trim().toLowerCase();
	if (!value) return false;
	switch (rule.field) {
		case 'schema':
			return hit.schema.toLowerCase() === value;
		case 'status':
			return hit.status.toLowerCase() === value;
		case 'keyword':
			return String(hit.body?.keywords ?? '')
				.toLowerCase()
				.includes(value);
		case 'title':
			return hit.title.toLowerCase().includes(value);
		default:
			return false;
	}
}

/**
 * Scores a page of hits, in the order they arrived.
 *
 * Scoring and ordering are separate on purpose. A caller that wants the
 * engine's own order keeps this order, which matters for a browse with no query
 * text: every rank is then 0.0, and sorting by a score computed here would
 * quietly replace the engine's ordering with this app's.
 *
 * It runs over the page the engine returned, not over the corpus, so it can
 * reorder twenty results and cannot promote the twenty-first into them. That is
 * the honest limit of applying ranking outside the engine, and asking for a
 * larger page is the only mitigation.
 */
export function applyRanking(
	hits: SearchHit[],
	query: string,
	config: Pick<RankingConfig, 'title_weight' | 'body_weight' | 'tag_weight' | 'boost_rules'>
): RankedHit[] {
	const terms = queryTerms(query);

	const scored = hits.map((hit) => {
		const bodyText = typeof hit.body?.body === 'string' ? hit.body.body : '';
		const summary = typeof hit.body?.summary === 'string' ? hit.body.summary : '';
		const keywords = typeof hit.body?.keywords === 'string' ? hit.body.keywords : '';

		const titleHits = countTerms(hit.title, terms);
		const bodyHits = countTerms(`${summary} ${bodyText}`, terms);
		const keywordHits = countTerms(keywords, terms);

		const appliedBoosts: string[] = [];
		let boostTotal = 0;
		for (const rule of config.boost_rules ?? []) {
			if (boostApplies(rule, hit)) {
				appliedBoosts.push(`${rule.field}=${rule.value} +${rule.boost}`);
				boostTotal += rule.boost;
			}
		}

		return {
			hit,
			engineRank: hit.rank,
			titleHits,
			bodyHits,
			keywordHits,
			appliedBoosts,
			score:
				hit.rank +
				config.title_weight * titleHits +
				config.body_weight * bodyHits +
				config.tag_weight * keywordHits +
				boostTotal
		};
	});

	return scored;
}

/**
 * Orders by the applied score, with a stable tie-break so the result is
 * reproducible when the weights are all zero, which is the state a reader will
 * try first.
 */
export function byAppliedScore(a: RankedHit, b: RankedHit): number {
	return b.score - a.score || a.hit.slug.localeCompare(b.hit.slug);
}

/** Rules whose field this app cannot evaluate, so a page can say so. */
export function unmatchableRules(rules: BoostRule[]): BoostRule[] {
	return (rules ?? []).filter((rule) => !KNOWN_BOOST_FIELDS.includes(rule.field));
}
