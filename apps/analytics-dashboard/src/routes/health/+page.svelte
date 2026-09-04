<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import Meter from '$lib/components/Meter.svelte';
	import StateMark from '$lib/components/StateMark.svelte';
	import { compact, millis } from '$lib/charts';

	let { data } = $props();

	const latencyBars = $derived(
		(data.latency?.slowest ?? []).map((row) => ({
			label: `${row.method} ${row.path}`,
			value: row.p95_us / 1000,
			note: `${row.count} ${row.count === 1 ? 'call' : 'calls'} · p99 ${millis(row.p99_us / 1000)}`
		}))
	);
</script>

<svelte:head><title>Health</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Health</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	Three probes, the connection pool, the in-process latency tracker and the Prometheus exposition,
	each live at the instant it is read.
</p>

<div class="mt-8 space-y-6">
	<section class="rounded-lg border border-slate-200 bg-white">
		<header class="border-b border-slate-100 px-5 py-4">
			<h2 class="font-semibold tracking-tight">Probes</h2>
			<p class="mt-1 text-sm text-slate-500">
				The only engine endpoints reachable with no credential at all.
			</p>
		</header>

		<div class="divide-y divide-slate-100">
			{#each data.probes as entry (entry.name)}
				<div class="px-5 py-4">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<p class="font-mono text-sm font-medium text-slate-900">{entry.name}</p>
						{#if entry.report}
							<p class="inline-flex items-center gap-1.5 text-sm">
								<StateMark shape={entry.report.status === 'ok' ? 'filled' : 'cross'} />
								<span class={entry.report.status === 'ok' ? 'text-emerald-800' : 'text-rose-800'}>
									{entry.report.status}
								</span>
								<span class="text-slate-500">
									at {entry.report.checked_at}
								</span>
							</p>
						{:else}
							<p class="inline-flex items-center gap-1.5 text-sm text-rose-800">
								<StateMark shape="cross" /> no answer
							</p>
						{/if}
					</div>
					<p class="mt-1 text-sm text-slate-600">{entry.purpose}</p>

					{#if entry.report}
						<ul class="mt-3 flex flex-wrap gap-2">
							{#each entry.report.checks as check (check.name)}
								<li
									class="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs {check.passed
										? 'border-emerald-300 bg-emerald-50 text-emerald-900'
										: 'border-rose-300 bg-rose-50 text-rose-900'}"
								>
									<StateMark shape={check.passed ? 'filled' : 'cross'} />
									{check.name}
									<span class="text-slate-500">{check.took}</span>
								</li>
							{/each}
						</ul>
					{/if}
					<p class="mt-2 text-sm text-slate-600">{entry.provenance.detail}</p>
				</div>
			{/each}
		</div>

		<div class="border-t border-slate-100 bg-slate-50 px-5 py-4 text-sm text-slate-600">
			<p>
				<span class="font-medium text-slate-900">Point a load balancer at /readyz, not at
					/api/v1/health.</span>
				The name is the trap. The v1 route sits behind the auth middleware and answers 401 without a
				token, so a health check configured against it marks a perfectly healthy instance down.
				/readyz checks the database, disk, goroutines, pool utilization and the plugin set, and
				needs no credential. /healthz checks the database alone, on purpose: a saturation problem
				must not restart the container.
			</p>
			<p class="mt-3">
				These probes also bypass the readiness gate that refuses ordinary traffic during startup,
				so a 200 from one of them is not a promise that the rest of the engine will answer yet.
			</p>
		</div>
	</section>

	{#if data.ready}
		<Panel
			title="The authenticated readiness route"
			subtitle="Included to show what it is worth"
			provenance={data.readyProvenance}
		>
			<div class="grid gap-4 sm:grid-cols-3">
				<StatTile label="Status" value={data.ready.status} />
				<StatTile label="Database" value={data.ready.db} />
				<StatTile
					label="Schemas"
					value={String(data.ready.schema_count)}
					inert
					note="always zero here"
				/>
			</div>
			<p class="mt-4 text-sm text-slate-600">
				Status and database are genuine, and the schema count is not. The handler takes a schema
				cache accessor and the admin router passes nothing for it, so the field is a literal zero
				on an install with dozens of schemas. The overview page reads the real count from the
				dashboard plugin. This panel exists because a zero that looks like a measurement is exactly
				what this dashboard is about.
			</p>
		</Panel>
	{/if}

	{#if data.pool}
		<Panel
			title="Database connection pool"
			subtitle="Read off the driver at request time, so it is instantaneous"
			provenance={data.poolProvenance}
		>
			<Meter
				label="Pool utilization"
				fraction={data.pool.utilization}
				caption="{data.pool.in_use} in use, {data.pool.idle} idle, {data.pool
					.open_connections} open of {data.pool.max_open_connections} permitted"
			/>

			<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatTile label="Engine" value={data.pool.engine} />
				<StatTile label="Ping" value={millis(data.pool.latency_ms)} note="this request" />
				<StatTile
					label="Waits for a connection"
					value={compact(data.pool.wait_count)}
					note="{millis(data.pool.wait_duration_ms)} total"
				/>
				<StatTile
					label="Query shapes tracked"
					value={String(data.pool.tracked_shapes)}
					inert={data.pool.tracked_shapes === 0}
					note={data.pool.tracked_shapes === 0 ? 'nothing slow recorded' : undefined}
				/>
			</div>

			<p class="mt-4 text-sm text-slate-600">
				Utilization is a snapshot of this moment, not an average, so a low reading proves nothing
				about the last minute. The wait count is the figure worth watching instead: it accumulates,
				and a rising one means requests queued for a connection even while utilization looks calm
				whenever you happen to look.
			</p>
		</Panel>
	{:else}
		<Panel title="Database connection pool" provenance={data.poolProvenance} />
	{/if}

	{#if data.latency}
		<Panel
			title="Slowest endpoints"
			subtitle="An in-process ring buffer, distinct from the stored rollups"
			provenance={data.latencyProvenance}
		>
			<div class="grid gap-4 sm:grid-cols-3">
				<StatTile
					label="Requests sampled"
					value={compact(data.latency.tracker.total_requests)}
					note="since the last restart"
				/>
				<StatTile
					label="Endpoint slots used"
					value="{data.latency.tracker.tracked_endpoints} / {data.latency.tracker.max_endpoints}"
				/>
				<StatTile
					label="Samples per endpoint"
					value={compact(data.latency.tracker.samples_per_endpoint)}
				/>
			</div>

			{#if latencyBars.length > 0}
				<div class="mt-6">
					<BarChart
						bars={latencyBars}
						seriesLabel="p95"
						categoryLabel="Endpoint"
						valueLabel={(bar) => millis(bar.value)}
					/>
				</div>
			{/if}

			<p class="mt-4 text-sm text-slate-600">
				This tracker and the requests page disagree, and both are right. It lives in memory and
				starts again at every boot, while the apianalytics rollups are rows in a table that survive
				a restart. When a slow path appears here and not there, it happened since the last restart
				and has not been flushed yet. When it appears there and not here, the process has restarted
				since.
			</p>
			<p class="mt-3 text-sm text-slate-600">
				The endpoint slots matter once they fill. There are
				{data.latency.tracker.max_endpoints} of them and paths are not normalized the way
				apianalytics normalizes them, so an install serving per-id URLs exhausts the table and the
				endpoint that arrives after it is not tracked at all.
			</p>
		</Panel>
	{:else}
		<Panel title="Slowest endpoints" provenance={data.latencyProvenance} />
	{/if}

	{#if data.runtime}
		<Panel
			title="Process metrics"
			subtitle="Parsed from the engine's Prometheus exposition"
			provenance={data.runtimeProvenance}
		>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatTile label="Goroutines" value={String(data.runtime.goroutines)} />
				<StatTile label="Requests in flight" value={String(data.runtime.requestsInFlight)} />
				<StatTile
					label="Pool waits"
					value={compact(data.runtime.poolWaitCount)}
					note="since boot"
				/>
				<StatTile
					label="Content list cache"
					value={data.runtime.contentCacheHits + data.runtime.contentCacheMisses === 0
						? 'no samples'
						: `${data.runtime.contentCacheHits} / ${data.runtime.contentCacheMisses}`}
					inert={data.runtime.contentCacheHits + data.runtime.contentCacheMisses === 0}
					note="hits / misses"
				/>
			</div>

			{#if data.runtime.requestsByCode.length > 0}
				<div class="mt-6">
					<BarChart
						bars={data.runtime.requestsByCode.map((row) => ({ label: row.code, value: row.count }))}
						seriesLabel="Requests since boot"
						categoryLabel="Status class"
					/>
				</div>
			{/if}

			<p class="mt-4 text-sm text-slate-600">
				These request counters are process-lifetime, so they read far lower than the durable
				figures on the requests page and the gap is however much traffic arrived before the last
				restart. Two sources disagreeing by two orders of magnitude is the expected outcome here,
				not a fault.
			</p>
			{#if data.runtime.contentCacheHits + data.runtime.contentCacheMisses === 0}
				<p class="mt-3 text-sm text-slate-600">
					The content list cache counters are the exception worth flagging: both are zero after
					thousands of content reads. A cache with no hits would still record misses, so zero on
					both sides means this path is not passing through the instrumented cache rather than
					that the cache is cold. Treated as a hit rate it would read as a division by zero
					dressed up as 0%.
				</p>
			{/if}
		</Panel>
	{:else}
		<Panel title="Process metrics" provenance={data.runtimeProvenance} />
	{/if}
</div>
