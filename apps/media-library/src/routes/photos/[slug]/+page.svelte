<script lang="ts">
	let { data } = $props();

	const metadataKeys = $derived(Object.keys(data.metadata));
</script>

<svelte:head><title>{data.photo.title} · Plate and Grain</title></svelte:head>

<nav class="text-sm text-slate-500">
	<a href="/" class="hover:underline">Albums</a>
	{#if data.album}
		<span class="px-1">/</span>
		<a href="/albums/{data.album.segment}" class="hover:underline">{data.album.title}</a>
	{/if}
</nav>

<h1 class="mt-2 text-3xl font-semibold tracking-tight">{data.photo.title}</h1>
{#if data.photo.caption}
	<p class="mt-3 max-w-2xl text-slate-600">{data.photo.caption}</p>
{/if}

{#if data.photo.mediaId}
	<figure class="mt-8">
		<img
			src="/media/{data.photo.mediaId}"
			alt={data.photo.title}
			width={data.photo.width || undefined}
			height={data.photo.height || undefined}
			class="max-h-[70vh] w-auto rounded-lg border border-slate-200 bg-slate-50"
		/>
	</figure>
{:else}
	<p class="mt-8 text-slate-500">This photograph has no media record attached.</p>
{/if}

{#if !data.hasRecord && data.photo.mediaId}
	<p class="mt-8 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-900">
		The entry names media id {data.photo.mediaId} and the engine has no such record. The file was
		deleted, or it belongs to another tenant.
	</p>
{/if}

{#if data.hasRecord}
	<div class="mt-10 grid gap-10 lg:grid-cols-2">
		<section>
			<h2 class="text-lg font-semibold tracking-tight">The media record</h2>
			<p class="mt-1 text-sm text-slate-500">
				Every field
				<code class="rounded bg-slate-100 px-1 py-0.5"
					>GET /api/admin/media/{'{'}id{'}'}</code
				>
				returned, with what each one actually means.
			</p>
			<dl class="mt-4 divide-y divide-slate-200 border-y border-slate-200 text-sm">
				{#each data.fields as field (field.label)}
					<div class="flex gap-4 py-2.5">
						<dt class="w-36 shrink-0 text-slate-500">{field.label}</dt>
						<dd class="min-w-0 break-words">
							<span class="font-mono text-xs">{field.value}</span>
							{#if field.note}
								<span class="mt-1 block text-xs text-slate-400">{field.note}</span>
							{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</section>

		<div class="space-y-10">
			<section>
				<h2 class="text-lg font-semibold tracking-tight">Virus scan</h2>
				<div
					class="mt-4 rounded-lg border p-4 text-sm {data.scan.unverified
						? 'border-amber-200 bg-amber-50 text-amber-900'
						: 'border-emerald-200 bg-emerald-50 text-emerald-900'}"
				>
					<p class="font-mono text-xs">scan_status: {data.scan.status || 'absent'}</p>
					{#if data.scan.result}
						<p class="font-mono text-xs">scan_result: {data.scan.result}</p>
					{/if}
					<p class="mt-3">{data.scan.explanation}</p>
				</div>
			</section>

			<section>
				<h2 class="text-lg font-semibold tracking-tight">Extracted metadata</h2>
				{#if metadataKeys.length === 0}
					<p class="mt-2 text-sm text-slate-500">
						The metadata document is empty. Every field carries omitempty, so a file with no EXIF
						produces no keys rather than a document full of nulls.
					</p>
				{:else}
					<dl class="mt-4 divide-y divide-slate-200 border-y border-slate-200 text-sm">
						{#each metadataKeys as key (key)}
							<div class="flex gap-4 py-2">
								<dt class="w-36 shrink-0 text-slate-500">{key}</dt>
								<dd class="min-w-0 break-words font-mono text-xs">
									{String(data.metadata[key])}
								</dd>
							</div>
						{/each}
					</dl>
					<p class="mt-3 text-sm text-slate-500">
						No camera, lens, software, artist, copyright, capture time or GPS fix appears here even
						when the file carried one. The strip removes those fields from the stored document as
						well as from the bytes, so a holiday photograph cannot publish where it was taken
						through the record or through the geographic search filter.
					</p>
				{/if}
			</section>

			<section>
				<h2 class="text-lg font-semibold tracking-tight">Variants</h2>
				<ul class="mt-4 space-y-2 text-sm">
					{#each data.variants as variant (variant.preset)}
						<li class="flex items-baseline gap-3">
							<span
								class="w-16 shrink-0 rounded px-2 py-0.5 text-center text-xs font-medium {variant.present
									? 'bg-slate-900 text-white'
									: 'bg-slate-100 text-slate-500'}"
							>
								{variant.preset}
							</span>
							<span class="text-slate-600">
								{#if variant.present && variant.thumbnail}
									{variant.thumbnail.width} x {variant.thumbnail.height}
									{variant.thumbnail.format}
								{:else}
									absent
								{/if}
							</span>
						</li>
					{/each}
				</ul>
				<a
					href="/photos/{data.photo.segment}/variants"
					class="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
				>
					Why these and not the others
				</a>
			</section>
		</div>
	</div>
{/if}
