<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">Meridian Learning</a>
			<nav class="flex gap-5 text-sm">
				<a
					href="/"
					class="hover:text-slate-900 {page.url.pathname === '/'
						? 'font-medium text-slate-900'
						: 'text-slate-500'}"
				>
					Catalog
				</a>
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-500">
		Courses, modules and lessons are three content types in one LyEve engine. The browser never
		reaches it.
	</footer>
</div>
