<script lang="ts">
	import PageMeta from '$lib/components/PageMeta.svelte';
	import { paragraphs } from '$lib/site';

	let { data } = $props();
	const entry = $derived(data.page);
</script>

<PageMeta title={entry.title} description={entry.summary} imageId={entry.heroId} type="article" />

<article class="max-w-3xl">
	<h1 class="text-3xl font-semibold tracking-tight">{entry.title}</h1>
	{#if entry.summary}
		<p class="mt-4 text-lg text-slate-600">{entry.summary}</p>
	{/if}

	{#if entry.heroId}
		<img
			src="/media/{entry.heroId}"
			alt=""
			class="mt-8 w-full rounded-lg border border-slate-200 object-cover"
		/>
	{/if}

	<div class="mt-8 space-y-4 leading-relaxed text-slate-700">
		{#each paragraphs(entry.body) as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>
</article>
