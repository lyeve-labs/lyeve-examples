<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import ColumnChart from '$lib/components/ColumnChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import { bytes, compact, millis, padHours, percent } from '$lib/charts';

	let { data } = $props();

	const hours = $derived(padHours(data.trend, 24));
	const errorHours = $derived(padHours(data.errorTrend, 24));

	const endpointBars = $derived(
		data.endpoints.map((row) => ({
			label: row.key,
			value: row.request_count,
			note: `${percent(row.error_rate)} errors · p95 ${millis(row.avg_latency_p95_ms)}`
		}))
	);
	const methodBars = $derived(
		data.methods.map((row) => ({
			label: row.key,
			value: row.request_count,
			note: `${percent(row.error_rate)} errors`
		}))
	);
	const agentBars = $derived(
		data.agents.map((row) => ({
			label: row.key,
			value: row.request_count,
			note: `${percent(row.error_rate)} errors`
		}))
	);
	const tenantBars = $derived(
		data.tenants.map((row) => ({
			label: row.key,
			value: row.request_count,
			note: `p95 ${millis(row.avg_latency_p95_ms)}`
		}))
	);

	/**
	 * The percentile figures are ordered categories on one scale, so they are one
	 * series on one axis. Plotting them against request count would need a second
	 * y-axis, which invents a relationship the data does not hold.
	 */
	const percentileBars = $derived(
		data.summary
			? [
					{ label: 'p50', value: data.summary.avg_latency_p50_ms },
					{ label: 'p95', value: data.summary.avg_latency_p95_ms },
					{ label: 'p99', value: data.summary.avg_latency_p99_ms },
					{ label: 'worst hourly p99', value: data.summary.max_latency_p99_ms }
				]
			: []
	);
</script>

<svelte:head><title>Requests</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Requests</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	Per-route figures from the apianalytics plugin. It installs HTTP middleware, so every request
	through either router is recorded whether or not the caller knows this plugin exists. This is the
	page whose numbers can be trusted without qualification.
</p>

<!-- One filter row above everything it scopes, presets first. -->
<form method="GET" class="mt-6 flex flex-wrap items-center gap-3">
	<span class="text-sm font-medium text-slate-700">Window</span>
	{#each data.ranges as range (range.value)}
		<a
			href="?range={range.value}"
			class="rounded-md border px-3 py-1.5 text-sm {data.rangeKey === range.value
				? 'border-slate-900 bg-slate-900 font-medium text-white'
				: 'border-slate-300 bg-white text-slate-600 hover:border-slate-500'}"
		>
			{range.label}
		</a>
	{/each}
	<span class="text-sm text-slate-500">scopes the summary only, for the reason below</span>
</form>

