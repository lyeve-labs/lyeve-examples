<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Translations: {data.entry.title}</title></svelte:head>

<a href="/translations" class="text-sm text-slate-500 hover:underline">&lt; All records</a>

<h1 class="mt-4 text-2xl font-semibold tracking-tight">{data.entry.title}</h1>
<p class="mt-1 text-sm text-slate-400">
	{data.entry.kind} · {data.entry.slug} · {data.totalRows} translation{data.totalRows === 1
		? ''
		: 's'} on record
</p>

<section class="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm">
	<h2 class="font-medium text-slate-900">Source record</h2>
	<p class="mt-2 text-slate-600">
		The content entry itself. It is not a translation and the plugin never reads it, so the default
		locale needs a row of its own like every other language. This site falls back to the text below
		when a record has no translations at all.
	</p>
	<p class="mt-3 font-medium text-slate-900">{data.entry.title}</p>
	{#if data.entry.summary}<p class="mt-1 text-slate-600">{data.entry.summary}</p>{/if}
</section>

{#each data.locales as locale (locale.code)}
	{@const submitted = form?.locale === locale.code ? form.values : null}
	<section class="mt-8 rounded-lg border border-slate-200 p-5">
		<header class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="flex items-center gap-2 text-lg font-semibold tracking-tight">
				{locale.label}
				<span class="text-xs font-normal text-slate-400">{locale.code}</span>
				<StatusBadge status={locale.status ?? 'missing'} />
			</h2>
			{#if locale.updatedAt}
				<p class="text-xs text-slate-400">
					updated {new Date(locale.updatedAt).toLocaleString()}
				</p>
			{/if}
		</header>

		{#if form?.locale === locale.code && form?.message}
			<p class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
				{form.message}
			</p>
		{/if}

		<form method="POST" action="?/save" class="mt-4 space-y-3">
			<input type="hidden" name="entryId" value={data.entry.id} />
			<input type="hidden" name="locale" value={locale.code} />
			<input type="hidden" name="exists" value={String(locale.exists)} />

			<label class="block text-sm">
				<span class="font-medium">Title</span>
				<input
					name="title"
					value={submitted?.title ?? locale.title}
					required
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
			</label>

			<label class="block text-sm">
				<span class="font-medium">Summary</span>
				<input
					name="summary"
					value={submitted?.summary ?? locale.summary}
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
			</label>

			<label class="block text-sm">
				<span class="font-medium">Body</span>
				<textarea
					name="text"
					rows="6"
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-slate-900"
					>{submitted?.text ?? locale.text}</textarea
				>
				<span class="text-xs text-slate-400">
					Blank line between paragraphs. Stored inside the translation body, which the engine keeps
					as opaque JSON.
				</span>
			</label>

			<label class="block text-sm">
				<span class="font-medium">Meta description</span>
				<input
					name="description"
					value={submitted?.description ?? locale.description}
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
			</label>

			<div class="flex flex-wrap items-center gap-3">
				<label class="text-sm">
					<span class="font-medium">Status</span>
					<select
						name="status"
						class="ml-2 rounded-md border border-slate-300 px-2 py-1.5 outline-none focus:border-slate-900"
					>
						{#each ['draft', 'translated', 'outdated'] as option (option)}
							<option value={option} selected={(submitted?.status ?? locale.status ?? 'draft') === option}>
								{option}
							</option>
						{/each}
					</select>
				</label>

				<button
					class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
				>
					{locale.exists ? 'Save' : 'Create'}
				</button>
			</div>
		</form>

		{#if locale.exists}
			<form method="POST" action="?/remove" class="mt-3">
				<input type="hidden" name="entryId" value={data.entry.id} />
				<input type="hidden" name="locale" value={locale.code} />
				<button class="text-xs text-rose-700 hover:underline">
					Delete this translation
				</button>
			</form>
		{/if}
	</section>
{/each}
