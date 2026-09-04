<script lang="ts">
	import { segments } from '$lib/highlight';

	let { data } = $props();

	const nextOffset = $derived(data.offset + data.pageSize);
	const prevOffset = $derived(Math.max(0, data.offset - data.pageSize));
	const hasNext = $derived(data.offset + data.pageSize < data.total);

	/** Keeps every switch on the URL, so a link to a comparison is a link. */
	function href(changes: Record<string, string | null>): string {
		const params = new URLSearchParams();
		if (data.query) params.set('q', data.query);
		if (data.category) params.set('category', data.category.slug);
		if (!data.useSynonyms) params.set('raw', '1');
		if (data.useConfigRanking) params.set('rank', 'config');
		if (data.offset) params.set('offset', String(data.offset));
		for (const [key, value] of Object.entries(changes)) {
			if (value === null) params.delete(key);
			else params.set(key, value);
		}
		const query = params.toString();
		return query ? `/?${query}` : '/';
	}
</script>

<svelte:head><title>Operations knowledge base</title></svelte:head>

<form method="GET" class="flex flex-wrap gap-2">
	<input
		type="search"
		name="q"
		value={data.query}
		placeholder="Search 433 operations articles"
		class="min-w-64 flex-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
	/>
	<select
		name="category"
		class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
	>
		<option value="">Every category</option>
		{#each data.categories as category (category.slug)}
			<option value={category.slug} selected={data.category?.slug === category.slug}>
				{category.title}
			</option>
		{/each}
	</select>
	{#if !data.useSynonyms}<input type="hidden" name="raw" value="1" />{/if}
	{#if data.useConfigRanking}<input type="hidden" name="rank" value="config" />{/if}
	<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
		Search
	</button>
</form>

<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
	<a
		href={href({ raw: data.useSynonyms ? '1' : null, offset: null })}
		class="rounded border px-2 py-1 {data.useSynonyms
			? 'border-slate-900 bg-slate-900 text-white'
			: 'border-slate-300 text-slate-600'}"
	>
		Synonym expansion {data.useSynonyms ? 'on' : 'off'}
	</a>
	<a
		href={href({ rank: data.useConfigRanking ? null : 'config', offset: null })}
		class="rounded border px-2 py-1 {data.useConfigRanking
			? 'border-slate-900 bg-slate-900 text-white'
			: 'border-slate-300 text-slate-600'}"
	>
		Order: {data.useConfigRanking ? 'stored ranking config' : "engine's own rank"}
	</a>
	<span class="text-slate-500">
		{data.total} matching · {data.elapsedMs} ms round trip
	</span>
</div>

{#if data.useConfigRanking}
	<p class="mt-2 text-xs text-slate-500">
		Weights in use: title {data.ranking.titleWeight}, body {data.ranking.bodyWeight}, keywords
		{data.ranking.tagWeight}{#if data.ranking.boostRules.length}, plus {data.ranking.boostRules
			.length} boost rule{data.ranking.boostRules.length === 1 ? '' : 's'}{/if}.
		{data.ranking.stored ? 'Read from a stored config.' : 'No config is stored, so these are the defaults the route returns.'}
		{#if data.ranking.unmatchable.length}
			Fields this app cannot evaluate: {data.ranking.unmatchable.join(', ')}.
		{/if}
	</p>
{/if}

{#if data.query}
	<p class="mt-4 text-sm text-slate-500">
		Sent to the engine as
		<code class="rounded bg-slate-100 px-1.5 py-0.5">{data.sentToEngine}</code>
	</p>

	{#if data.appliedSynonym}
		<p class="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
			A synonym group for <strong>{data.appliedSynonym.baseTerm}</strong> was applied by this app,
			adding {data.appliedSynonym.synonyms.join(', ')}. The engine stores that group and never
			consults it, so the rewrite happened here.
		</p>
	{:else if data.availableSynonym}
		<p class="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
			A synonym group for <strong>{data.availableSynonym.baseTerm}</strong> exists and expansion is
			switched off, so {data.availableSynonym.synonyms.join(' and ')} are not being searched for.
		</p>
	{/if}
{:else}
	<p class="mt-4 text-sm text-slate-500">
		Nothing typed, so this is a browse: a search with only a schema criterion, ordered by last
		update. The engine refuses a search with no criterion at all rather than returning everything.
	</p>
{/if}

{#if data.category && data.filteredOut > 0}
	<p class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
		{data.filteredOut} of this page's hits were dropped here, not by the engine. Search filters on
		schema, status, tags and a published date range, and a relation is not among them, so the
		category filter runs in this process over the page that came back. The count above is therefore
		the unfiltered total.
	</p>
{/if}

{#if data.hits.length === 0}
	<p class="mt-8 text-slate-500">
		No matches.
		{#if data.query}
			The query was recorded either way, which is what puts it in the zero-result share on the
			console.
		{/if}
	</p>
{:else}
	<ul class="mt-6 divide-y divide-slate-200">
		{#each data.hits as hit (hit.id)}
			<li class="py-5">
				<h2 class="text-lg font-semibold tracking-tight">
					<a
						href="/go/{hit.id}?q={encodeURIComponent(data.query)}&slug={hit.slug}"
						class="hover:underline"
					>
						{#if hit.titleSnippet}
							{#each segments(hit.titleSnippet) as part, i (i)}
								{#if part.mark}<mark class="bg-yellow-200">{part.text}</mark>{:else}{part.text}{/if}
							{/each}
						{:else}
							{hit.title}
						{/if}
					</a>
				</h2>

				{#if hit.bodySnippet}
					<p class="mt-2 text-sm text-slate-600">
						{#each segments(hit.bodySnippet) as part, i (i)}
							{#if part.mark}<mark class="bg-yellow-200">{part.text}</mark>{:else}{part.text}{/if}
						{/each}
					</p>
				{:else if hit.summary}
					<p class="mt-2 text-sm text-slate-600">{hit.summary}</p>
				{/if}

				<p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
					<span>engine rank {hit.engineRank.toFixed(4)}</span>
					{#if data.useConfigRanking}
						<span class="font-medium text-slate-600">applied score {hit.score.toFixed(4)}</span>
						<span>title {hit.titleHits} · body {hit.bodyHits} · keywords {hit.keywordHits}</span>
						{#each hit.boosts as boost, i (i)}<span>boost {boost}</span>{/each}
					{/if}
					{#if hit.keywords}<span>{hit.keywords}</span>{/if}
				</p>
			</li>
		{/each}
	</ul>

	<nav class="mt-6 flex items-center justify-between text-sm">
		{#if data.offset > 0}
			<a href={href({ offset: String(prevOffset) })} class="text-slate-600 hover:underline">
				Previous
			</a>
		{:else}
			<span></span>
		{/if}
		<span class="text-slate-400">
			{data.offset + 1} to {data.offset + data.shown} of {data.total}
		</span>
		{#if hasNext}
			<a href={href({ offset: String(nextOffset) })} class="text-slate-600 hover:underline">Next</a>
		{:else}
			<span></span>
		{/if}
	</nav>
{/if}

{#if Object.keys(data.facets).length > 0}
	<section class="mt-10 rounded-md border border-slate-200 p-4">
		<h2 class="text-sm font-semibold">Facets</h2>
		<p class="mt-1 text-xs text-slate-500">
			The engine narrows a facet count by the query and the tenant, and by nothing else. This page
			asked for <code class="rounded bg-slate-100 px-1 py-0.5">schema=kb_articles</code> and the
			schema bucket still lists every other example's content types, because the facet clause does
			not carry the schema filter.
		</p>
		<div class="mt-3 grid gap-4 sm:grid-cols-2">
			{#each Object.entries(data.facets) as [field, buckets] (field)}
				<div>
					<p class="text-xs font-medium uppercase tracking-wide text-slate-400">{field}</p>
					<ul class="mt-1 text-sm text-slate-600">
						{#each buckets.slice(0, 8) as bucket (bucket.value)}
							<li class="flex justify-between gap-4">
								<span class="truncate">{bucket.value}</span>
								<span class="text-slate-400">{bucket.count}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>
{/if}
