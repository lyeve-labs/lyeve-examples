<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Front page' },
		{ href: '/desk', label: 'The desk' }
	];
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b-4 border-slate-900">
		<div class="mx-auto flex max-w-5xl items-baseline justify-between px-6 py-6">
			<a href="/" class="font-serif text-2xl font-bold tracking-tight">The Meridian</a>
			<nav class="flex gap-5 text-sm">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="hover:text-slate-900 {page.url.pathname === item.href ||
						(item.href !== '/' && page.url.pathname.startsWith(item.href))
							? 'font-medium text-slate-900 underline decoration-2 underline-offset-4'
							: 'text-slate-500'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-5xl border-t border-slate-200 px-6 py-8 text-sm text-slate-500">
		The front page reads the public router. The desk reads and writes the admin router. Neither is
		reachable from this page: both are called from this app's server.
	</footer>
</div>
