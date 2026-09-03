<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children, data } = $props();

	const nav = [
		{ href: '/', label: 'Articles' },
		{ href: '/account', label: 'Account' }
	];
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">Cold Path</a>
			<nav class="flex items-center gap-5 text-sm">
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
				{#if data.reader}
					<span
						class="rounded-full px-2.5 py-1 text-xs font-medium {data.reader.tier === 'member' &&
						data.reader.status === 'active'
							? 'bg-emerald-100 text-emerald-800'
							: 'bg-slate-100 text-slate-600'}"
					>
						{data.reader.name}
					</span>
				{:else}
					<a href="/account" class="text-slate-500 hover:text-slate-900">Sign in</a>
				{/if}
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-3xl px-6 py-10 text-sm text-slate-500">
		Gating is decided on the server. The engine is never reachable from this page, and a paid body
		is never sent to a browser that has not earned it.
	</footer>
</div>
