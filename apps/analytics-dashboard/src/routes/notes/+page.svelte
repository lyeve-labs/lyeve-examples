<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import ColumnChart from '$lib/components/ColumnChart.svelte';
	import StateMark from '$lib/components/StateMark.svelte';
	import { padHours } from '$lib/charts';

	let { data, form } = $props();

	const hours = $derived(padHours(data.trend, 24));
	const values = $derived((form?.values ?? { title: '', kind: 'observation', body: '' }) as Record<string, string>);
	const inputClass =
		'mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900';
</script>

<svelte:head><title>Notes</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Operator notes</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	The only content this app owns, and the only thing on this dashboard a person wrote. Telemetry
	records that traffic tripled at 14:00. It has no way to record that the load test started then.
</p>

{#if !data.provisioned}
	<p class="mt-8 inline-flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 p-4 text-amber-900">
		<StateMark shape="triangle" />
		The <code class="rounded bg-white/60 px-1 py-0.5 font-mono text-xs">metrics_notes</code> content
		type does not exist yet. Run
		<code class="rounded bg-white/60 px-1 py-0.5 font-mono text-xs">pnpm run setup</code> in this app.
	</p>
{/if}

<div class="mt-8">
	<Panel
		title="The timeline these notes annotate"
		subtitle="The same series as the overview, here so a note can be written against what it explains"
		provenance={data.trendProvenance}
	>
		{#if hours.length > 0}
			<ColumnChart columns={hours} seriesLabel="Requests" height={160} />
		{:else}
			<p class="text-sm text-slate-600">No hour returned a row.</p>
		{/if}
	</Panel>
</div>

<div class="mt-6 grid gap-6 lg:grid-cols-[2fr_3fr]">
	<section class="rounded-lg border border-slate-200 bg-white">
		<header class="border-b border-slate-100 px-5 py-4">
			<h2 class="font-semibold tracking-tight">Record a note</h2>
		</header>

		<div class="px-5 py-5">
			{#if form?.message}
				<p
					class="mb-5 inline-flex items-center gap-2 rounded-md border p-3 text-sm {form.ok
						? 'border-emerald-300 bg-emerald-50 text-emerald-900'
						: 'border-rose-300 bg-rose-50 text-rose-900'}"
				>
					<StateMark shape={form.ok ? 'filled' : 'cross'} />
					{form.message}
				</p>
			{/if}

			<!--
				A plain POST to this page's own action. The browser never holds the
				engine credential, so a note reaches the engine only through this
				server, and the form works with JavaScript switched off.
			-->
			<form method="POST" class="space-y-5">
				<label class="block">
					<span class="text-sm font-medium">What happened</span>
					<input
						name="title"
						required
						maxlength="200"
						value={values.title ?? ''}
						placeholder="Load test against blog_posts, 20 workers"
						class={inputClass}
					/>
				</label>

				<label class="block">
					<span class="text-sm font-medium">Kind</span>
					<select name="kind" class={inputClass}>
						{#each data.kinds as kind (kind)}
							<option value={kind} selected={values.kind === kind}>{kind}</option>
						{/each}
					</select>
				</label>

				<label class="block">
					<span class="text-sm font-medium">Detail <span class="font-normal text-slate-400">(optional)</span></span>
					<textarea
						name="body"
						rows="5"
						class={inputClass}
						placeholder="What to check next time, or why the figures for this window should not be trusted.">{values.body ?? ''}</textarea
					>
				</label>

				<button
					class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
					disabled={!data.provisioned}
				>
					Record
				</button>
			</form>

			<p class="mt-5 text-sm text-slate-500">
				The slug carries a timestamp rather than coming from the title. Entry slugs are
				unique per tenant with no content type in the index, so a note slugged
				<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">outage</code> would collide
				with every other example app on this engine, and the refusal is a 409 naming no field.
			</p>
		</div>
	</section>

	<section class="rounded-lg border border-slate-200 bg-white">
		<header class="border-b border-slate-100 px-5 py-4">
			<h2 class="font-semibold tracking-tight">Timeline</h2>
			<p class="mt-1 text-sm text-slate-500">Newest first, which is the only order the engine offers.</p>
		</header>

		{#if data.notes.length === 0}
			<p class="px-5 py-5 text-sm text-slate-600">
				No notes yet. The first useful one is usually written during an incident, which is the
				worst time to be designing a place to put it.
			</p>
		{:else}
			<ul class="divide-y divide-slate-100">
				{#each data.notes as note (note.id)}
					<li class="px-5 py-4">
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<h3 class="font-medium text-slate-900">{note.title}</h3>
							<span class="text-xs text-slate-500">
								{new Date(note.recordedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
							</span>
						</div>
						<p class="mt-1 text-xs font-medium tracking-wide text-slate-400 uppercase">{note.kind}</p>
						{#if note.body}
							<p class="mt-2 text-sm whitespace-pre-line text-slate-600">{note.body}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
