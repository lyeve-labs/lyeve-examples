<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">Longshore Market</a>
			<p class="text-sm text-slate-500">Four workshops, one catalog</p>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-5xl px-6 py-10 text-sm text-slate-500">
		Every product, seller and review is stored in LyEve. The browser never talks to the engine:
		it has no anonymous read, so this server holds the credential and the pages hold the markup.
	</footer>
</div>
