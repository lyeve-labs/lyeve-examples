<script lang="ts">
	import { ago, clock, millis, percent } from '$lib/format';

	let { data, form } = $props();

	const selectedId = $derived(data.selected?.id ?? '');
</script>

<svelte:head><title>Deliveries</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Deliveries</h1>
<p class="mt-1 text-sm text-slate-500">
	One row per attempt the engine made, with what the receiver answered. Nothing here is written by
	this app: it is the plugin's own record of what it sent.
</p>

{#if form?.error}
	<p class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
		{form.error}
	</p>
{/if}
{#if form?.retried}
	<p
		class="mt-6 rounded-md border px-4 py-3 text-sm {form.success
			? 'border-emerald-200 bg-emerald-50 text-emerald-900'
			: 'border-amber-200 bg-amber-50 text-amber-900'}"
	>
		Re-sent: HTTP {form.status}. {form.message}. A new row was written for the attempt and the old
		one keeps its own result.
	</p>
{/if}
{#if form?.configured}
	<p class="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
		Retry policy saved.
	</p>
{/if}
{#if form?.replayed}
	<p class="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
		Replay sent. The receiver answered HTTP {form.replayStatus}.
		{#if form.replayStatus !== 200 && form.replayStatus !== 201}
			The engine's replay carries no signature, so a receiver that verifies has to refuse it and
			the entry stays pending.
		{/if}
	</p>
{/if}
{#if form?.dismissed}
	<p class="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
		Dismissed.
	</p>
{/if}

{#if data.endpoints.length === 0}
	<p class="mt-8 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
		Nothing registered yet. Register the endpoints on
		<a class="underline" href="/">the endpoints page</a> first.
	</p>
{:else}
	<nav class="mt-6 flex flex-wrap gap-2 text-sm">
		{#each data.endpoints as endpoint (endpoint.id)}
			<a
				href="/deliveries?webhook={endpoint.id}"
				class="rounded-md border px-3 py-1.5 {endpoint.id === selectedId
					? 'border-slate-900 font-medium'
					: 'border-slate-300 text-slate-600 hover:bg-slate-50'}"
			>
				{endpoint.channel}
			</a>
		{/each}
	</nav>
{/if}

{#if data.selected}
	{#if data.stats}
		<section class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
			<div class="rounded-lg border border-slate-200 p-4">
				<p class="text-xs uppercase tracking-wide text-slate-400">Attempts</p>
				<p class="mt-1 text-2xl font-semibold">{data.stats.total}</p>
			</div>
			<div class="rounded-lg border border-slate-200 p-4">
				<p class="text-xs uppercase tracking-wide text-slate-400">Accepted</p>
				<p class="mt-1 text-2xl font-semibold">{data.stats.success_count}</p>
			</div>
			<div class="rounded-lg border border-slate-200 p-4">
				<p class="text-xs uppercase tracking-wide text-slate-400">Refused</p>
				<p class="mt-1 text-2xl font-semibold">{data.stats.failure_count}</p>
			</div>
			<div class="rounded-lg border border-slate-200 p-4">
				<p class="text-xs uppercase tracking-wide text-slate-400">Accept rate</p>
				<p class="mt-1 text-2xl font-semibold">{percent(data.stats.success_rate)}</p>
			</div>
			<div class="rounded-lg border border-slate-200 p-4">
				<p class="text-xs uppercase tracking-wide text-slate-400">Average</p>
				<p class="mt-1 text-2xl font-semibold">{Math.round(data.stats.avg_latency_ms)} ms</p>
			</div>
		</section>
	{/if}

	<form method="GET" class="mt-6 flex flex-wrap items-end gap-3 text-sm">
		<input type="hidden" name="webhook" value={selectedId} />
		<label>
			<span class="block text-slate-600">Event</span>
			<select
				name="event"
				class="mt-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			>
				<option value="" selected={data.filters.event === ''}>any</option>
				{#each ['after_create', 'after_update', 'after_delete', 'test', 'retry'] as event (event)}
					<option value={event} selected={data.filters.event === event}>{event}</option>
				{/each}
			</select>
		</label>
		<label>
			<span class="block text-slate-600">Outcome</span>
			<select
				name="success"
				class="mt-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			>
				<option value="" selected={data.filters.success === ''}>any</option>
				<option value="true" selected={data.filters.success === 'true'}>accepted</option>
				<option value="false" selected={data.filters.success === 'false'}>refused</option>
			</select>
		</label>
		<label class="grow">
			<span class="block text-slate-600">Text in the request body</span>
			<input
				name="q"
				value={data.filters.q}
				placeholder="LY-"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>
		<button class="rounded-md border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50">
			Filter
		</button>
	</form>
	<p class="mt-2 text-xs text-slate-500">
		The text filter is a case-insensitive LIKE over the request body alone. It does not look at the
		error, the URL or the response.
	</p>

	<p class="mt-6 text-sm text-slate-500">{data.total} matching, newest first.</p>

	<div class="mt-3 space-y-3">
		{#each data.deliveries as delivery (delivery.id)}
			<article class="rounded-lg border p-4 {delivery.success ? 'border-slate-200' : 'border-amber-300'}">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex flex-wrap items-center gap-3 text-sm">
						<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{delivery.event}</span>
						<span class="font-mono text-xs text-slate-500">{delivery.schema}</span>
						<span class="font-medium">
							{#if delivery.status}HTTP {delivery.status}{:else}no response{/if}
						</span>
						<span class="text-slate-500">{millis(delivery.durationMs)}</span>
						<span class="text-slate-500" title={clock(delivery.attemptedAt)}>
							{ago(delivery.attemptedAt)}
						</span>
					</div>
					{#if !delivery.success}
						<form method="POST" action="?/retry&webhook={selectedId}">
							<input type="hidden" name="delivery" value={delivery.id} />
							<button class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
								Send it again
							</button>
						</form>
					{/if}
				</div>

				{#if delivery.error}
					<p class="mt-2 font-mono text-xs text-amber-800">{delivery.error}</p>
				{/if}
				{#if delivery.nextRetryAt}
					<p class="mt-2 text-xs text-slate-500">
						next automatic attempt {clock(delivery.nextRetryAt)}, retry count
						{delivery.retryCount}
					</p>
				{/if}
				<details class="mt-2">
					<summary class="cursor-pointer text-xs text-slate-500">
						The bytes that were signed
					</summary>
					<pre class="mt-2 overflow-x-auto rounded bg-slate-50 p-3 text-xs">{delivery.body}</pre>
				</details>
			</article>
		{/each}
		{#if data.deliveries.length === 0}
			<p class="text-sm text-slate-500">
				No deliveries match. Place an order, or send a test from the endpoints page.
			</p>
		{/if}
	</div>

	{#if data.retry}
		<section class="mt-10">
			<h2 class="text-lg font-semibold tracking-tight">Retry policy</h2>
			<p class="mt-1 text-sm text-slate-500">
				The background worker ticks every thirty seconds, turns a failed delivery into an attempt
				chain, and moves the chain to the dead letter queue once the attempts run out. This route
				answers with these defaults even for a webhook that does not exist, so a reply here is not
				proof a policy was ever written.
			</p>
			<form
				method="POST"
				action="?/configure&webhook={selectedId}"
				class="mt-4 flex flex-wrap items-end gap-3 text-sm"
			>
				<label>
					<span class="block text-slate-600">Attempts</span>
					<input
						name="max_attempts"
						value={data.retry.max_attempts}
						class="mt-1 w-24 rounded-md border border-slate-300 px-3 py-2"
					/>
				</label>
				<label>
					<span class="block text-slate-600">Base delay, ms</span>
					<input
						name="base_delay_ms"
						value={data.retry.base_delay_ms}
						class="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2"
					/>
				</label>
				<label>
					<span class="block text-slate-600">Ceiling, ms</span>
					<input
						name="max_delay_ms"
						value={data.retry.max_delay_ms}
						class="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2"
					/>
				</label>
				<label>
					<span class="block text-slate-600">Strategy</span>
					<select name="strategy" class="mt-1 rounded-md border border-slate-300 px-3 py-2">
						{#each ['exponential', 'fixed', 'linear'] as strategy (strategy)}
							<option value={strategy} selected={data.retry.strategy === strategy}>
								{strategy}
							</option>
						{/each}
					</select>
				</label>
				<label class="flex items-center gap-2 pb-2">
					<input type="checkbox" name="enabled" checked={data.retry.enabled} />
					<span class="text-slate-600">enabled</span>
				</label>
				<button class="rounded-md border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50">
					Save
				</button>
			</form>
		</section>
	{/if}

	{#if data.attempts.length > 0}
		<section class="mt-10">
			<h2 class="text-lg font-semibold tracking-tight">Attempt chain</h2>
			<p class="mt-1 text-sm text-slate-500">
				Attempts are the retry worker's own bookkeeping, separate from the delivery log. A failed
				delivery is backfilled into one on the next tick, and the chain keeps one live attempt at
				a time: the rest are marked superseded.
			</p>
			<div class="mt-3 overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="border-b border-slate-200 text-left text-slate-500">
						<tr>
							<th class="py-2 pr-4 font-medium">Attempt</th>
							<th class="py-2 pr-4 font-medium">Event</th>
							<th class="py-2 pr-4 font-medium">State</th>
							<th class="py-2 pr-4 font-medium">Status</th>
							<th class="py-2 font-medium">When</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each data.attempts as attempt (attempt.id)}
							<tr>
								<td class="py-2 pr-4">{attempt.attempt_num}</td>
								<td class="py-2 pr-4 font-mono text-xs">{attempt.event_type}</td>
								<td class="py-2 pr-4">{attempt.status}</td>
								<td class="py-2 pr-4">{attempt.status_code ?? ''}</td>
								<td class="py-2 text-slate-500">{clock(attempt.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
{/if}

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Dead letters</h2>
	<p class="mt-1 text-sm text-slate-500">
		Where a delivery ends up once its attempts run out. The queue is engine-wide, not per
		endpoint, so an entry names its own webhook.
	</p>
	{#if data.deadLetters.length === 0}
		<p class="mt-3 text-sm text-slate-500">
			Nothing pending. The wrong-secret endpoint fills this within a minute or two of an order
			being written.
		</p>
	{:else}
		<ul class="mt-3 space-y-3">
			{#each data.deadLetters as entry (entry.id)}
				<li class="rounded-lg border border-amber-300 p-4">
					<div class="flex flex-wrap items-center justify-between gap-3 text-sm">
						<div>
							<span class="font-medium">{entry.webhook_name}</span>
							<span class="ml-2 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">
								{entry.event_type}
							</span>
							<span class="ml-2 text-slate-500">
								{entry.total_attempts} attempts, last HTTP {entry.last_status_code ?? 'none'}
							</span>
						</div>
						<div class="flex gap-2">
							<form method="POST" action="?/replay">
								<input type="hidden" name="id" value={entry.id} />
								<button class="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
									Replay
								</button>
							</form>
							<form method="POST" action="?/dismiss">
								<input type="hidden" name="id" value={entry.id} />
								<button class="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50">
									Dismiss
								</button>
							</form>
						</div>
					</div>
					{#if entry.last_error}
						<p class="mt-2 font-mono text-xs text-amber-800">{entry.last_error}</p>
					{/if}
					<p class="mt-1 text-xs text-slate-500">dead at {clock(entry.dead_at)}</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>
