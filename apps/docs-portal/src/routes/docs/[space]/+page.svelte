<script lang="ts">
	import PageTree from '$lib/components/PageTree.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.space.title}</title></svelte:head>

<div class="grid gap-10 lg:grid-cols-[16rem_1fr]">
	<aside class="lg:sticky lg:top-8 lg:self-start">
		<p class="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
			{data.space.title}
		</p>
		<PageTree nodes={data.tree} spaceSlug={data.space.slug} />
	</aside>

	<div>
		<h1 class="text-3xl font-semibold tracking-tight">{data.space.title}</h1>
		{#if data.space.summary}
			<p class="mt-3 text-slate-600">{data.space.summary}</p>
		{/if}

		<ul class="mt-10 space-y-8">
			{#each data.sections as section (section.id)}
				<li>
					<h2 class="text-lg font-semibold tracking-tight">
						<a href="/docs/{data.space.slug}/{section.slug}" class="hover:underline">
							{section.title}
						</a>
					</h2>
					{#if section.excerpt}
						<p class="mt-2 text-sm text-slate-600">{section.excerpt}</p>
					{/if}
					{#if section.children.length > 0}
						<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
							{#each section.children as child (child.id)}
								<li>
									<a
										href="/docs/{data.space.slug}/{child.slug}"
										class="text-slate-500 hover:text-slate-900 hover:underline"
									>
										{child.title}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
</div>
