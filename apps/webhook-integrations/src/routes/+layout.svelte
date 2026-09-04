<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Endpoints' },
		{ href: '/orders', label: 'Orders' },
		{ href: '/deliveries', label: 'Deliveries' },
		{ href: '/receipts', label: 'Receipts' },
		{ href: '/inbound', label: 'Inbound' }
	];

	const current = $derived(page.url.pathname);
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
			<div>
				<a href="/" class="text-lg font-semibold tracking-tight">Webhook integrations</a>
				<p class="text-xs text-slate-500">Outbound delivery, signature verification, inbound events</p>
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

	<main class="mx-auto max-w-6xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-500">
		The browser holds no credential. Every engine call on this page was made by the SvelteKit
		server, and the engine's deliveries arrive at
		<code class="rounded bg-slate-100 px-1.5 py-0.5">POST /hooks/receive</code> on this app.
	</footer>
</div>
