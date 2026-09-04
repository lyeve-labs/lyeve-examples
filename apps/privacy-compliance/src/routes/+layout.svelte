<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/requests', label: 'Requests' },
		{ href: '/masking', label: 'Masking' },
		{ href: '/audit', label: 'Audit trail' },
		{ href: '/request', label: 'Make a request' }
	];
</script>

<div class="min-h-full bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">Privacy desk</a>
			<nav class="flex flex-wrap gap-5 text-sm">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="hover:text-slate-900 {page.url.pathname === item.href
							? 'font-medium text-slate-900'
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

	<footer class="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-500">
		Erasure is not reversible. Every erase on this desk names an identifier taken from a filed
		request, never one typed into a form, and refuses the account this app authenticates with.
	</footer>
</div>
