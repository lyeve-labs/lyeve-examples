<script lang="ts">
	let { data } = $props();

	const locked = $derived(data.articles.filter((a) => !a.unlocked).length);
</script>

<svelte:head><title>Cold Path</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Cold Path</h1>
<p class="mt-2 text-slate-600">
	Notes on the parts of a production system nobody exercises until they matter.
</p>

{#if data.articles.length === 0}
	<p class="mt-8 text-slate-500">
		Nothing published yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to
		provision the content types and seed the archive.
	</p>
{:else}
	{#if locked > 0}
		<p class="mt-6 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
			{locked} of {data.articles.length} articles are open to members only.
			<a href="/account" class="font-medium text-slate-900 underline">Check your account</a>.
		</p>
	{/if}

	<ul class="mt-8 divide-y divide-slate-200">
		{#each data.articles as article (article.id)}
			<li class="py-6 first:pt-0">
				<div class="flex items-center gap-2">
					{#if article.tier === 'member'}
						<span
							class="rounded-full px-2 py-0.5 text-xs font-medium {article.unlocked
								? 'bg-emerald-100 text-emerald-800'
								: 'bg-amber-100 text-amber-800'}"
						>
							{article.unlocked ? 'Members only, unlocked' : 'Members only'}
						</span>
					{:else}
						<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
							Free to read
						</span>
					{/if}
					<span class="text-xs text-slate-400">
						{new Date(article.publishedAt).toLocaleDateString()}
					</span>
				</div>

				<h2 class="mt-2 text-xl font-semibold tracking-tight">
					<a href="/articles/{article.slug}" class="hover:underline">{article.title}</a>
				</h2>
				{#if article.excerpt}
					<p class="mt-2 text-slate-600">{article.excerpt}</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
