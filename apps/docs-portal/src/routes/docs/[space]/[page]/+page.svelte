<script lang="ts">
	import PageTree from '$lib/components/PageTree.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const space = $derived(data.space);
	const doc = $derived(data.page);
</script>

<svelte:head><title>{doc.title} · {space.title}</title></svelte:head>

<div class="grid gap-10 lg:grid-cols-[16rem_1fr]">
	<aside class="lg:sticky lg:top-8 lg:self-start">
		<p class="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
			{space.title}
		</p>
		<PageTree nodes={data.tree} spaceSlug={space.slug} activeSlug={doc.slug} />
	</aside>

	<article class="max-w-2xl">
		<nav class="flex flex-wrap items-center gap-2 text-sm text-slate-500">
			<a href="/docs/{space.slug}" class="hover:underline">{space.title}</a>
			{#each data.trail as crumb (crumb.slug)}
				<span aria-hidden="true">/</span>
				<a href="/docs/{space.slug}/{crumb.slug}" class="hover:underline">{crumb.title}</a>
			{/each}
		</nav>

		<h1 class="mt-4 text-3xl font-semibold tracking-tight">{doc.title}</h1>

		<div class="mt-8 space-y-5">
			{#each doc.blocks as block, i (i)}
				{#if block.kind === 'code'}
					<pre
						class="overflow-x-auto rounded-md bg-slate-900 p-4 text-sm text-slate-100">{block.text}</pre>
				{:else}
					<p class="leading-relaxed text-slate-700">{block.text}</p>
				{/if}
			{/each}
		</div>

		{#if data.prev || data.next}
			<nav class="mt-12 flex justify-between gap-4 border-t border-slate-200 pt-6 text-sm">
				{#if data.prev}
					<a href="/docs/{space.slug}/{data.prev.slug}" class="text-slate-600 hover:text-slate-900">
						<span class="block text-xs uppercase tracking-wide text-slate-400">Previous</span>
						{data.prev.title}
					</a>
				{:else}
					<span></span>
				{/if}
				{#if data.next}
					<a
						href="/docs/{space.slug}/{data.next.slug}"
						class="text-right text-slate-600 hover:text-slate-900"
					>
						<span class="block text-xs uppercase tracking-wide text-slate-400">Next</span>
						{data.next.title}
					</a>
				{/if}
			</nav>
		{/if}
	</article>
</div>
