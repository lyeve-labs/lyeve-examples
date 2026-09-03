<script lang="ts">
	import { bytes, count, limit, percent, periodLabel } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>Usage</title></svelte:head>

<div class="flex flex-wrap items-baseline justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Usage</h1>
		<p class="mt-1 text-sm text-slate-500">{periodLabel(data.period)}</p>
	</div>

	<form method="GET" class="flex gap-2">
		<input
			type="month"
			name="period"
			value={data.period}
			class="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
		/>
		<button class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">
			Show
		</button>
	</form>
</div>

<div class="mt-6 grid gap-4 sm:grid-cols-4">
	<div class="rounded-lg border border-slate-200 bg-white p-5">
		<p class="text-xs uppercase tracking-wide text-slate-500">API calls</p>
		<p class="mt-1 text-2xl font-semibold tracking-tight">{count(data.totals.apiCalls)}</p>
	</div>
	<div class="rounded-lg border border-slate-200 bg-white p-5">
		<p class="text-xs uppercase tracking-wide text-slate-500">Bandwidth</p>
		<p class="mt-1 text-2xl font-semibold tracking-tight">{bytes(data.totals.bandwidthBytes)}</p>
	</div>
	<div class="rounded-lg border border-slate-200 bg-white p-5">
		<p class="text-xs uppercase tracking-wide text-slate-500">Stored</p>
		<p class="mt-1 text-2xl font-semibold tracking-tight">{bytes(data.totals.storageBytes)}</p>
	</div>
	<div class="rounded-lg border border-slate-200 bg-white p-5">
		<p class="text-xs uppercase tracking-wide text-slate-500">Content entries</p>
		<p class="mt-1 text-2xl font-semibold tracking-tight">{count(data.totals.contentCount)}</p>
	</div>
</div>

{#if data.rows.length === 0}
	<p class="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
		Nothing billable in this period. A tenant appears here once it holds an API key, a content entry
		or a media file.
	</p>
{:else}
	<div class="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
				<tr>
					<th class="px-5 py-3 font-medium">Tenant</th>
					<th class="px-5 py-3 font-medium">API calls</th>
					<th class="px-5 py-3 font-medium">Bandwidth</th>
					<th class="px-5 py-3 font-medium">Stored</th>
					<th class="px-5 py-3 font-medium">Entries</th>
					<th class="px-5 py-3 font-medium">Media</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.rows as row (row.slug)}
					<tr class:bg-slate-50={!row.mine}>
						<td class="px-5 py-4">
							{#if row.mine}
								<a href="/tenants/{row.slug}" class="font-medium hover:underline">
									{row.name ?? row.slug}
								</a>
							{:else}
								<span class="font-medium">{row.name ?? row.slug}</span>
							{/if}
							<p class="mt-0.5 font-mono text-xs text-slate-400">{row.slug}</p>
							{#if row.implicit}
								<p class="mt-1 text-xs text-slate-500">
									The implicit tenant. Every request that names no tenant runs here, including the
									other examples on this engine.
								</p>
							{:else if row.plan}
								<p class="mt-0.5 text-xs text-slate-500">{row.plan}</p>
							{/if}
						</td>
						<td class="px-5 py-4">
							{count(row.apiCalls)}
							<span class="block text-xs text-slate-500">of {limit(row.requestsLimit)}</span>
							{#if percent(row.apiCalls, row.requestsLimit) !== null}
								<div class="mt-2 h-1 w-24 rounded-full bg-slate-100">
									<div
										class="h-1 rounded-full bg-slate-900"
										style="width: {percent(row.apiCalls, row.requestsLimit)}%"
									></div>
								</div>
							{/if}
							{#if row.blocked}
								<span class="mt-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-800">
									blocked
								</span>
							{/if}
						</td>
						<td class="px-5 py-4 text-slate-600">{bytes(row.bandwidthBytes)}</td>
						<td class="px-5 py-4 text-slate-600">
							{bytes(row.storageBytes)}
							{#if row.storageLimit > 0}
								<span class="block text-xs text-slate-500">of {bytes(row.storageLimit)}</span>
							{/if}
						</td>
						<td class="px-5 py-4 text-slate-600">{count(row.contentCount)}</td>
						<td class="px-5 py-4 text-slate-600">{count(row.mediaCount)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Close the period</h2>
	<p class="mt-1 max-w-2xl text-sm text-slate-600">
		The table above is recomputed from live counters on every read, so it keeps moving after an
		invoice is cut. A snapshot writes the period's figures to an immutable row. Running the same
		period again overwrites its snapshots rather than adding to them.
	</p>

	{#if form?.snapshotError}
		<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
			{form.snapshotError}
		</p>
	{/if}

	{#if form?.snapshotCount !== undefined}
		<p class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
			Wrote {form.snapshotCount}
			{form.snapshotCount === 1 ? 'snapshot' : 'snapshots'} for {form.snapshotPeriod}.
		</p>
	{/if}

	<form method="POST" action="?/snapshot" class="mt-4">
		<input type="hidden" name="period" value={data.period} />
		<button class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">
			Snapshot {data.period}
		</button>
	</form>
</section>
