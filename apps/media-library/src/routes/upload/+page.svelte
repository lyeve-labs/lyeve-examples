<script lang="ts">
	let { data, form } = $props();

	const inputClass =
		'mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900';

	function bytes(n: number): string {
		if (n < 1024) return `${n} B`;
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
		return `${(n / 1024 / 1024).toFixed(2)} MiB`;
	}
</script>

<svelte:head><title>Upload · Plate and Grain</title></svelte:head>

<h1 class="text-3xl font-semibold tracking-tight">Upload</h1>
<p class="mt-3 max-w-2xl text-slate-600">
	One multipart request carries the whole batch. The engine reads every file part in the form, and
	the folder and the alt text are read once and applied to all of them.
</p>

{#if form?.error}
	<div class="mt-8 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-900">
		<p>{form.error}</p>
		{#if form.batchSize}
			<p class="mt-2 text-sm">
				Nothing was kept. The handler deletes every file it had already stored in the request before
				the failure, so a batch of {form.batchSize} either lands whole or leaves no trace.
			</p>
		{/if}
	</div>
{/if}

{#if data.albums.length === 0}
	<p class="mt-8 text-slate-500">
		No albums exist yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> first.
	</p>
{:else}
	<!--
		A plain multipart POST to the page's own action. No client-side
		enhancement, so the credential stays on the server and the form works with
		JavaScript switched off.
	-->
	<form method="POST" enctype="multipart/form-data" class="mt-8 max-w-xl space-y-6">
		<div>
			<label class="block" for="album">
				<span class="text-sm font-medium">Album</span>
				<select id="album" name="album" required class={inputClass}>
					{#each data.albums as album (album.id)}
						<option value={album.id}>{album.title}</option>
					{/each}
				</select>
			</label>
			<p class="mt-1 text-xs text-slate-500">
				Decides the storage folder. A folder may hold only
				<code class="rounded bg-slate-100 px-1 py-0.5">a-z 0-9 _ - /</code>, so an album segment
				with a capital letter would fail the upload with a 400 naming the character.
			</p>
		</div>

		<div>
			<label class="block" for="alt_text">
				<span class="text-sm font-medium">Alt text <span class="font-normal text-slate-400">(optional)</span></span>
				<input id="alt_text" type="text" name="alt_text" class={inputClass} />
			</label>
			<p class="mt-1 text-xs text-slate-500">
				One value for the entire batch. There is no route that changes it afterwards, so a wrong
				one is corrected by deleting and re-uploading.
			</p>
		</div>

		<div>
			<label class="block" for="files">
				<span class="text-sm font-medium">Images</span>
				<input
					id="files"
					type="file"
					name="files"
					multiple
					accept="image/png,image/jpeg,image/gif,image/webp"
					required
					class="mt-2 block w-full text-sm"
				/>
			</label>
			<p class="mt-1 text-xs text-slate-500">
				SVG is refused outright, whatever the file is named, and the declared type is ignored in
				favor of what the leading bytes actually are.
			</p>
		</div>

		<button class="rounded-md bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700">
			Upload
		</button>
	</form>
{/if}

{#if form?.accepted}
	<section class="mt-12">
		<h2 class="text-lg font-semibold tracking-tight">
			What came back, into {form.albumTitle}
		</h2>
		<p class="mt-1 text-sm text-slate-500">
			The upload response is a JSON array even for a single file, and it carries no variants: the
			variant rows are written before the request returns but never attached to the record it
			marshals, so each line below cost a second request to find out.
		</p>

		<ul class="mt-6 space-y-4">
			{#each form.accepted as item (item.id)}
				<li class="rounded-lg border border-slate-200 p-4">
					<div class="flex flex-wrap items-baseline justify-between gap-3">
						<h3 class="font-medium">{item.filename}</h3>
						<span class="text-sm text-slate-500">
							{item.width} x {item.height} · {bytes(item.size)} · {item.contentType}
						</span>
					</div>

					<dl class="mt-3 space-y-1 text-xs">
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-slate-500">key</dt>
							<dd class="break-all font-mono">{item.key}</dd>
						</div>
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-slate-500">folder</dt>
							<dd class="font-mono">{item.folder}</dd>
						</div>
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-slate-500">scan</dt>
							<dd class="font-mono">{item.scanStatus} ({item.scanResult || 'no message'})</dd>
						</div>
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-slate-500">tags</dt>
							<dd class="font-mono">{item.tags.join(', ') || 'none'}</dd>
						</div>
						<div class="flex gap-3">
							<dt class="w-28 shrink-0 text-slate-500">variants</dt>
							<dd class="font-mono">{item.variants.join(', ') || 'none'}</dd>
						</div>
						{#if item.skipped.length > 0}
							<div class="flex gap-3">
								<dt class="w-28 shrink-0 text-slate-500">skipped</dt>
								<dd class="font-mono">
									{item.skipped.join(', ')}
									<span class="ml-1 font-sans text-slate-400">
										(the source already fits inside {item.skipped.length === 1
											? 'that box'
											: 'those boxes'}, so resizing would only enlarge the file)
									</span>
								</dd>
							</div>
						{/if}
						{#if item.missing.length > 0}
							<div class="flex gap-3">
								<dt class="w-28 shrink-0 text-slate-500">absent</dt>
								<dd class="font-mono">
									{item.missing.join(', ')}
									<span class="ml-1 font-sans text-amber-700">
										(the source is large enough, so the encode failed)
									</span>
								</dd>
							</div>
						{/if}
					</dl>

					<p class="mt-3 text-sm">
						{#if item.photoSegment}
							<a href="/photos/{item.photoSegment}" class="underline">Open the photograph</a>
							{#if item.slugRetried}
								<span class="text-slate-500">
									· the readable slug was already taken by another entry in this tenant, so the
									record id was appended
								</span>
							{/if}
						{:else}
							<span class="text-rose-700">
								The file is stored and no entry points at it: {item.entryError}
							</span>
						{/if}
					</p>
				</li>
			{/each}
		</ul>

		<p class="mt-6 text-sm text-slate-500">
			<a href="/albums/{form.albumSegment}" class="underline">Back to the album</a>
		</p>
	</section>
{/if}

<section class="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
	<h2 class="font-semibold text-slate-900">What the upload does to the bytes</h2>
	<p class="mt-2">
		The stored file is not the file you sent. An image the engine can decode is re-encoded to strip
		EXIF, the orientation tag is baked into the pixels and removed, and
		<code class="rounded bg-white px-1 py-0.5">size</code>
		is rewritten to the length of the replacement. The picture survives. The file does not, so a
		checksum is no way to tell whether the stored copy is current.
	</p>
	<p class="mt-2">
		Then each of the {data.presets.length} presets is tried in turn:
		{#each data.presets as preset, i (preset.name)}{preset.name} at {preset.width} x {preset.height}{i <
			data.presets.length - 1
				? ', '
				: ''}{/each}. A preset whose box already contains the source in both dimensions is skipped
		rather than upscaled, which is why a small image can arrive with no variants at all.
	</p>
</section>
