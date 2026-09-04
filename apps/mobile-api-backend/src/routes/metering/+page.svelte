<script lang="ts">
	import { bytes, count, limitLabel, when } from '$lib/format';

	let { data } = $props();

	const quota = $derived(data.quota);
	const rollup = $derived(data.rollup);
	const keyTotal = $derived(data.keys.reduce((sum: number, k: { requests: number }) => sum + k.requests, 0));
</script>

<svelte:head><title>Metering</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Metering</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	Two counters, two limits, one plugin. The usage plugin counts requests per tenant and answers
	with <code class="rounded bg-slate-100 px-1.5 py-0.5">X-Quota-*</code> headers on every response.
	It also counts requests and bytes per API key and enforces the key's own monthly limit.
	They share no counter and no table, and a client can be refused by either.
</p>

<section class="mt-8">
	<h2 class="text-lg font-semibold tracking-tight">Tenant quota, {data.tenant}</h2>

	{#if quota}
		<dl class="mt-4 grid grid-cols-4 gap-4">
			<div class="rounded-lg border border-slate-200 p-5">
				<dt class="text-sm text-slate-500">Requests</dt>
				<dd class="mt-1 text-2xl font-semibold tabular-nums">{limitLabel(quota.requestsLimit)}</dd>
			</div>
			<div class="rounded-lg border border-slate-200 p-5">
				<dt class="text-sm text-slate-500">Storage</dt>
				<dd class="mt-1 text-2xl font-semibold tabular-nums">
					{quota.storageLimit > 0 ? bytes(quota.storageLimit) : 'unlimited'}
				</dd>
			</div>
			<div class="rounded-lg border border-slate-200 p-5">
				<dt class="text-sm text-slate-500">Refuses over the limit</dt>
				<dd class="mt-1 text-2xl font-semibold">
					{quota.blockOnExceeded && quota.isHardLimit ? 'yes' : 'no'}
				</dd>
				<dd class="mt-1 text-xs text-slate-400">
					a 429 needs block_on_exceeded and is_hard_limit together
				</dd>
			</div>
			<div class="rounded-lg border border-slate-200 p-5">
				<dt class="text-sm text-slate-500">Blocked</dt>
				<dd class="mt-1 text-2xl font-semibold">{quota.blockedAt ? 'yes' : 'no'}</dd>
				<dd class="mt-1 text-xs text-slate-400">last changed {when(quota.updatedAt)}</dd>
			</div>
		</dl>
	{:else}
		<p class="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
			No quota row for this tenant, which the engine reads as unlimited and skips entirely.
		</p>
	{/if}

	<p class="mt-4 max-w-3xl rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
		This example never writes a request limit here, and the console offers no button for it. The
		stack runs single-tenant, so this one row governs every example sharing the engine, and a limit
		above zero switches on a counter write for every request any of them makes. The per-key monthly
		limit on the keys page is the lever that is actually isolated. What the write would look like
		is in the README.
	</p>
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">What the last response said</h2>
	<p class="mt-1 max-w-3xl text-sm text-slate-500">
		Read from the headers of one live call to
		<code class="rounded bg-slate-100 px-1.5 py-0.5">GET /api/v1/quotas/status</code>, made by this
		page load. The middleware writes these onto every response it sees, including the ones it
		refuses: an unauthenticated 401 carries them too.
	</p>

	<div class="mt-4 overflow-hidden rounded-lg border border-slate-200">
		<table class="w-full text-sm">
			<tbody class="divide-y divide-slate-200">
				<tr>
					<td class="px-4 py-2.5 font-mono text-xs text-slate-500">X-Quota-Requests-Used</td>
					<td class="px-4 py-2.5 tabular-nums">{data.headers.used ?? 'absent'}</td>
				</tr>
				<tr>
					<td class="px-4 py-2.5 font-mono text-xs text-slate-500">X-Quota-Requests-Limit</td>
					<td class="px-4 py-2.5 tabular-nums">{data.headers.limit ?? 'absent'}</td>
				</tr>
				<tr>
					<td class="px-4 py-2.5 font-mono text-xs text-slate-500">X-Quota-Requests-Pct</td>
					<td class="px-4 py-2.5 tabular-nums">{data.headers.pct ?? 'absent'}</td>
				</tr>
				<tr>
					<td class="px-4 py-2.5 font-mono text-xs text-slate-500">X-Quota-Warning-80</td>
					<td class="px-4 py-2.5">{data.headers.warning80 ? 'true' : 'absent'}</td>
				</tr>
				<tr>
					<td class="px-4 py-2.5 font-mono text-xs text-slate-500">X-Quota-Exceeded</td>
					<td class="px-4 py-2.5">{data.headers.exceeded ? 'true' : 'absent'}</td>
				</tr>
				<tr>
					<td class="px-4 py-2.5 font-mono text-xs text-slate-500">X-Quota-Blocked</td>
					<td class="px-4 py-2.5">{data.headers.blocked ? 'true' : 'absent'}</td>
				</tr>
			</tbody>
		</table>
	</div>

	{#if data.status}
		<p class="mt-3 text-sm text-slate-500">
			The body agreed: {count(data.status.requestsUsed)} used of
			{limitLabel(data.status.requestsLimit)}, {data.status.requestsPct}%.
		</p>
	{:else}
		<p class="mt-3 text-sm text-slate-500">
			The body was the no-quota message rather than a status object, which is the shape to expect
			when the tenant has no quota row.
		</p>
	{/if}
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Usage, {data.period}</h2>

	{#if rollup}
		<dl class="mt-4 grid grid-cols-4 gap-4">
			<div class="rounded-lg border border-slate-200 p-5">
				<dt class="text-sm text-slate-500">API calls by key</dt>
				<dd class="mt-1 text-2xl font-semibold tabular-nums">{count(rollup.apiCalls)}</dd>
			</div>
			<div class="rounded-lg border border-slate-200 p-5">
				<dt class="text-sm text-slate-500">Bandwidth</dt>
				<dd class="mt-1 text-2xl font-semibold tabular-nums">{bytes(rollup.bandwidthBytes)}</dd>
			</div>
			<div class="rounded-lg border border-slate-200 p-5">
				<dt class="text-sm text-slate-500">Content entries</dt>
				<dd class="mt-1 text-2xl font-semibold tabular-nums">{count(rollup.contentCount)}</dd>
				<dd class="mt-1 text-xs text-slate-400">every example's, not this one's</dd>
			</div>
			<div class="rounded-lg border border-slate-200 p-5">
				<dt class="text-sm text-slate-500">Media</dt>
				<dd class="mt-1 text-2xl font-semibold tabular-nums">{count(rollup.mediaCount)}</dd>
			</div>
		</dl>

		<p class="mt-4 max-w-3xl text-sm text-slate-500">
			Only the first two are about API keys. Content and media are counted straight out of the
			content and media plugins' own tables, so on a single-tenant stack they report the whole
			engine. The call count is the sum of the per-key rows below, because it is the same table
			aggregated a different way.
		</p>
	{:else}
		<p class="mt-4 max-w-3xl rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
			The tenant rollup answered 404. The usage plugin decides whether a tenant exists by asking
			whether it holds an API key, not by asking the tenant table, so a tenant with no keys is
			indistinguishable from one that was never created. Mint a key and this fills in.
		</p>
	{/if}
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">By key</h2>

	{#if data.keys.length === 0}
		<p class="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">No keys issued.</p>
	{:else}
		<div class="mt-4 overflow-x-auto rounded-lg border border-slate-200">
			<table class="w-full text-sm">
				<thead class="bg-slate-50 text-left text-slate-500">
					<tr>
						<th class="px-4 py-3 font-medium">Key</th>
						<th class="px-4 py-3 text-right font-medium">Requests</th>
						<th class="px-4 py-3 text-right font-medium">Monthly limit</th>
						<th class="px-4 py-3 text-right font-medium">Bytes out</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200">
					{#each data.keys as key (key.id)}
						<tr>
							<td class="px-4 py-3">
								<a href="/keys/{key.id}" class="font-medium hover:underline">{key.name}</a>
								{#if !key.enabled}
									<span class="ml-2 text-xs text-slate-400">revoked</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right tabular-nums">{count(key.requests)}</td>
							<td class="px-4 py-3 text-right tabular-nums">{limitLabel(key.monthlyLimit)}</td>
							<td class="px-4 py-3 text-right tabular-nums">{bytes(key.bytesOut)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot class="border-t border-slate-300 bg-slate-50">
					<tr>
						<td class="px-4 py-3 font-medium">Total</td>
						<td class="px-4 py-3 text-right font-medium tabular-nums">{count(keyTotal)}</td>
						<td class="px-4 py-3"></td>
						<td class="px-4 py-3"></td>
					</tr>
				</tfoot>
			</table>
		</div>

		<p class="mt-3 max-w-3xl text-sm text-slate-500">
			Metering runs on the public router only, and only for a request carrying
			<code class="rounded bg-slate-100 px-1.5 py-0.5">X-API-Key</code>. The admin router never
			populates the claims the meter reads, so nothing this console does moves these numbers, and
			a bearer request is billed to no key at all.
		</p>
	{/if}
</section>
