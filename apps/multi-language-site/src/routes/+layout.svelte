<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import {
		LOCALES,
		currentLocale,
		isLocalizedPath,
		localeTag,
		switchLocale
	} from '$lib/locales';
	import { SITE, chrome } from '$lib/site';

	let { children } = $props();

	// The URL is the only place the current locale lives. Nothing is stored in a
	// cookie or negotiated from Accept-Language: the engine's locale middleware
	// is never installed, so a header would change nothing, and a URL per locale
	// is what a search engine and a shared link both need.
	const locale = $derived(currentLocale(page.params.locale));
	const labels = $derived(chrome(locale));
	const localized = $derived(isLocalizedPath(page.url.pathname));
</script>

<svelte:head>
	<meta name="robots" content="index, follow" />
</svelte:head>

<div class="min-h-full bg-white text-slate-900" lang={localeTag(locale)}>
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-5">
			<a href={`/${locale}`} class="text-lg font-semibold tracking-tight">{SITE.name}</a>

			<nav class="flex items-center gap-5 text-sm">
				<a
					href={`/${locale}`}
					class="hover:text-slate-900 {page.url.pathname === `/${locale}`
						? 'font-medium text-slate-900'
						: 'text-slate-500'}"
				>
					{labels.home}
				</a>
				<a
					href="/translations"
					class="hover:text-slate-900 {page.url.pathname.startsWith('/translations')
						? 'font-medium text-slate-900'
						: 'text-slate-500'}"
				>
					{labels.translations}
				</a>
			</nav>
		</div>

		<!--
			The switcher keeps the slug, because the slug is not localized: the
			engine translates title, body and meta and leaves the entry's own
			columns alone. One record, one URL path, four languages. The editor
			routes are not under a locale and show every language at once, so
			they get no switcher.
		-->
		{#if localized}
			<div class="mx-auto flex max-w-4xl flex-wrap gap-2 px-6 pb-4 text-sm">
				{#each LOCALES as option (option.code)}
					<a
						href={switchLocale(page.url.pathname, option.code)}
						hreflang={option.tag}
						class="rounded-full border px-3 py-1 {option.code === locale
							? 'border-slate-900 bg-slate-900 text-white'
							: 'border-slate-300 text-slate-600 hover:border-slate-500'}"
					>
						{option.label}
					</a>
				{/each}
			</div>
		{/if}
	</header>

	<main class="mx-auto max-w-4xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-4xl px-6 py-10 text-sm text-slate-500">
		{SITE.tagline} Rendered on the server. The engine is never reachable from this page.
	</footer>
</div>
