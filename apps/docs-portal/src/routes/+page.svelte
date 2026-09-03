<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Engine Guide</title></svelte:head>

<div class="max-w-2xl">
	<h1 class="text-3xl font-semibold tracking-tight">Engine Guide</h1>
	<p class="mt-3 text-slate-600">
		Everything this portal describes was checked against a running engine. Start in the space that
		matches what you are doing, or search if you already know the term you are looking for.
	</p>
</div>

{#if data.overview.length === 0}
	<p class="mt-10 text-slate-500">
		No spaces yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to provision
		the content types and seed the guide.
	</p>
{:else}
	<ul class="mt-10 grid gap-5 sm:grid-cols-2">
		{#each data.overview as space (space.id)}
			<li class="rounded-lg border border-slate-200 p-6">
				<h2 class="text-lg font-semibold tracking-tight">
					<a href="/docs/{space.slug}" class="hover:underline">{space.title}</a>
				</h2>
				{#if space.summary}
					<p class="mt-2 text-sm text-slate-600">{space.summary}</p>
				{/if}
				<p class="mt-4 text-xs uppercase tracking-wide text-slate-400">
					{space.pageCount}
					{space.pageCount === 1 ? 'page' : 'pages'}
				</p>
			</li>
		{/each}
	</ul>
{/if}
