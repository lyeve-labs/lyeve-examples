<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Keys' },
		{ href: '/metering', label: 'Metering' },
		{ href: '/feed', label: 'Feed' }
	];
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">Transit App Console</a>
			<nav class="flex gap-5 text-sm">
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
		The console holds an operator session. The phone holds a scoped API key and talks to the engine
		itself, which is the one place in this repository where something other than a server does.
	</footer>
</div>
