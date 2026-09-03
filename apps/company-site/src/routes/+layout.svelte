<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { COMPANY, NAV, pagePath } from '$lib/site';

	let { data, children } = $props();

	const year = new Date().getFullYear();
</script>

<svelte:head>
	<meta name="robots" content="index, follow" />
	<meta property="og:site_name" content={COMPANY.name} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-5">
			<a href="/" class="flex items-baseline gap-2">
				<span class="text-lg font-semibold tracking-tight">{COMPANY.name}</span>
			</a>
			<nav class="flex flex-wrap gap-5 text-sm">
				{#each NAV as item (item.href)}
					<a
						href={item.href}
						class="hover:text-slate-900 {page.url.pathname === item.href ||
						page.url.pathname.startsWith(item.href + '/')
							? 'font-medium text-slate-900'
							: 'text-slate-500'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-12">
		{@render children()}
	</main>

	<footer class="border-t border-slate-200">
		<div
			class="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 text-sm text-slate-500 sm:flex-row sm:justify-between"
		>
			<div class="max-w-sm">
				<p class="font-medium text-slate-900">{COMPANY.name}</p>
				<p class="mt-1">{COMPANY.tagline}</p>
				<p class="mt-3 text-xs">
					Every page here is rendered on the server. The engine is never reachable from the browser.
				</p>
			</div>
			<nav class="flex flex-col gap-2">
				<p class="text-xs font-medium uppercase tracking-wide text-slate-400">Resources</p>
				{#each data.footerLinks as link (link.slug)}
					<a href={pagePath(link.slug)} class="hover:text-slate-900">{link.title}</a>
				{/each}
				<a href="/sitemap.xml" class="hover:text-slate-900">Sitemap</a>
			</nav>
			<p class="text-xs">&copy; {year} {COMPANY.name}. Fictional company, real code.</p>
		</div>
	</footer>
</div>
