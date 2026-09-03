<script lang="ts">
	let { data } = $props();
	const post = $derived(data.post);
</script>

<svelte:head><title>{post.title}</title></svelte:head>

<article>
	<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All posts</a>

	{#if post.category}
		<p class="mt-6 text-xs font-medium uppercase tracking-wide text-slate-400">{post.category}</p>
	{/if}
	<h1 class="mt-2 text-3xl font-semibold tracking-tight">{post.title}</h1>
	<p class="mt-3 text-sm text-slate-400">
		{post.author?.title ?? 'Unattributed'} · {new Date(post.publishedAt).toLocaleDateString()}
	</p>

	{#if post.coverId}
		<img src="/media/{post.coverId}" alt="" class="mt-8 w-full rounded-lg object-cover" />
	{/if}

	<div class="mt-8 space-y-4 leading-relaxed text-slate-700">
		{#each post.body.split('\n\n') as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	{#if post.author?.bio}
		<aside class="mt-12 rounded-lg bg-slate-50 p-5 text-sm text-slate-600">
			<p class="font-medium text-slate-900">{post.author.title}</p>
			<p class="mt-1">{post.author.bio}</p>
		</aside>
	{/if}
</article>
