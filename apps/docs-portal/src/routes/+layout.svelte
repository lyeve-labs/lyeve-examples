<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
			<a href="/" class="text-lg font-semibold tracking-tight">Engine Guide</a>

			<nav class="flex gap-4 text-sm">
				{#each data.spaces as space (space.id)}
					<a
						href="/docs/{space.slug}"
						class="hover:text-slate-900 {page.url.pathname.startsWith(`/docs/${space.slug}`)
							? 'font-medium text-slate-900'
							: 'text-slate-500'}"
					>
						{space.title}
					</a>
				{/each}
			</nav>

			<form method="GET" action="/search" class="ml-auto">
				<label class="sr-only" for="site-search">Search the documentation</label>
				<input
					id="site-search"
					type="search"
					name="q"
					value={page.url.pathname === '/search' ? (page.url.searchParams.get('q') ?? '') : ''}
					placeholder="Search the documentation"
					class="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-900"
				/>
			</form>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-500">
		Nesting and ordering are built in this application. The engine returns a flat list.
	</footer>
</div>
