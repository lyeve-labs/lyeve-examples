<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Overview' },
		{ href: '/requests', label: 'Requests' },
		{ href: '/health', label: 'Health' },
		{ href: '/quota', label: 'Quota' },
		{ href: '/notes', label: 'Notes' }
	];
</script>

<div class="min-h-full bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto max-w-6xl px-6 py-5">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<p class="text-lg font-semibold tracking-tight">Engine telemetry</p>
					<p class="text-sm text-slate-500">What this LyEve instance knows about itself</p>
				</div>
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
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-8">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-6xl px-6 pb-12 text-sm text-slate-500">
		Every panel names the route it read and whether that route collects on its own. A zero with no
		badge would be a guess.
	</footer>
</div>
