<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import StatTile from '$lib/components/StatTile.svelte';
	import ColumnChart from '$lib/components/ColumnChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import { compact, millis, padHours, percent } from '$lib/charts';

	let { data } = $props();

	const hours = $derived(padHours(data.trend, 24));
	const quietHours = $derived(hours.filter((h) => h.absent).length);
</script>

<svelte:head><title>Engine telemetry</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Overview</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	Six plugins expose telemetry about this engine and they fill their tables four different ways.
	Panels marked <span class="font-medium">Collecting</span> are measurements. Panels marked
	otherwise are reading a table nothing writes, and their zeroes carry no information.
</p>

{#if data.summary}
	<!-- The hero figure: one per view, in the same sans as everything else. -->
	<div class="mt-8 rounded-lg border border-slate-200 bg-white px-6 py-6">
		<p class="text-xs font-medium tracking-wide text-slate-500 uppercase">
			Requests in the last 24 hours
		</p>
		<p class="mt-1 text-5xl font-semibold text-slate-900">
			{data.summary.total_requests.toLocaleString('en-US')}
		</p>
		<p class="mt-2 text-sm text-slate-600">
			{percent(data.summary.error_rate)} errors across
			{data.summary.unique_endpoints.toLocaleString('en-US')} endpoints and
			{data.summary.unique_tenants} {data.summary.unique_tenants === 1 ? 'tenant' : 'tenants'}.
			Recorded by engine middleware without anything opting in.
		</p>
	</div>

	<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile label="2xx" value={compact(data.summary.total_2xx)} note="last 24 hours" />
		<StatTile label="4xx" value={compact(data.summary.total_4xx)} note="last 24 hours" />
		<StatTile label="5xx" value={compact(data.summary.total_5xx)} note="last 24 hours" />
		<StatTile
			label="p95 latency"
			value={millis(data.summary.avg_latency_p95_ms)}
			note="mean of the hourly p95 rollups"
		/>
	</div>
{/if}

<div class="mt-8 space-y-6">
	<Panel
		title="Requests per hour"
		subtitle="The only telemetry on this dashboard the engine collects with no configuration at all"
		provenance={data.trendProvenance}
	>
		{#if hours.length > 0}
			<ColumnChart columns={hours} seriesLabel="Requests" />
			{#if quietHours > 0}
				<p class="mt-3 text-sm text-slate-600">
					{quietHours} of the last 24 hours returned no row. Those are drawn as a dashed floor mark,
					not a zero column, because the trend route omits a quiet hour rather than reporting one.
				</p>
			{/if}
			{#if data.config}
				<p class="mt-2 text-sm text-slate-600">
					The collector flushes every {data.config.flush_interval_seconds}s and keeps
					{data.config.retention_days} days, so the newest hour can be that far behind and the
					series ends {data.config.retention_days} days back.
				</p>
			{/if}
		{:else}
			<p class="text-sm text-slate-600">No hour in the window returned a row.</p>
		{/if}
	</Panel>

	<Panel
		title="Content activity"
		subtitle="What has been created, updated and deleted, from the engine's own lifecycle hooks"
		provenance={data.activityProvenance}
	>
		<div class="grid gap-4 sm:grid-cols-3">
			<StatTile
				label="Events on the page"
				value={data.activity.total.toLocaleString('en-US')}
				note="the route caps a page at 200"
			/>
			<StatTile
				label="Newest"
				value={data.activity.newest ? new Date(data.activity.newest).toISOString().slice(0, 16).replace('T', ' ') : 'none'}
				note="UTC"
			/>
			<StatTile
				label="Marked processed"
				value="0"
				inert
				note="no hook event is ever marked processed"
			/>
		</div>

		{#if data.activity.byCategory.length > 0}
			<div class="mt-6">
				<h3 class="text-sm font-medium text-slate-700">Most active content types</h3>
				<div class="mt-3">
					<BarChart
						bars={data.activity.byCategory}
						seriesLabel="Events"
						categoryLabel="Content type"
					/>
				</div>
			</div>

			<div class="mt-6">
				<h3 class="text-sm font-medium text-slate-700">By operation</h3>
				<div class="mt-3">
					<BarChart bars={data.activity.byKind} seriesLabel="Events" categoryLabel="Hook" />
				</div>
			</div>
		{/if}

		<p class="mt-6 text-sm text-slate-600">
			These rows are real: the plugin subscribes to every schema's create, update and delete hook,
			so writing content anywhere in the install lands one here. What is not real is the dispatch
			state. The hook builds each event with an empty provider list, and the dispatcher iterates
			that list, so nothing is ever sent onward and nothing is ever marked processed. Adding an
			external destination does not change it.
		</p>
	</Panel>

	<div class="grid gap-6 lg:grid-cols-2">
		<Panel
			title="Daily rollup"
			subtitle="Daily active users, API calls and storage per tenant"
			provenance={data.rollupProvenance}
		>
			{#if data.rollup}
				<div class="grid grid-cols-2 gap-4">
					<StatTile label="Days recorded" value={String(data.rollup.days)} inert={data.rollup.days === 0} />
					<StatTile label="Total DAU" value={compact(data.rollup.total_dau)} inert={data.rollup.days === 0} />
					<StatTile
						label="API calls"
						value={compact(data.rollup.total_api_calls)}
						inert={data.rollup.days === 0}
					/>
					<StatTile
						label="New users"
						value={compact(data.rollup.total_new_users)}
						inert={data.rollup.days === 0}
					/>
				</div>
				{#if data.rollup.days === 0}
					<p class="mt-4 text-sm text-slate-600">
						Zero days recorded, so every figure beside it is arithmetic over an empty table rather
						than a measurement. Filling this needs a scheduled job posting to
						<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs"
							>/api/admin/analytics/aggregate-all</code
						>
						once a day. Note that the same numbers are already available live and exact from the usage
						plugin, which is what the
						<a class="underline" href="/quota">quota page</a> reads.
					</p>
				{/if}
			{/if}
		</Panel>

		<Panel
			title="External analytics destinations"
			subtitle="Where tracked events would be forwarded"
			provenance={data.providersProvenance}
		>
			<StatTile label="Destinations configured" value={String(data.providers)} inert />
			<p class="mt-4 text-sm text-slate-600">
				Configuring one would not change the content activity panel above, because the dispatcher
				is handed an empty destination list for every hook event regardless. This route also
				answers a bare
				<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">null</code>
				rather than an empty array when nothing is configured, so treating the body as a list
				throws.
			</p>
		</Panel>
	</div>

	{#if data.notes.length > 0}
		<section class="rounded-lg border border-slate-200 bg-white">
			<header class="border-b border-slate-100 px-5 py-4">
				<h2 class="font-semibold tracking-tight">Recent operator notes</h2>
				<p class="mt-1 text-sm text-slate-500">
					The one thing on this dashboard a person wrote. <a class="underline" href="/notes">Add one</a>.
				</p>
			</header>
			<ul class="divide-y divide-slate-100">
				{#each data.notes as note (note.id)}
					<li class="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
						<span class="font-medium text-slate-900">{note.title}</span>
						<span class="text-sm text-slate-500">
							{note.kind} · {new Date(note.recordedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
