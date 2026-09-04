<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { LOCALES, localeLabel, localeTag } from '$lib/locales';
	import { chrome } from '$lib/site';

	let { data } = $props();

	const text = $derived(data.localized);
	const labels = $derived(chrome(data.locale));
	const paragraphs = $derived(text.text.split('\n\n').filter((p) => p.trim() !== ''));
</script>

<svelte:head>
	<title>{text.title}</title>
	{#if text.description}
		<meta name="description" content={text.description} />
	{/if}
	{#each LOCALES as option (option.code)}
		<link rel="alternate" hreflang={option.tag} href={`/${option.code}/${data.slug}`} />
	{/each}
</svelte:head>

<article>
	<a href={`/${data.locale}`} class="text-sm text-slate-500 hover:underline">
		&lt; {labels.home}
	</a>

	{#if data.section}
		<p class="mt-6 text-xs font-medium uppercase tracking-wide text-slate-400">
			{data.section.label.title}
		</p>
	{/if}

	<h1 class="mt-2 text-3xl font-semibold tracking-tight" lang={localeTag(text.locale)}>
		{text.title}
	</h1>

	<!--
		The two notices are independent. A page can be both a fallback and a
		draft, which is what /fr-CA/getting-here is: French is the first language
		on the chain with a version, and that version is unfinished.
	-->
	{#if text.status === 'source'}
		<p class="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
			This page has no translation in any language yet, so you are reading the
			{labels.sourceRecord.toLowerCase()}: the content entry as it was written.
		</p>
	{:else if text.locale !== data.locale}
		<p class="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			Not yet available in {localeLabel(data.locale)}. You are reading
			{localeLabel(text.locale)}, the first language on this page's fallback chain that has a
			version.
		</p>
	{/if}

	{#if text.status === 'draft'}
		<p class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			This {localeLabel(text.locale)} translation is still a draft and may change.
		</p>
	{:else if text.status === 'outdated'}
		<p class="mt-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
			This {localeLabel(text.locale)} translation is marked outdated: the source text has moved on
			since it was written.
		</p>
	{/if}

	{#if text.summary}
		<p class="mt-6 text-lg text-slate-600" lang={localeTag(text.locale)}>{text.summary}</p>
	{/if}

	<div class="mt-6 space-y-4 leading-relaxed text-slate-700" lang={localeTag(text.locale)}>
		{#each paragraphs as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	<section class="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm">
		<h2 class="font-medium text-slate-900">How this page was resolved</h2>
		<dl class="mt-3 grid grid-cols-[10rem_1fr] gap-y-1.5 text-slate-600">
			<dt>Requested</dt>
			<dd>{data.engine.requestedLocale}</dd>
			<dt>Engine chain</dt>
			<dd>{data.engine.chain.join(' -> ')}</dd>
			<dt>Engine answer</dt>
			<dd>
				{#if data.engine.foundTranslation}
					{data.engine.resolvedLocale}, marked {data.engine.status}
				{:else}
					nothing on the chain, so an empty title with a 200
				{/if}
			</dd>
			<dt>Rendered</dt>
			<dd>
				{text.status === 'source'
					? 'the source content entry, chosen by this app'
					: `${text.locale}, marked ${text.status}`}
			</dd>
			<dt>Entry status</dt>
			<dd>{data.engine.entryStatus}</dd>
		</dl>

		<div class="mt-4 flex flex-wrap items-center gap-2">
			<span class="text-slate-500">Versions:</span>
			{#each LOCALES as option (option.code)}
				<a href={`/${option.code}/${data.slug}`}>
					<StatusBadge status={data.available[option.code] ?? 'missing'} label={option.code} />
				</a>
			{/each}
			<a href={`/translations/${data.slug}`} class="ml-2 text-slate-500 hover:underline">
				Edit translations
			</a>
		</div>
	</section>
</article>
