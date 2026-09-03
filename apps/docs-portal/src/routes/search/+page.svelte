<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Search</title></svelte:head>

<div class="max-w-2xl">
	<h1 class="text-2xl font-semibold tracking-tight">Search</h1>

	<form method="GET" class="mt-6 flex gap-2">
		<input
			type="search"
			name="q"
			value={data.query}
			placeholder="Search every page in the guide"
			class="flex-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
		<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
			Search
		</button>
	</form>

	{#if data.query}
		<p class="mt-6 text-sm text-slate-500">
			{data.total}
			{data.total === 1 ? 'result' : 'results'} for &ldquo;{data.query}&rdquo;
		</p>

		<ul class="mt-4 divide-y divide-slate-200">
			{#each data.hits as hit (hit.id)}
				<li class="py-4">
					{#if hit.spaceTitle}
						<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
							{hit.spaceTitle}
						</p>
					{/if}
					{#if hit.spaceSlug}
						<a
							href="/docs/{hit.spaceSlug}/{hit.slug}"
							class="mt-1 block font-medium hover:underline">{hit.title}</a
						>
					{:else}
						<p class="mt-1 font-medium">{hit.title}</p>
					{/if}
					{#if hit.excerpt}
						<p class="mt-1 text-sm text-slate-600">{hit.excerpt}</p>
					{/if}
				</li>
			{/each}
		</ul>

		{#if data.total === 0}
			<p class="mt-4 text-sm text-slate-500">
				Search reads recorded entries, so it only finds pages written through the admin content
				route.
			</p>
		{/if}
	{/if}
</div>
