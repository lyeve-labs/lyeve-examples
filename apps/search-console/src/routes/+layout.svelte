<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Knowledge base' },
		{ href: '/instant', label: 'Instant' },
		{ href: '/console', label: 'Console' }
	];

	const current = $derived(page.url.pathname);
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
			<div>
				<a href="/" class="text-lg font-semibold tracking-tight">Operations knowledge base</a>
				<p class="text-xs text-slate-500">
					Full-text search, synonyms, ranking, instant search and analytics
				</p>
			</div>
			<nav class="flex flex-wrap gap-5 text-sm">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="hover:text-slate-900 {current === item.href
							? 'font-medium text-slate-900'
							: 'text-slate-500'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<!--
		Preloading is narrowed to a tap inside the page. The front page's load
		function posts a search to the analytics log, and app.html turns on
		preloading for hover, so every link to a query would have logged a search
		nobody ran as soon as the pointer crossed it. A load function with a side
		effect has to think about prefetching.
	-->
	<main class="mx-auto max-w-5xl px-6 py-10" data-sveltekit-preload-data="tap">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-500">
		Search has no public route. Every query on this site was made by the SvelteKit server against
		<code class="rounded bg-slate-100 px-1.5 py-0.5">/api/admin/search</code>, because the browser
		holds no credential and there is nothing on the public router to point it at.
	</footer>
</div>
