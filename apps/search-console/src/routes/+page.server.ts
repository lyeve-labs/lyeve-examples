import { ARTICLES } from '$lib/server/lyeve';
import { listCategories } from '$lib/server/content';
import { expandQuery } from '$lib/server/expand';
import { applyRanking, byAppliedScore, unmatchableRules } from '$lib/server/rank';
import { recordLoggedSearch } from '$lib/server/clicks';
import {
	getRanking,
	listSynonyms,
	logSearch,
	safely,
	search,
	type SearchHit
} from '$lib/server/search';
import { sessionId } from '$lib/server/session';
import type { PageServerLoad } from './$types';

// Twenty, not ten, because the ranking config is applied to the page that came
// back rather than to the corpus: a page too small to hold the whole result set
// cannot demonstrate a reordering, and the checkpoint example is twelve hits.
const PAGE = 20;

export const load: PageServerLoad = async ({ url, cookies }) => {
	const q = (url.searchParams.get('q') ?? '').trim();
	const categorySlug = url.searchParams.get('category') ?? '';
	const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0') || 0);
	// Two switches, both there so the difference is visible rather than asserted.
	const useSynonyms = url.searchParams.get('raw') !== '1';
	const useConfigRanking = url.searchParams.get('rank') === 'config';

	const session = sessionId(cookies);
	const categories = await listCategories();
	const category = categories.find((row) => row.slug === categorySlug) ?? null;

	// The groups are read even when expansion is off, so the page can say which
	// group would have applied.
	const groups = q ? ((await safely(listSynonyms())) ?? []) : [];
	const candidate = expandQuery(q, groups);
	const expansion = useSynonyms ? candidate : { query: q, applied: null };

	const ranking = (await safely(getRanking(ARTICLES))) ?? {
		id: '',
		tenant_id: '',
		schema_name: ARTICLES,
		title_weight: 1,
		body_weight: 0.4,
		tag_weight: 0.2,
		boost_rules: [],
		created_at: '',
		updated_at: '',
		stored: false
	};

	const started = performance.now();
	const result = await search({
		q: expansion.query,
		schema: ARTICLES,
		limit: PAGE,
		offset,
		highlight: true,
		// Only schema, status and tags produce buckets. The counts come back
		// narrowed by the query and the tenant and by nothing else, so they
		// describe the whole corpus rather than this page's schema filter.
		facets: ['schema', 'status']
	});
	const elapsedMs = Math.round(performance.now() - started);

	// Search has no way to filter on a relation. The criteria it accepts are
	// q, schema, status, tags and a published_at range, so a category filter has
	// to be applied here, over the page that came back. That means the total is
	// the unfiltered total and the page can be short: the honest presentation is
	// to say so rather than to recount.
	const inCategory = (hit: SearchHit) =>
		!category || String(hit.body?.category ?? '') === category.id;
	const hits = result.results.filter(inCategory);

	// Scored either way, so the page can show what the weights would have done,
	// and reordered only when asked. Keeping the arrival order is what preserves
	// the engine's ranking, including its tie-break on updated_at and id, which
	// a re-sort here could not reconstruct.
	const scored = applyRanking(hits, expansion.query, ranking);
	const ordered = useConfigRanking ? scored.slice().sort(byAppliedScore) : scored;

	// Nothing in the engine records a search. This is the only reason the
	// console's analytics tab has anything in it, and the query logged is what
	// the reader typed rather than the expanded form, so the top-queries report
	// reads as intended and a click can be matched back to it.
	if (q) {
		await safely(
			logSearch({
				query_text: q,
				result_count: result.total,
				duration_ms: elapsedMs,
				session_id: session,
				filters: JSON.stringify({ schema: ARTICLES, category: categorySlug || null })
			})
		);
		recordLoggedSearch(q);
	}

	return {
		query: q,
		sentToEngine: expansion.query,
		appliedSynonym: expansion.applied
			? { baseTerm: expansion.applied.base_term, synonyms: expansion.applied.synonyms }
			: null,
		availableSynonym: candidate.applied
			? { baseTerm: candidate.applied.base_term, synonyms: candidate.applied.synonyms }
			: null,
		useSynonyms,
		useConfigRanking,
		ranking: {
			stored: ranking.stored,
			titleWeight: ranking.title_weight,
			bodyWeight: ranking.body_weight,
			tagWeight: ranking.tag_weight,
			boostRules: ranking.boost_rules ?? [],
			unmatchable: unmatchableRules(ranking.boost_rules ?? []).map((rule) => rule.field)
		},
		categories: categories.map((row) => ({ slug: row.slug, title: row.title })),
		category: category ? { slug: category.slug, title: category.title } : null,
		total: result.total,
		shown: ordered.length,
		filteredOut: result.results.length - hits.length,
		offset,
		pageSize: PAGE,
		elapsedMs,
		facets: result.facets ?? {},
		hits: ordered.map((entry) => ({
			id: entry.hit.entry_id,
			slug: entry.hit.slug,
			title: entry.hit.title,
			summary: typeof entry.hit.body?.summary === 'string' ? entry.hit.body.summary : '',
			keywords: typeof entry.hit.body?.keywords === 'string' ? entry.hit.body.keywords : '',
			titleSnippet: entry.hit.snippets?.title ?? null,
			bodySnippet: entry.hit.snippets?.body ?? null,
			engineRank: entry.engineRank,
			score: entry.score,
			titleHits: entry.titleHits,
			bodyHits: entry.bodyHits,
			keywordHits: entry.keywordHits,
			boosts: entry.appliedBoosts
		}))
	};
};
