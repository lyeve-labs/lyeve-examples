<script lang="ts">
	let { data } = $props();
	const story = $derived(data.story);
</script>

<svelte:head><title>{story.title}</title></svelte:head>

<article class="mx-auto max-w-2xl">
	<a href="/" class="text-sm text-slate-500 hover:underline">&larr; Front page</a>

	{#if story.desk}
		<p class="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-500">{story.desk}</p>
	{/if}
	<h1 class="mt-2 font-serif text-3xl font-bold leading-tight tracking-tight">{story.title}</h1>
	{#if story.standfirst}
		<p class="mt-3 text-lg text-slate-600">{story.standfirst}</p>
	{/if}
	<p class="mt-4 border-y border-slate-200 py-3 text-sm text-slate-500">
		{story.reporter}{#if story.dateline} &middot; {story.dateline}{/if} &middot;
		{new Date(story.filedAt).toLocaleDateString()}
	</p>

	{#if story.coverId}
		<img src="/media/{story.coverId}" alt="" class="mt-8 w-full rounded object-cover" />
	{/if}

	<div class="mt-8 space-y-4 leading-relaxed text-slate-800">
		{#each story.body.split('\n\n') as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	{#if story.reporterBio}
		<aside class="mt-12 rounded bg-slate-50 p-5 text-sm text-slate-600">
			<p class="font-medium text-slate-900">{story.reporter}</p>
			<p class="mt-1">{story.reporterBio}</p>
		</aside>
	{/if}
</article>
