<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-4xl items-baseline justify-between px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">The Ledger, migrated</a>
			<p class="text-sm text-slate-500">CSV export to LyEve, with the real CLI</p>
		</div>
	</header>

	<main class="mx-auto max-w-4xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-4xl px-6 py-10 text-sm text-slate-500">
		Every number on this page was read back from the engine or scraped from the report the tool
		printed. Nothing is hard coded.
	</footer>
</div>
