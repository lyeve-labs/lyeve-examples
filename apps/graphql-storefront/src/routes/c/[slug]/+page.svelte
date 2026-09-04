<script lang="ts">
	import { formatPrice } from '$lib/format';

	let { data } = $props();
	const collection = $derived(data.collection);
</script>

<svelte:head><title>{collection.title}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All collections</a>

<h1 class="mt-6 text-2xl font-semibold tracking-tight">{collection.title}</h1>
{#if collection.description}
	<p class="mt-2 max-w-2xl text-slate-600">{collection.description}</p>
{/if}

{#if data.products.length === 0}
	<p class="mt-8 text-slate-500">Nothing in this collection yet.</p>
{:else}
	<ul class="mt-8 divide-y divide-slate-200">
		{#each data.products as product (product.id)}
			<li class="flex items-baseline justify-between gap-6 py-4">
				<div class="min-w-0">
					<h2 class="font-medium">
						<a href="/p/{product.slug}" class="hover:underline">{product.title}</a>
					</h2>
					<p class="mt-1 text-sm text-slate-400">
						{#if product.stock > 0}
							{product.stock} in stock
						{:else}
							Out of stock
						{/if}
					</p>
				</div>
				<p class="shrink-0 font-medium tabular-nums">{formatPrice(product.priceCents)}</p>
			</li>
		{/each}
	</ul>
{/if}