{#if data.summary}
	<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile
			label="Requests"
			value={compact(data.summary.total_requests)}
			note="{data.summary.from} to {data.summary.to}"
		/>
		<StatTile label="Error rate" value={percent(data.summary.error_rate)} note="4xx and 5xx" />
		<StatTile
			label="Distinct endpoints"
			value={compact(data.summary.unique_endpoints)}
			note="normalized paths"
		/>
		<StatTile
			label="Largest request"
			value={bytes(data.summary.max_request_size_bytes)}
			note="mean {bytes(data.summary.avg_request_size_bytes)}"
		/>
	</div>
{/if}

<div class="mt-8 space-y-6">
	<Panel
		title="Window scoping"
		subtitle="What the control above does and does not reach"
		provenance={data.summaryProvenance}
	>
		<p class="text-sm leading-relaxed text-slate-600">
			The summary route takes <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">from</code>
			and <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">to</code> as RFC 3339
			instants and honors them. It has no
			<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">hours</code>
			parameter: passing one is accepted, ignored, and the response still reports itself as a 24
			hour window, so a page built on it would show the wrong figures under a confident heading.
			The four breakdown routes and the trend route take no window parameter at all, which is why
			the control says it scopes the summary only. Their headings below say what window they are
			actually reporting.
		</p>
		{#if data.summary}
			<p class="mt-3 text-sm text-slate-600">
				This response labeled its own window
				<span class="font-mono text-xs">{data.summary.from}</span> to
				<span class="font-mono text-xs">{data.summary.to}</span>.
			</p>
		{/if}
	</Panel>

	<Panel
		title="Requests per hour, last 24 hours"
		subtitle="Not scoped by the control above: the trend route takes no window"
		provenance={data.trendProvenance}
	>
		{#if hours.length > 0}
			<ColumnChart columns={hours} seriesLabel="Requests" />
		{:else}
			<p class="text-sm text-slate-600">No hour returned a row.</p>
		{/if}
	</Panel>

	<Panel
		title="Error rate per hour, last 24 hours"
		subtitle="Its own plot, because a rate and a count do not share an axis"
		provenance={data.trendProvenance}
	>
		{#if errorHours.length > 0}
			<ColumnChart
				columns={errorHours}
				seriesLabel="Error rate"
				valueLabel={(column) => percent(column.value)}
				axisLabel={(value) => percent(value, 1)}
			/>
			<p class="mt-3 text-sm text-slate-600">
				This is the same route as the panel above, drawn separately on purpose. Requests are counted
				in thousands and the error rate is a fraction under one, so putting both on one plot would
				need a second y-axis whose alignment is arbitrary and would invent a correlation.
			</p>
		{/if}
	</Panel>

	<Panel
		title="Busiest endpoints"
		subtitle="Paths with high-cardinality segments folded into placeholders"
		provenance={data.endpointsProvenance}
	>
		{#if endpointBars.length > 0}
			<BarChart bars={endpointBars} seriesLabel="Requests" categoryLabel="Endpoint" />
			<p class="mt-3 text-sm text-slate-600">
				A path is normalized before it is stored, so a UUID, a numeric id or an opaque token becomes
				a placeholder and a million distinct URLs collapse to one key. That is a cardinality guard,
				not a display choice, which is why a key like
				<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">/api/v1/content/{'{token}'}</code>
				appears: a schema name long enough to look like a token was folded with the ids.
			</p>
			{#if data.summary}
				<p class="mt-2 text-sm text-slate-600">
					The route's own <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">total</code>
					is the number of rows it returned, not the distinct count. There are
					{data.summary.unique_endpoints.toLocaleString('en-US')} distinct endpoints in this window,
					which only the summary reports.
				</p>
			{/if}
		{/if}
	</Panel>

	{#if percentileBars.length > 0}
		<Panel
			title="Latency percentiles"
			subtitle="Means of the hourly rollups, not percentiles over raw requests"
			provenance={data.summaryProvenance}
		>
			<BarChart
				bars={percentileBars}
				seriesLabel="Latency"
				categoryLabel="Percentile"
				valueLabel={(bar) => millis(bar.value)}
			/>
			<p class="mt-3 text-sm text-slate-600">
				Read these as an average of per-hour percentiles. The plugin stores one row per hour per
				endpoint with that hour's percentiles already computed, so a mean of p95 values is not the
				p95 of the window. The worst hourly p99 is the one figure here that names a real request,
				and it is usually a cold start or a migration rather than a user waiting.
			</p>
		</Panel>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<Panel title="By method" provenance={data.methodsProvenance}>
			{#if methodBars.length > 0}
				<BarChart bars={methodBars} seriesLabel="Requests" categoryLabel="Method" />
			{/if}
		</Panel>

		<Panel
			title="By client"
			subtitle="User agents folded into families"
			provenance={data.agentsProvenance}
		>
			{#if agentBars.length > 0}
				<BarChart bars={agentBars} seriesLabel="Requests" categoryLabel="Client" />
				<p class="mt-3 text-sm text-slate-600">
					The plugin matches a fixed list of agent substrings and everything else becomes
					<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">other</code>, so a large
					<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">other</code> bar is not a
					mystery client, it is any client the list does not name. An empty user agent is stored as
					<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">unknown</code>.
				</p>
			{/if}
		</Panel>
	</div>

	<Panel
		title="By tenant"
		subtitle="Every tenant's rows live in one table, separated by a column"
		provenance={data.tenantsProvenance}
	>
		{#if tenantBars.length > 0}
			<BarChart bars={tenantBars} seriesLabel="Requests" categoryLabel="Tenant" />
			<p class="mt-3 text-sm text-slate-600">
				A super_admin token sees every tenant here. A tenant-scoped admin token is forced to its
				own tenant by the handler, and a token carrying no tenant at all is refused with a 403
				rather than handed the whole install, because the rollups share one table.
			</p>
		{/if}
	</Panel>

	{#if data.anomalies}
		<Panel
			title="Anomaly detection"
			subtitle="A z-score pass over the same hourly rollups"
			provenance={data.anomaliesProvenance}
		>
			<div class="grid gap-4 sm:grid-cols-3">
				<StatTile label="Anomalies" value={String(data.anomalies.count)} />
				<StatTile label="Window" value="{data.anomalies.window_hours}h" />
				<StatTile label="Threshold" value="z >= {data.anomalies.z_threshold}" />
			</div>
			<p class="mt-4 text-sm text-slate-600">
				Only the count is rendered. No anomaly has come back from this engine, so the shape of an
				entry is unverified, and laying out fields for it would be inventing a response. A count of
				zero here is a real reading: the detector ran and found nothing above the threshold.
			</p>
		</Panel>
	{/if}

	{#if data.config}
		<Panel
			title="Collector settings"
			subtitle="How fresh and how deep the figures on this page are"
			provenance={data.configProvenance}
		>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatTile
					label="Flush interval"
					value="{data.config.flush_interval_seconds}s"
					note="staleness ceiling"
				/>
				<StatTile label="Retention" value="{data.config.retention_days} days" note="then purged" />
				<StatTile
					label="Buffer"
					value={compact(data.config.metrics_buffer_size)}
					note="points held in memory"
				/>
				<StatTile
					label="Endpoint ceiling"
					value={compact(data.config.max_distinct_endpoints)}
					note="cardinality guard"
				/>
			</div>
			<p class="mt-4 text-sm text-slate-600">
				The buffer is where a recorded request lives until a flush lands, and nothing upstream can
				replay it. A burst past
				{compact(data.config.metrics_buffer_size)} points between flushes drops the newest arrivals,
				so the busiest minute of an incident is the one most likely to be undercounted here.
			</p>
		</Panel>
	{/if}
</div>
