<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Tenants' },
		{ href: '/usage', label: 'Usage' }
	];

	function active(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<div class="min-h-full bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<div>
				<a href="/" class="text-base font-semibold tracking-tight">Meterhouse</a>
				<p class="text-xs text-slate-500">Tenant operations console</p>
			</div>
			<nav class="flex gap-5 text-sm">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="hover:text-slate-900 {active(item.href)
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

	<footer class="mx-auto max-w-5xl px-6 pb-12 text-xs leading-relaxed text-slate-500">
		Every call on this page is made by the SvelteKit server with a super_admin session. The engine
		is not reachable from the browser, and the tenant a request acts as is decided by a header the
		browser never sends.
	</footer>
</div>
