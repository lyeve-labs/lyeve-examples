<script lang="ts">
	let { data } = $props();
	const story = $derived(data.story);
</script>

<svelte:head><title>Preview: {story.title}</title></svelte:head>

<div class="mx-auto max-w-2xl">
	<a href="/desk/{story.id}" class="text-sm text-slate-500 hover:underline">&larr; Back to the desk</a>

	<p class="mt-4 rounded bg-slate-900 px-4 py-2 text-sm text-slate-100">
		Preview. Read with <code class="text-xs">GET /api/v1/content/news_stories/{'{id}'}</code>, whose
		public status is
		<span class="font-medium">{story.publicStatus ?? 'unset'}</span>. The get-by-id route applies no
		draft filter, which is why this renders while the front page and the slug page do not have it.
	</p>

	<article class="mt-8">
		{#if story.desk}
			<p class="text-xs font-semibold uppercase tracking-widest text-slate-500">{story.desk}</p>
		{/if}
		<h1 class="mt-2 font-serif text-3xl font-bold leading-tight tracking-tight">{story.title}</h1>
		{#if story.standfirst}
			<p class="mt-3 text-lg text-slate-600">{story.standfirst}</p>
		{/if}
		<p class="mt-4 border-y border-slate-200 py-3 text-sm text-slate-500">
			{story.reporter}{#if story.dateline} &middot; {story.dateline}{/if}
		</p>

		{#if story.coverId}
			<img src="/media/{story.coverId}" alt="" class="mt-8 w-full rounded object-cover" />
		{/if}

		<div class="mt-8 space-y-4 leading-relaxed text-slate-800">
			{#each story.body.split('\n\n') as paragraph}
				<p>{paragraph}</p>
			{/each}
		</div>
	</article>
</div>
