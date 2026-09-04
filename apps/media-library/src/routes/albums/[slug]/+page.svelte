<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>{data.album.title} · Plate and Grain</title></svelte:head>

<nav class="text-sm text-slate-500"><a href="/" class="hover:underline">Albums</a></nav>
<h1 class="mt-2 text-3xl font-semibold tracking-tight">{data.album.title}</h1>
{#if data.album.description}
	<p class="mt-3 max-w-2xl text-slate-600">{data.album.description}</p>
{/if}
<p class="mt-3 text-sm text-slate-500">
	Originals are stored under
	<code class="rounded bg-slate-100 px-1.5 py-0.5">{data.folder}</code>, which is
	<code class="rounded bg-slate-100 px-1.5 py-0.5">{data.storedInFolder}</code>
	{data.storedInFolder === 1 ? 'file' : 'files'} in the media store.
</p>

{#if data.photos.length === 0}
	<p class="mt-8 text-slate-500">This album has no photographs yet.</p>
{:else}
	<!--
		The grid points at /media/[id], the original, and lets the browser scale
		it. It does not point at /media/[id]/small, because a variant's bytes are
		not reachable over HTTP on a local storage driver. The width and height
		attributes come from the media record and are here to reserve the space
		before the bytes arrive rather than to resize anything.
	-->
	<ul class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
		{#each data.photos as photo (photo.id)}
			<li>
				<a href="/photos/{photo.segment}" class="group block">
					<div class="aspect-square overflow-hidden rounded-md bg-slate-100">
						{#if photo.mediaId}
							<img
								src="/media/{photo.mediaId}"
								alt={photo.title}
								width={photo.width || undefined}
								height={photo.height || undefined}
								class="h-full w-full object-cover transition group-hover:opacity-90"
								loading="lazy"
							/>
						{:else}
							<div class="flex h-full items-center justify-center text-xs text-slate-400">
								no file
							</div>
						{/if}
					</div>
					<p class="mt-2 truncate text-sm font-medium group-hover:underline">{photo.title}</p>
					{#if photo.width && photo.height}
						<p class="text-xs text-slate-400">{photo.width} x {photo.height}</p>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
{/if}

<section class="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
	<h2 class="font-semibold text-slate-900">
		{data.largeCapable} of {data.storedInFolder}
		{data.storedInFolder === 1 ? 'frame' : 'frames'} here can carry the large variant
	</h2>
	<p class="mt-2">
		A frame qualifies when it is wider than {data.largeBox} pixels or taller than {data.largeBox},
		and <code class="rounded bg-white px-1 py-0.5">POST /api/admin/media/search</code> has no way to
		express OR across two fields. That count is two searches and a union taken in this app. The
		content routes cannot ask the question at all: their only operator is exact equality, and they
		know nothing about a file's dimensions in the first place.
	</p>
</section>

{#if data.orphans.length > 0}
	<section class="mt-12 rounded-lg border border-amber-200 bg-amber-50 p-5">
		<h2 class="font-semibold text-amber-900">
			{data.orphans.length}
			{data.orphans.length === 1 ? 'file' : 'files'} in this folder with no photograph
		</h2>
		<p class="mt-2 text-sm text-amber-900">
			The bytes were stored and no content entry points at them. An upload that succeeds and a
			content write that then fails leaves exactly this, and nothing in the engine cleans it up.
		</p>
		<ul class="mt-3 space-y-1 font-mono text-xs text-amber-900">
			{#each data.orphans as orphan (orphan.id)}
				<li>{orphan.key} ({orphan.size} bytes)</li>
			{/each}
		</ul>
	</section>
{/if}
