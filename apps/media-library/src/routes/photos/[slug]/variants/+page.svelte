<script lang="ts">
	let { data } = $props();

	const present = $derived(data.variants.filter((v) => v.present));
	const absent = $derived(data.variants.filter((v) => !v.present));
</script>

<svelte:head><title>Variants of {data.photo.title} · Plate and Grain</title></svelte:head>

<nav class="text-sm text-slate-500">
	<a href="/" class="hover:underline">Albums</a>
	<span class="px-1">/</span>
	<a href="/photos/{data.photo.segment}" class="hover:underline">{data.photo.title}</a>
</nav>

<h1 class="mt-2 text-3xl font-semibold tracking-tight">Variants</h1>
<p class="mt-3 max-w-3xl text-slate-600">
	The processor runs three fixed presets over every image at upload time, inline, before the request
	returns. There is no queue, no worker and no configuration that changes the sizes.
	<code class="rounded bg-slate-100 px-1.5 py-0.5">media_thumbnail_format</code>
	and
	<code class="rounded bg-slate-100 px-1.5 py-0.5">media_thumbnail_quality</code>
	change how a variant is encoded. The three boxes are compiled in.
</p>

<dl class="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
	<div class="flex gap-2">
		<dt class="text-slate-500">source</dt>
		<dd class="font-mono text-xs">{data.record.width} x {data.record.height}</dd>
	</div>
	<div class="flex gap-2">
		<dt class="text-slate-500">content type</dt>
		<dd class="font-mono text-xs">{data.record.contentType}</dd>
	</div>
	<div class="flex gap-2">
		<dt class="text-slate-500">generated</dt>
		<dd class="font-mono text-xs">{present.length} of {data.presets.length}</dd>
	</div>
</dl>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Generated</h2>
	{#if present.length === 0}
		<p class="mt-2 text-sm text-slate-500">
			None. Every preset was declined, which for an image this size is the correct outcome.
		</p>
	{:else}
		<ul class="mt-4 space-y-4">
			{#each present as variant (variant.preset)}
				<li class="rounded-lg border border-slate-200 p-4">
					<div class="flex items-baseline justify-between gap-4">
						<h3 class="font-medium">
							{variant.preset}
							<span class="ml-2 text-sm font-normal text-slate-500">
								fits inside {variant.boxWidth} x {variant.boxHeight}
							</span>
						</h3>
						<span class="text-sm text-slate-500">
							{variant.thumbnail?.width} x {variant.thumbnail?.height}
							{variant.thumbnail?.format}
						</span>
					</div>
					<p class="mt-2 text-sm text-slate-600">{variant.reason}</p>
					<p class="mt-2 font-mono text-xs break-all text-slate-400">{variant.thumbnail?.key}</p>
					<p class="mt-3 text-sm">
						{#if variant.reachable}
							<a href="/media/{data.record.id}/{variant.preset}" class="underline">
								Serve these bytes
							</a>
						{:else}
							<span class="text-amber-700">
								Bytes not reachable. The storage driver signed no URL and the plugin declares no
								route that serves a variant, so
								<code class="rounded bg-slate-100 px-1 py-0.5"
									>/media/{data.record.id}/{variant.preset}</code
								>
								answers 404 rather than quietly serving the full-size original at the variant's
								address.
							</span>
						{/if}
					</p>
					{#if variant.thumbnail?.byte_size === 0}
						<p class="mt-2 text-xs text-slate-400">
							byte_size reads 0. The column is written from a buffer the upload already drained, so
							it is zero for every variant the engine has ever generated. The file on disk has a
							real size. The record does not carry it.
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Not generated</h2>
	{#if absent.length === 0}
		<p class="mt-2 text-sm text-slate-500">Every preset produced a variant.</p>
	{:else}
		<ul class="mt-4 space-y-4">
			{#each absent as variant (variant.preset)}
				<li class="rounded-lg border border-slate-200 bg-slate-50 p-4">
					<h3 class="font-medium">
						{variant.preset}
						<span class="ml-2 text-sm font-normal text-slate-500">
							fits inside {variant.boxWidth} x {variant.boxHeight}
						</span>
					</h3>
					<p class="mt-2 text-sm text-slate-600">{variant.reason}</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
	<h2 class="font-semibold text-slate-900">The rule, and why it surprises people</h2>
	<p class="mt-2">
		A preset is skipped when the source is no larger than the box in
		<strong>both</strong>
		dimensions. A 1024 x 1024 upload therefore gets no
		<code class="rounded bg-white px-1 py-0.5">large</code>
		variant, because 1024 is not greater than 1024, and a 150 x 150 upload gets nothing at all. The
		comparison is inclusive at the boundary, so the exact preset size is a skip and not a copy.
	</p>
	<p class="mt-2">
		This is correct. Fitting a 900-pixel image inside a 1024-pixel box would write a larger file
		carrying no more detail, and the processor declining to do that is the right call. It reads as a
		bug because nothing in any response says a preset was considered and rejected: an absent
		variant and a failed encode look identical from outside, and the only record of the decision is
		a debug-level log line. This page reconstructs the reason by comparing the source dimensions
		against the presets, which is what any client has to do.
	</p>
	<p class="mt-2">
		The practical consequence is that a client must never assume a named variant exists. Ask for
		the record, read the variants it actually has, and fall back to the original.
	</p>
</section>

<section class="mt-8 text-sm text-slate-500">
	<p>
		Both routes were called for this page.
		<code class="rounded bg-slate-100 px-1 py-0.5">GET /api/admin/media/{'{'}id{'}'}</code>
		attached {data.attachedCount}
		{data.attachedCount === 1 ? 'variant' : 'variants'}, and
		<code class="rounded bg-slate-100 px-1 py-0.5"
			>GET /api/admin/media/{'{'}id{'}'}/thumbnails</code
		>
		returned {data.thumbnailRouteCount}. The second adds a
		<code class="rounded bg-slate-100 px-1 py-0.5">url</code>
		key and nothing else, which is why it is worth calling at all.
	</p>
</section>
