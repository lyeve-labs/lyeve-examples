<script lang="ts">
	import { formatPrice, formatRating } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const product = $derived(data.product);
</script>

<svelte:head><title>{product.title}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; Back to the catalog</a>

<article class="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
	<div class="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
		{#if product.coverId}
			<img src="/media/{product.coverId}" alt="" class="h-full w-full object-cover" />
		{/if}
	</div>

	<div>
		{#if product.categoryName && product.categorySlug}
			<a
				href="/?category={product.categorySlug}"
				class="text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-600"
			>
				{product.categoryName}
			</a>
		{/if}

		<h1 class="mt-2 text-3xl font-semibold tracking-tight">{product.title}</h1>
		<p class="mt-3 text-2xl">{formatPrice(product.priceCents)}</p>

		<p class="mt-2 text-sm text-slate-500">
			{#if product.stock === 0}
				Out of stock
			{:else}
				{product.stock} in stock
			{/if}
			{#if data.averageRating !== null}
				<span class="ml-3">
					{formatRating(data.averageRating)} from {data.reviews.length}
					{data.reviews.length === 1 ? 'review' : 'reviews'}
				</span>
			{/if}
		</p>

		{#if data.description}
			<p class="mt-6 leading-relaxed text-slate-700">{data.description}</p>
		{/if}

		{#if data.seller}
			<aside class="mt-8 rounded-lg bg-slate-50 p-5 text-sm">
				<p class="font-medium text-slate-900">
					<a href="/sellers/{data.seller.slug}" class="hover:underline">{data.seller.title}</a>
					<span class="ml-2 font-normal text-slate-400">{formatRating(data.seller.rating)}</span>
				</p>
				<p class="mt-1 text-slate-600">{data.seller.bio}</p>
				<a
					href="/sellers/{data.seller.slug}"
					class="mt-3 inline-block text-slate-500 hover:underline"
				>
					Everything from this seller
				</a>
			</aside>
		{/if}
	</div>
</article>

<section class="mt-14 border-t border-slate-200 pt-8">
	<h2 class="text-sm font-medium uppercase tracking-wide text-slate-400">Reviews</h2>

	{#if data.reviews.length === 0}
		<p class="mt-4 text-slate-500">No reviews for this one yet.</p>
	{:else}
		<ul class="mt-4 divide-y divide-slate-200">
			{#each data.reviews as review (review.id)}
				<li class="py-4">
					<p class="font-medium">
						{review.title}
						<span class="ml-2 text-sm font-normal text-slate-400">
							{review.rating} out of 5
						</span>
					</p>
					<p class="mt-1 text-slate-600">{review.body}</p>
					<p class="mt-2 text-xs text-slate-400">
						{new Date(review.postedAt).toLocaleDateString()}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>
