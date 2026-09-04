<script lang="ts">
	import { formatPrice, formatRating } from '$lib/format';

	let { data } = $props();
	const product = $derived(data.product);
</script>

<svelte:head><title>{product.title}</title></svelte:head>

{#if product.collectionSlug && product.collectionTitle}
	<a href="/c/{product.collectionSlug}" class="text-sm text-slate-500 hover:underline">
		&larr; {product.collectionTitle}
	</a>
{:else}
	<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All collections</a>
{/if}

<div class="mt-6 flex items-start justify-between gap-6">
	<div class="min-w-0">
		<h1 class="text-2xl font-semibold tracking-tight">{product.title}</h1>
		<p class="mt-2 text-sm text-slate-400">
			{#if product.stock > 0}
				{product.stock} in stock
			{:else}
				Out of stock
			{/if}
			{#if data.averageRating !== null}
				· {formatRating(data.averageRating)} from {data.reviews.length}
				{data.reviews.length === 1 ? 'review' : 'reviews'}
			{/if}
		</p>
	</div>
	<p class="shrink-0 text-xl font-medium tabular-nums">{formatPrice(product.priceCents)}</p>
</div>

{#if data.description}
	<div class="mt-8 space-y-4 leading-relaxed text-slate-700">
		{#each data.description.split('\n\n') as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>
{/if}

<h2 class="mt-12 text-lg font-semibold tracking-tight">Reviews</h2>
{#if data.reviews.length === 0}
	<p class="mt-2 text-slate-500">No reviews yet.</p>
{:else}
	<ul class="mt-4 divide-y divide-slate-200">
		{#each data.reviews as review (review.id)}
			<li class="py-4">
				<div class="flex items-baseline justify-between gap-4">
					<h3 class="font-medium">{review.title}</h3>
					<p class="shrink-0 text-sm text-slate-400 tabular-nums">{review.rating} / 5</p>
				</div>
				{#if review.body}<p class="mt-1 text-sm text-slate-600">{review.body}</p>{/if}
			</li>
		{/each}
	</ul>
{/if}
