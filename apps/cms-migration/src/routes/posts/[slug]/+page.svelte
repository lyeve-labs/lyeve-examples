<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>{data.post.title}</title></svelte:head>

<p class="text-sm"><a href="/" class="text-slate-500 hover:underline">Back to the report</a></p>

<article class="mt-6">
	{#if data.post.section}
		<p class="text-xs font-medium uppercase tracking-wide text-slate-400">{data.post.section}</p>
	{/if}
	<h1 class="mt-1 text-3xl font-semibold tracking-tight">{data.post.title}</h1>
	{#if data.post.standfirst}
		<p class="mt-3 text-lg text-slate-600">{data.post.standfirst}</p>
	{/if}
	<p class="mt-4 text-sm text-slate-400">
		{data.author?.name ?? 'Unattributed'}
		{#if data.post.publishedAt}
			&middot; published {new Date(data.post.publishedAt).toLocaleDateString()}
		{/if}
		&middot; imported {new Date(data.post.importedAt).toLocaleDateString()}
		{#if data.post.legacyId}
			&middot; <span class="font-mono text-xs">{data.post.legacyId}</span>
		{/if}
	</p>

	<!--
		The body arrived as markup, because the old system stored markup. It comes
		from a CSV file in this repository, so it is trusted here. A migration from
		a real system is importing whatever its editors pasted over fifteen years,
		and has to sanitize before it renders.
	-->
	<div class="legacy-body mt-8">
		{@html data.post.bodyHtml}
	</div>
</article>

{#if data.author}
	<aside class="mt-10 rounded-md border border-slate-200 p-5">
		<p class="font-medium">{data.author.name}</p>
		{#if data.author.role}<p class="text-sm text-slate-500">{data.author.role}</p>{/if}
		{#if data.author.bio}<p class="mt-2 text-sm text-slate-600">{data.author.bio}</p>{/if}
		<p class="mt-3 text-xs text-slate-400">
			Read with <code>?populate=author</code>. Without it the row carries
			<code>author_id</code> and a dead <code>author: null</code>, and this panel would be empty.
		</p>
	</aside>
{/if}

<style>
	/*
	 * Scoped selectors do not reach markup inserted with @html, so the imported
	 * body is styled through :global. Tailwind's typography plugin would do this
	 * job, and is deliberately not a dependency of these examples.
	 */
	.legacy-body :global(p) {
		margin-bottom: 1rem;
		line-height: 1.7;
		color: var(--color-slate-700, #334155);
	}
	.legacy-body :global(blockquote) {
		margin: 1.5rem 0;
		border-left: 3px solid var(--color-slate-300, #cbd5e1);
		padding-left: 1rem;
		font-style: italic;
		color: var(--color-slate-600, #475569);
	}
</style>
