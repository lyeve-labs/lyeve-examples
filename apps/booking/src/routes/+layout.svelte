<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="min-h-full bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
			<a href="/" class="text-lg font-semibold tracking-tight">Northgate Practice</a>
			<p class="text-sm text-slate-500">Consultation booking</p>
		</div>
	</header>

	<main class="mx-auto max-w-4xl px-6 py-10">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-4xl px-6 pb-10 text-sm text-slate-500">
		The engine stores the schedule. Every rule about who may take which hour is
		application code in this repo, and the README says exactly how far that goes.
	</footer>
</div>
