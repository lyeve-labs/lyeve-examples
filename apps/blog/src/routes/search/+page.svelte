<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Search</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Search</h1>

<form method="GET" class="mt-6 flex gap-2">
	<input
		type="search"
		name="q"
		value={data.query}
		placeholder="Search every published post"
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
				<a href="/posts/{hit.slug}" class="font-medium hover:underline">{hit.title}</a>
				{#if hit.excerpt}<p class="mt-1 text-sm text-slate-600">{hit.excerpt}</p>{/if}
			</li>
		{/each}
	</ul>
{/if}
