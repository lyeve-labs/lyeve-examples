<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { LOCALES, localeLabel } from '$lib/locales';
	import { SITE } from '$lib/site';

	let { data } = $props();
</script>

<svelte:head>
	<title>{SITE.name}</title>
	<meta name="description" content={SITE.tagline} />
</svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">{SITE.name}</h1>
<p class="mt-2 text-slate-600">{SITE.tagline}</p>

<p class="mt-4 text-sm text-slate-500">
	Reading in <span class="font-medium text-slate-900">{localeLabel(data.locale)}</span>, falling
	back through {data.chain.map((c) => localeLabel(c)).join(' then ')}.
</p>

{#each data.sections as section (section.id)}
	<section class="mt-10">
		<h2 class="flex flex-wrap items-baseline gap-2 text-lg font-semibold tracking-tight">
			{section.label.title}
			{#if section.label.locale !== data.locale}
				<span class="text-xs font-normal text-slate-400">
					label in {localeLabel(section.label.locale)}
				</span>
			{/if}
		</h2>

		<ul class="mt-3 divide-y divide-slate-200 border-t border-slate-200">
			{#each section.pages as page (page.id)}
				<li class="py-4">
					<div class="flex flex-wrap items-baseline justify-between gap-3">
						<h3 class="text-base font-medium">
							<a href={`/${data.locale}/${page.slug}`} class="hover:underline">
								{page.localized.title}
							</a>
						</h3>
						<div class="flex items-center gap-1.5">
							{#each LOCALES as option (option.code)}
								<a
									href={`/${option.code}/${page.slug}`}
									title={option.label}
									class="text-xs"
								>
									<StatusBadge
										status={page.available[option.code] ?? 'missing'}
										label={option.code}
									/>
								</a>
							{/each}
						</div>
					</div>

					{#if page.localized.summary}
						<p class="mt-1 text-sm text-slate-600">{page.localized.summary}</p>
					{/if}

					{#if page.localized.status === 'source'}
						<p class="mt-2 text-xs text-slate-500">
							No translation on record. Showing the source entry, titled
							<span class="italic">{page.sourceTitle}</span>.
						</p>
					{:else if page.localized.locale !== data.locale}
						<p class="mt-2 text-xs text-slate-500">
							Not available in {localeLabel(data.locale)}. Showing
							{localeLabel(page.localized.locale)}.
						</p>
					{:else if page.localized.status !== 'translated'}
						<p class="mt-2 text-xs text-slate-500">
							This translation is marked {page.localized.status}.
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/each}

{#if data.orphans.length > 0}
	<section class="mt-10">
		<h2 class="text-lg font-semibold tracking-tight">Unfiled</h2>
		<ul class="mt-3 divide-y divide-slate-200 border-t border-slate-200">
			{#each data.orphans as page (page.id)}
				<li class="py-4">
					<a href={`/${data.locale}/${page.slug}`} class="font-medium hover:underline">
						{page.localized.title}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.sections.length === 0 && data.orphans.length === 0}
	<p class="mt-8 text-slate-500">
		Nothing published yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to
		provision the content types, seed the pages and import the translations.
	</p>
{/if}
