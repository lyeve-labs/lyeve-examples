<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Status' },
		{ href: '/ops', label: 'Operations' }
	];
</script>

<div class="min-h-full bg-slate-950 text-slate-100">
	<header class="border-b border-slate-800">
		<div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">Meridian Platform Status</a>
			<nav class="flex gap-5 text-sm">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="hover:text-white {page.url.pathname === item.href
							? 'font-medium text-white'
							: 'text-slate-400'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-4xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-4xl px-6 py-10 text-sm text-slate-500">
		Server-rendered by SvelteKit and kept live by one event stream per browser. The engine holds the
		credential and this page never sees it.
	</footer>
</div>
