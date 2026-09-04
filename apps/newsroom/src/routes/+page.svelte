<script lang="ts">
	let { data } = $props();

	const lead = $derived(data.stories[0]);
	const rest = $derived(data.stories.slice(1));
</script>

<svelte:head><title>The Meridian</title></svelte:head>

{#if data.stories.length === 0}
	<p class="text-slate-500">
		Nothing published yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to
		provision the content types and seed the newsroom.
	</p>
{:else}
	<article class="border-b border-slate-200 pb-8">
		{#if lead.desk}
			<p class="text-xs font-semibold uppercase tracking-widest text-slate-500">{lead.desk}</p>
		{/if}
		<h1 class="mt-2 font-serif text-4xl font-bold leading-tight tracking-tight">
			<a href="/stories/{lead.slug}" class="hover:underline">{lead.title}</a>
		</h1>
		{#if lead.standfirst}
			<p class="mt-3 text-lg text-slate-600">{lead.standfirst}</p>
		{/if}
		<p class="mt-4 text-sm text-slate-400">
			{lead.reporter}{#if lead.dateline} &middot; {lead.dateline}{/if} &middot;
			{new Date(lead.filedAt).toLocaleDateString()}
		</p>
		{#if lead.coverId}
			<img src="/media/{lead.coverId}" alt="" class="mt-6 w-full rounded object-cover" />
		{/if}
	</article>

	<ul class="mt-8 grid gap-8 sm:grid-cols-2">
		{#each rest as story (story.id)}
			<li>
				<article>
					{#if story.desk}
						<p class="text-xs font-semibold uppercase tracking-widest text-slate-500">
							{story.desk}
						</p>
					{/if}
					<h2 class="mt-1 font-serif text-xl font-bold leading-snug">
						<a href="/stories/{story.slug}" class="hover:underline">{story.title}</a>
					</h2>
					{#if story.standfirst}
						<p class="mt-2 text-slate-600">{story.standfirst}</p>
					{/if}
					<p class="mt-3 text-sm text-slate-400">
						{story.reporter}{#if story.dateline} &middot; {story.dateline}{/if}
					</p>
				</article>
			</li>
		{/each}
	</ul>
{/if}

<section class="mt-12 rounded border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
	<p class="font-medium text-slate-900">How this page is read</p>
	<p class="mt-2">
		<code class="text-xs">{data.readPath}</code>
	</p>
	<p class="mt-2">
		No status parameter is sent. Because <code class="text-xs">news_stories</code> carries
		<code class="text-xs">with_draft_publish</code>, the engine appends
		<code class="text-xs">{data.appliedFilter}</code> on its own, and a story the desk has not
		published cannot appear here.
	</p>
</section>
