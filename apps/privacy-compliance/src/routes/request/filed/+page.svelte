<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Request filed</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Request filed</h1>
<p class="mt-3 max-w-2xl text-slate-600">
	It is in the register. Somebody will confirm your identity and answer within {data.responseDays}
	days.
</p>
{#if data.reference}
	<p class="mt-4 text-sm text-slate-500">
		Reference <code class="rounded bg-slate-200 px-2 py-1">{data.reference}</code>
	</p>
{/if}
<p class="mt-6 max-w-2xl text-sm text-slate-500">
	This page tells you nothing about what is held. Confirming whether an address is known to us,
	before anybody has checked who is asking, would answer that question for whoever asked.
</p>
<p class="mt-6"><a href="/request" class="text-sm underline">File another request</a></p>
