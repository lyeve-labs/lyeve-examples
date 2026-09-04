<script lang="ts">
	import { formatPrice } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><title>Sparrow Cycle Works</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Collections</h1>
<p class="mt-2 max-w-2xl text-slate-600">
	Small-batch bicycle parts, built and stocked in one workshop. This page and its counts came back
	in a single GraphQL request.
</p>

{#if data.collections.length === 0}
	<p class="mt-8 text-slate-500">
		Nothing provisioned yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code>
		to create the content types and seed the catalog.
	</p>
{:else}
	<ul class="mt-8 grid gap-4 sm:grid-cols-2">
		{#each data.collections as collection (collection.id)}
			<li class="rounded-lg border border-slate-200 p-5">
				<h2 class="text-lg font-semibold tracking-tight">
					<a href="/c/{collection.slug}" class="hover:underline">{collection.title}</a>
				</h2>
				{#if collection.description}
					<p class="mt-2 text-sm text-slate-600">{collection.description}</p>
				{/if}
				<p class="mt-4 text-sm text-slate-400">
					{collection.productCount}
					{collection.productCount === 1 ? 'part' : 'parts'}
					{#if collection.fromPriceCents !== null}
						· from {formatPrice(collection.fromPriceCents)}
					{/if}
				</p>
			</li>
		{/each}
	</ul>
{/if}
