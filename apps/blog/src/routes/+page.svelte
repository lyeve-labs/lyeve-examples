<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>The Analytical Review</title></svelte:head>

{#if data.posts.length === 0}
	<p class="text-slate-500">
		Nothing published yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to
		provision the content types and seed a few posts.
	</p>
{:else}
	<ul class="divide-y divide-slate-200">
		{#each data.posts as post (post.id)}
			<li class="py-6 first:pt-0">
				<article class="flex gap-5">
					{#if post.coverId}
						<img
							src="/media/{post.coverId}"
							alt=""
							class="h-24 w-32 shrink-0 rounded object-cover"
						/>
					{/if}
					<div class="min-w-0">
						{#if post.category}
							<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
								{post.category}
							</p>
						{/if}
						<h2 class="mt-1 text-xl font-semibold tracking-tight">
							<a href="/posts/{post.slug}" class="hover:underline">{post.title}</a>
						</h2>
						{#if post.excerpt}
							<p class="mt-2 text-slate-600">{post.excerpt}</p>
						{/if}
						<p class="mt-3 text-sm text-slate-400">
							{post.author} · {new Date(post.publishedAt).toLocaleDateString()}
						</p>
					</div>
				</article>
			</li>
		{/each}
	</ul>
{/if}
