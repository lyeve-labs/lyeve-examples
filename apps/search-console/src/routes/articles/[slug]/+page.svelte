<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>{data.article.title}</title></svelte:head>

<article class="max-w-2xl">
	{#if data.category}
		<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
			<a href="/?category={data.category.slug}" class="hover:underline">{data.category.title}</a>
		</p>
	{/if}

	<h1 class="mt-1 text-2xl font-semibold tracking-tight">{data.article.title}</h1>

	{#if data.article.summary}
		<p class="mt-3 text-slate-600">{data.article.summary}</p>
	{/if}

	<div class="mt-6 space-y-4 text-slate-800">
		{#each data.article.paragraphs as paragraph, i (i)}
			<p>{paragraph}</p>
		{/each}
	</div>

	{#if data.article.keywords.length > 0}
		<p class="mt-8 flex flex-wrap gap-2">
			{#each data.article.keywords as keyword (keyword)}
				<a
					href="/?q={encodeURIComponent(keyword)}"
					class="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-slate-900"
				>
					{keyword}
				</a>
			{/each}
		</p>
	{/if}
</article>

<p class="mt-10 text-sm text-slate-500">
	This page came from the ordinary content route, not from search. There is no route that fetches an
	entry by slug, so it is a
	<code class="rounded bg-slate-100 px-1.5 py-0.5">filters[slug]=</code> list of one.
</p>
