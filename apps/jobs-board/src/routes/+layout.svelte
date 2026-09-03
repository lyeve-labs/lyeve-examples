<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-full bg-white text-slate-900">
	<header class="border-b border-slate-200">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">Harbourside Jobs</a>
			<p class="text-sm text-slate-500">Five employers, fifteen roles</p>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-3xl px-6 py-10 text-sm text-slate-500">
		Applications and CVs are sent to this server, which holds the only credential the engine
		accepts.
	</footer>
</div>
