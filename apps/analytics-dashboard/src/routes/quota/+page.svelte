<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import { bytes, compact } from '$lib/charts';

	let { data } = $props();

	const contentBars = $derived(
		data.usage
			.filter((row) => row.content_count > 0 || row.media_count > 0)
			.map((row) => ({
				label: row.tenant_id,
				value: row.content_count,
				note: `${row.media_count} media · ${bytes(row.storage_bytes)}`
			}))
			.sort((a, b) => b.value - a.value)
	);

	const unmetered = $derived(data.usage.filter((row) => row.api_calls === 0 && row.requestsMeasured > 0));
</script>

<svelte:head><title>Quota</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Quota and usage</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	One response from the usage plugin carries two different kinds of number, and the difference
	decides whether a billing figure means anything. This page splits them into separate panels
	rather than putting them in one table and letting a reader assume.
</p>

<div class="mt-8 space-y-6">
	<Panel
		title="Stored content, media and storage"
		subtitle="Counted at read time against the live tables"
		provenance={data.liveProvenance}
	>
		{#if contentBars.length > 0}
			<BarChart bars={contentBars} seriesLabel="Content entries" categoryLabel="Tenant" />
		{/if}

		<div class="mt-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-slate-200 text-left text-slate-500">
						<th class="py-2 font-medium">Tenant</th>
						<th class="py-2 font-medium">Period</th>
						<th class="py-2 text-right font-medium">Content</th>
						<th class="py-2 text-right font-medium">Media</th>
						<th class="py-2 text-right font-medium">Storage</th>
					</tr>
				</thead>
				<tbody>
					{#each data.usage as row (row.tenant_id)}
						<tr class="border-b border-slate-100">
							<td class="py-2 font-mono text-xs">{row.tenant_id}</td>
							<td class="py-2 text-slate-500">{row.billing_period}</td>
							<td class="py-2 text-right tabular-nums">{row.content_count.toLocaleString('en-US')}</td>
							<td class="py-2 text-right tabular-nums">{row.media_count.toLocaleString('en-US')}</td>
							<td class="py-2 text-right tabular-nums">{bytes(row.storage_bytes)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="mt-4 text-sm text-slate-600">
			These three columns are exact. The store runs a COUNT and a SUM against
			<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">sys_content_entries</code>
			and
			<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">sys_media</code>
			when you ask, so there is no counter to fall behind and no aggregation to schedule. A tenant
			with zero content really has none. The billing period label is cosmetic on these columns:
			the counts are of everything stored right now, not of what was added this month.
		</p>
	</Panel>

	<Panel
		title="Metered API calls and bandwidth"
		subtitle="The same response, a different mechanism, and the reason this page is split"
		provenance={data.meteredProvenance}
	>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-slate-200 text-left text-slate-500">
						<th class="py-2 font-medium">Tenant</th>
						<th class="py-2 text-right font-medium">Metered calls</th>
						<th class="py-2 text-right font-medium">Bandwidth</th>
						<th class="py-2 text-right font-medium">Requests actually served</th>
					</tr>
				</thead>
				<tbody>
					{#each data.usage as row (row.tenant_id)}
						<tr class="border-b border-slate-100">
							<td class="py-2 font-mono text-xs">{row.tenant_id}</td>
							<td
								class="py-2 text-right tabular-nums {row.api_calls === 0 ? 'text-slate-400' : ''}"
							>
								{row.api_calls.toLocaleString('en-US')}
							</td>
							<td
								class="py-2 text-right tabular-nums {row.bandwidth_bytes === 0
									? 'text-slate-400'
									: ''}"
							>
								{bytes(row.bandwidth_bytes)}
							</td>
							<td class="py-2 text-right tabular-nums text-slate-600">
								{compact(row.requestsMeasured)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="mt-4 text-sm leading-relaxed text-slate-600">
			The last column is the same tenant's traffic as recorded by the apianalytics middleware, put
			beside the billing counter on purpose. The two columns measure the same requests and only one
			of them counted.
		</p>
		<p class="mt-3 text-sm leading-relaxed text-slate-600">
			The usage middleware reads the request's auth claims and returns immediately unless the
			caller authenticated with an API key. A bearer token, which is how every example in this
			repository talks to the engine and how most server-side integrations do, is passed straight
			through unmetered. So
			<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">api_calls</code>
			is not a count of API calls. It is a count of API-key API calls, and a deployment that bills
			on it bills nothing for its bearer-token clients.
		</p>
		{#if unmetered.length > 0}
			<p class="mt-3 text-sm leading-relaxed text-slate-600">
				<span class="font-medium text-slate-900">
					{unmetered.length}
					{unmetered.length === 1 ? 'tenant' : 'tenants'} on this install
				</span>
				{unmetered.length === 1 ? 'has' : 'have'} served traffic that the meter did not count.
				Filling this column needs clients holding API keys, not a setting.
			</p>
		{/if}
		<p class="mt-3 text-sm leading-relaxed text-slate-600">
			<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs"
				>GET /api/admin/usage/snapshots/{'{tenant}'}</code
			>
			returns an empty array for the same family of reasons: a snapshot row exists only where
			something has posted to
			<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">/api/admin/usage/snapshot</code
			>, and nothing schedules that.
		</p>
	</Panel>

	{#if data.status}
		<Panel
			title="This tenant's quota status"
			subtitle="The tenant-facing view, on the public router"
			provenance={data.statusProvenance}
		>
			<Meter
				label="Request allowance"
				fraction={data.status.requests_limit > 0 ? data.status.requests_pct / 100 : 0}
				unmeasured={data.status.requests_limit === 0}
				caption={data.status.requests_limit > 0
					? `${data.status.requests_used.toLocaleString('en-US')} of ${data.status.requests_limit.toLocaleString('en-US')} requests`
					: `${data.status.requests_used.toLocaleString('en-US')} requests used against no limit`}
			/>

			<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatTile
					label="Blocked"
					value={data.status.is_blocked ? 'yes' : 'no'}
					note={data.status.is_hard_limit ? 'hard limit' : 'soft limit'}
				/>
				<StatTile label="Past 80%" value={data.status.is_warning_80 ? 'yes' : 'no'} />
				<StatTile label="Past 90%" value={data.status.is_warning_90 ? 'yes' : 'no'} />
				<StatTile label="Grace period" value="{data.status.grace_period_hours}h" />
			</div>

			{#if data.status.requests_limit === 0}
				<p class="mt-4 text-sm leading-relaxed text-slate-600">
					A limit of zero is this plugin spelling unlimited, and it is the seeded default the
					plugin writes at boot for the default tenant. Read as a number it says the opposite of
					what it means, and every flag beside it is false because there is nothing to compare
					against, not because the tenant is comfortably within its allowance. Setting a real
					limit through
					<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs"
						>PUT /api/admin/quotas/{'{tenant}'}</code
					> is what turns this panel into a measurement.
				</p>
			{/if}
		</Panel>
	{/if}

	<Panel
		title="Quota definitions"
		subtitle="Administrative rows, not measurements"
		provenance={data.quotasProvenance}
	>
		{#if data.quotas.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-200 text-left text-slate-500">
							<th class="py-2 font-medium">Tenant</th>
							<th class="py-2 text-right font-medium">Requests</th>
							<th class="py-2 text-right font-medium">Storage</th>
							<th class="py-2 text-right font-medium">Bandwidth</th>
							<th class="py-2 font-medium">Enforcement</th>
							<th class="py-2 font-medium">Blocked at</th>
						</tr>
					</thead>
					<tbody>
						{#each data.quotas as quota (quota.tenant_id)}
							<tr class="border-b border-slate-100">
								<td class="py-2 font-mono text-xs">{quota.tenant_id}</td>
								<td class="py-2 text-right tabular-nums">
									{quota.requests_limit === 0 ? 'unlimited' : compact(quota.requests_limit)}
								</td>
								<td class="py-2 text-right tabular-nums">
									{quota.storage_bytes_limit === 0 ? 'unlimited' : bytes(quota.storage_bytes_limit)}
								</td>
								<td class="py-2 text-right tabular-nums">
									{quota.bandwidth_bytes_limit === 0
										? 'unlimited'
										: bytes(quota.bandwidth_bytes_limit)}
								</td>
								<td class="py-2 text-slate-600">
									{quota.is_hard_limit ? 'hard' : 'soft'}{quota.block_on_exceeded
										? ', blocks'
										: ', warns only'}
								</td>
								<td class="py-2 text-slate-500">{quota.blocked_at ?? 'never'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-4 text-sm text-slate-600">
				A zero is rendered as the word rather than the digit here, because the digit is the single
				most misreadable figure on this dashboard. Nothing in this table is measured: these rows
				are what an administrator set, and an install that never set one has exactly the row the
				plugin seeded at boot.
			</p>
		{:else}
			<p class="text-sm text-slate-600">No quota rows.</p>
		{/if}
	</Panel>

	<Panel
		title="Quota increase requests"
		subtitle="Raised by a tenant against its own allowance"
		provenance={data.requestProvenance}
	>
		<StatTile label="Open requests" value={String(data.requestCount)} inert={data.requestCount === 0} />
		<p class="mt-4 text-sm text-slate-600">
			Only the count is rendered. No request has ever come back from this engine, so the shape of a
			row is unverified and laying out columns for it would be guessing at a response. A tenant
			raises one through
			<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">POST /api/v1/quota-requests</code
			>, which is a flow no example here exercises.
		</p>
	</Panel>
</div>
