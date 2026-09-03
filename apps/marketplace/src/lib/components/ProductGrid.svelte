<script lang="ts">
	import { formatPrice } from '$lib/format';
	import type { ProductCard } from '$lib/types';

	let {
		products,
		showSeller = true
	}: { products: ProductCard[]; showSeller?: boolean } = $props();
</script>

<ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
	{#each products as product (product.id)}
		<li>
			<a href="/products/{product.slug}" class="block">
				<div class="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
					{#if product.coverId}
						<img
							src="/media/{product.coverId}"
							alt=""
							loading="lazy"
							class="h-full w-full object-cover"
						/>
					{/if}
				</div>

				<div class="mt-3">
					{#if product.categoryName}
						<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
							{product.categoryName}
						</p>
					{/if}
					<h3 class="mt-1 font-medium leading-snug hover:underline">{product.title}</h3>
					<p class="mt-1 text-sm text-slate-500">
						{formatPrice(product.priceCents)}
						{#if product.stock === 0}
							<span class="ml-2 text-amber-700">Out of stock</span>
						{:else if product.stock < 5}
							<span class="ml-2 text-slate-400">{product.stock} left</span>
						{/if}
					</p>
					{#if showSeller && product.sellerName}
						<p class="mt-1 text-sm text-slate-400">{product.sellerName}</p>
					{/if}
				</div>
			</a>
		</li>
	{/each}
</ul>
