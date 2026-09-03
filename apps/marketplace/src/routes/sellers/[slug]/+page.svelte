<script lang="ts">
	import ProductGrid from '$lib/components/ProductGrid.svelte';
	import { formatPrice, formatRating } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Counting and summing are the app's work. The engine returns rows and no
	// aggregate of any kind, so a total is only ever a total of what came back.
	const inStock = $derived(data.products.filter((product) => product.stock > 0).length);
	const cheapest = $derived(
		data.products.length === 0
			? null
			: Math.min(...data.products.map((product) => product.priceCents))
	);
</script>

<svelte:head><title>{data.seller.title}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; Back to the catalog</a>

<header class="mt-6">
	<h1 class="text-3xl font-semibold tracking-tight">{data.seller.title}</h1>
	<p class="mt-3 max-w-2xl leading-relaxed text-slate-700">{data.seller.bio}</p>
	<p class="mt-4 text-sm text-slate-500">
		Rated {formatRating(data.seller.rating)}
		&middot; {data.products.length}
		{data.products.length === 1 ? 'product' : 'products'}
		&middot; {inStock} in stock
		{#if cheapest !== null}
			&middot; from {formatPrice(cheapest)}
		{/if}
	</p>
</header>

<div class="mt-10">
	{#if data.products.length === 0}
		<p class="text-slate-500">This seller has nothing listed.</p>
	{:else}
		<ProductGrid products={data.products} showSeller={false} />
	{/if}
</div>
