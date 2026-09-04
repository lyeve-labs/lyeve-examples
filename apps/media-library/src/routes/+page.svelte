<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Plate and Grain</title></svelte:head>

<h1 class="text-3xl font-semibold tracking-tight">Albums</h1>
<p class="mt-3 max-w-2xl text-slate-600">
	A photo library built on the media plugin. Uploads, folders, generated variants, storage keys and
	the metadata the engine keeps, rather than a content type with an image id bolted to it.
</p>

{#if data.albums.length === 0}
	<p class="mt-8 text-slate-500">
		No albums yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to create
		the content types and seed three albums with generated photographs.
	</p>
{:else}
	<ul class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.albums as album (album.id)}
			<li class="overflow-hidden rounded-lg border border-slate-200">
				<a href="/albums/{album.segment}" class="block">
					<div class="aspect-[4/3] bg-slate-100">
						{#if album.coverId}
							<img
								src="/media/{album.coverId}"
								alt=""
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						{/if}
					</div>
					<div class="p-4">
						<h2 class="font-semibold tracking-tight">{album.title}</h2>
						<p class="mt-1 text-sm text-slate-500">
							{album.count}
							{album.count === 1 ? 'photograph' : 'photographs'}
						</p>
						{#if album.description}
							<p class="mt-2 text-sm text-slate-600">{album.description}</p>
						{/if}
					</div>
				</a>
			</li>
		{/each}
	</ul>

	<section class="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
		<h2 class="font-semibold text-slate-900">What these numbers are counting</h2>
		<dl class="mt-3 space-y-2">
			<div class="flex gap-3">
				<dt class="w-56 shrink-0 text-slate-500">Photo entries in this app</dt>
				<dd>{data.photoTotal}{data.unfiled > 0 ? `, of which ${data.unfiled} are unfiled` : ''}</dd>
			</div>
			<div class="flex gap-3">
				<dt class="w-56 shrink-0 text-slate-500">Media rows in the tenant</dt>
				<dd>{data.mediaTotal}</dd>
			</div>
		</dl>
		<p class="mt-3">
			The second number is larger and always will be. A media record belongs to the tenant, not to
			an app, so it counts every cover image every other example uploaded, and it keeps counting a
			file after the entry that referenced it is gone. Deleting a photo does not delete its bytes.
		</p>
		<p class="mt-2">
			A media list also never carries variants. Only
			<code class="rounded bg-white px-1 py-0.5">GET /api/admin/media/{'{'}id{'}'}</code> attaches
			them, so knowing which of a hundred files have a thumbnail costs a hundred requests.
		</p>
	</section>
{/if}
