<script lang="ts">
	import ProductGrid from '$lib/components/ProductGrid.svelte';
	import { formatRating } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let sort = $state('newest');
	let inStockOnly = $state(false);

	// Neither of these could be asked of the engine. It has no sort parameter,
	// so rows arrive created_at DESC and every other order is the app's own
	// work. Its filters are exact equality, so "in stock", which means stock
	// greater than zero, is not a question it can be asked at all.
	const visible = $derived.by(() => {
		const rows = data.products.filter((product) => !inStockOnly || product.stock > 0);
		if (sort === 'price-asc') return [...rows].sort((a, b) => a.priceCents - b.priceCents);
		if (sort === 'price-desc') return [...rows].sort((a, b) => b.priceCents - a.priceCents);
		return rows;
	});
</script>

<svelte:head><title>Longshore Market</title></svelte:head>

{#if data.products.length === 0 && data.selected === null}
	<p class="text-slate-500">
		Nothing in the catalog yet. Run
		<code class="rounded bg-slate-100 px-1.5 py-0.5">make setup</code>
		from the repository root to create the content types and seed the products.
	</p>
{:else}
	<div class="flex flex-wrap items-center gap-2">
		<a
			href="/"
			class="rounded-full border px-3 py-1 text-sm {data.selected === null
				? 'border-slate-900 bg-slate-900 text-white'
				: 'border-slate-300 text-slate-600 hover:border-slate-900'}"
		>
			Everything
		</a>
		{#each data.categories as category (category.id)}
			<a
				href="/?category={category.slug}"
				class="rounded-full border px-3 py-1 text-sm {data.selected === category.slug
					? 'border-slate-900 bg-slate-900 text-white'
					: 'border-slate-300 text-slate-600 hover:border-slate-900'}"
			>
				{category.title}
			</a>
		{/each}
	</div>

	<div class="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 py-3">
		<p class="text-sm text-slate-500">
			{visible.length}
			{visible.length === 1 ? 'product' : 'products'}
		</p>

		<div class="flex items-center gap-5 text-sm">
			<label class="flex items-center gap-2 text-slate-600">
				<input type="checkbox" bind:checked={inStockOnly} class="h-4 w-4" />
				In stock only
			</label>
			<label class="flex items-center gap-2 text-slate-600">
				Sort
				<select
					bind:value={sort}
					class="rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-slate-900"
				>
					<option value="newest">Newest first</option>
					<option value="price-asc">Price, low to high</option>
					<option value="price-desc">Price, high to low</option>
				</select>
			</label>
		</div>
	</div>

	<div class="mt-8">
		{#if data.products.length === 0}
			<p class="text-slate-500">Nothing listed in this category.</p>
		{:else if visible.length === 0}
			<p class="text-slate-500">
				Everything in this category is out of stock. Clear the filter to see it anyway.
			</p>
		{:else}
			<ProductGrid products={visible} />
		{/if}
	</div>

	<section class="mt-14 border-t border-slate-200 pt-8">
		<h2 class="text-sm font-medium uppercase tracking-wide text-slate-400">Sellers</h2>
		<ul class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#each data.sellers as seller (seller.id)}
				<li class="rounded-lg bg-slate-50 p-4">
					<a href="/sellers/{seller.slug}" class="font-medium hover:underline">{seller.title}</a>
					<span class="ml-2 text-sm text-slate-400">{formatRating(seller.rating)}</span>
					<p class="mt-1 text-sm text-slate-600">{seller.bio}</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}
