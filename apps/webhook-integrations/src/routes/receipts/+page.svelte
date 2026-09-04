<script lang="ts">
	import { ago, clock } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head><title>Receipts</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Receipts</h1>
<p class="mt-1 text-sm text-slate-500">
	What the receiver decided about each delivery, written back into the engine as content. A
	rejection is recorded as carefully as an acceptance: it is the half that tells an operator the
	key is wrong.
</p>

<div class="mt-6 flex flex-wrap items-center gap-4 text-sm">
	<span class="text-slate-500">{data.total} receipts in total</span>
	<span class="text-slate-500">{data.nonces} nonces held against replay</span>
	{#if data.order}
		<span class="rounded bg-slate-100 px-2 py-0.5">
			filtered to {data.order.reference}
		</span>
		<a class="underline" href="/receipts">show all</a>
	{:else if data.askedFor}
		<span class="rounded bg-amber-50 px-2 py-0.5 text-amber-900">
			no order with the reference {data.askedFor}
		</span>
	{/if}
</div>

{#if data.tally.length > 0}
	<ul class="mt-4 flex flex-wrap gap-2 text-xs">
		{#each data.tally as entry (entry.verdict)}
			<li
				class="rounded-full px-3 py-1 {entry.good
					? 'bg-emerald-50 text-emerald-900'
					: 'bg-amber-50 text-amber-900'}"
			>
				{entry.label}: {entry.count}
			</li>
		{/each}
	</ul>
{/if}

{#if data.receipts.length === 0}
	<p class="mt-8 text-slate-500">
		Nothing received yet. Register the endpoints, then place an order or send a test.
	</p>
{:else}
	<div class="mt-6 space-y-3">
		{#each data.receipts as receipt (receipt.id)}
			<article class="rounded-lg border p-4 {receipt.good ? 'border-slate-200' : 'border-amber-300'}">
				<div class="flex flex-wrap items-center gap-3 text-sm">
					<span
						class="rounded px-2 py-0.5 text-xs font-medium {receipt.good
							? 'bg-emerald-50 text-emerald-900'
							: 'bg-amber-50 text-amber-900'}"
					>
						{receipt.label}
					</span>
					<span class="font-mono text-xs">{receipt.event}</span>
					<span class="font-mono text-xs text-slate-500">{receipt.sourceSchema}</span>
					<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{receipt.channel}</span>
					<span class="text-slate-500">answered HTTP {receipt.httpStatus}</span>
					<span class="text-slate-500" title={clock(receipt.receivedAt)}>
						{ago(receipt.receivedAt)}
					</span>
					{#if receipt.orderSlug}
						<a class="underline" href="/receipts?order={receipt.orderSlug}">
							{receipt.orderReference ?? receipt.orderSlug}
						</a>
					{/if}
				</div>
				<p class="mt-2 text-sm text-slate-700">{receipt.detail}</p>
				<p class="mt-1 text-xs text-slate-500">
					{receipt.mode} signature
					{#if receipt.algorithm}, {receipt.algorithm}{/if}
					{#if receipt.keyIndex === 0}, verified with the active key{/if}
					{#if receipt.keyIndex > 0}, verified with a key kept through a rotation{/if}
					{#if receipt.nonce}, nonce {receipt.nonce}{/if}
				</p>
				<details class="mt-2">
					<summary class="cursor-pointer text-xs text-slate-500">The payload as recorded</summary>
					<pre class="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-xs">{receipt.payload}</pre>
				</details>
			</article>
		{/each}
	</div>
{/if}

<p class="mt-8 text-sm text-slate-500">
	A stored payload is a record, not evidence. The content write path sanitizes HTML inside any
	string it is given, so a payload carrying markup is not kept byte for byte, and a signature can
	only ever be checked against the bytes as they arrived. That is why the receiver verifies first
	and never tries to re-verify a receipt.
</p>
