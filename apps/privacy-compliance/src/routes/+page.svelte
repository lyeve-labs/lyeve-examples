<script lang="ts">
	import { STATE_LABELS, TYPE_LABELS } from '$lib/desk';

	let { data } = $props();

	const dsarRows = $derived(Object.entries(data.dsarCounts));
</script>

<svelte:head><title>Privacy desk</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Data subject requests</h1>
<p class="mt-2 max-w-2xl text-slate-600">
	Export, erasure and masking, run against the engine's own DSAR routes. Requests arrive on the
	public form, an officer verifies who sent them, and only then does anything happen to the data.
</p>

<div class="mt-8 grid gap-4 sm:grid-cols-3">
	<div class="rounded-lg border border-slate-200 bg-white p-5">
		<p class="text-3xl font-semibold">{data.totals.open}</p>
		<p class="mt-1 text-sm text-slate-500">open of {data.totals.all} filed</p>
	</div>
	<div class="rounded-lg border border-slate-200 bg-white p-5">
		<p class="text-3xl font-semibold {data.totals.overdue > 0 ? 'text-red-600' : ''}">
			{data.totals.overdue}
		</p>
		<p class="mt-1 text-sm text-slate-500">past the one-month deadline</p>
	</div>
	<div class="rounded-lg border border-slate-200 bg-white p-5">
		<p class="text-3xl font-semibold">{data.actions.length}</p>
		<p class="mt-1 text-sm text-slate-500">recent actions on this desk</p>
	</div>
</div>

<div class="mt-8 grid gap-8 lg:grid-cols-2">
	<section>
		<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Next up</h2>
		{#if data.queue.length === 0}
			<p class="mt-3 text-slate-500">
				No open requests. Run <code class="rounded bg-slate-200 px-1.5 py-0.5">pnpm run setup</code> to
				provision the register and seed a few, or file one on
				<a href="/request" class="underline">the public form</a>.
			</p>
		{:else}
			<ul class="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
				{#each data.queue as item (item.slug)}
					<li class="flex items-baseline justify-between gap-4 px-5 py-4">
						<div class="min-w-0">
							<a href="/requests/{item.slug}" class="font-medium hover:underline"
								>{item.title}</a
							>
							<p class="mt-1 text-sm text-slate-500">
								{TYPE_LABELS[item.type]} · {STATE_LABELS[item.state]} ·
								{item.handlerName ?? 'unassigned'}
							</p>
						</div>
						<span
							class="shrink-0 text-sm {item.daysLeft < 0
								? 'font-medium text-red-600'
								: 'text-slate-500'}"
						>
							{item.daysLeft < 0
								? `${Math.abs(item.daysLeft)} days late`
								: `${item.daysLeft} days left`}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section>
		<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
			What the engine has recorded
		</h2>
		<ul class="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm">
			{#each dsarRows as [action, count] (action)}
				<li class="flex items-baseline justify-between px-5 py-3">
					<code class="text-slate-700">{action}</code>
					<span class="font-medium">{count}</span>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-sm text-slate-500">
			Three audit reads, one per action name. The route filters by exact equality and offers no
			prefix match, so a single count over every <code>gdpr.*</code> action is not something it can
			answer. <a href="/audit" class="underline">The trail</a> uses the resource type both actions
			share instead.
		</p>
	</section>
</div>

<section class="mt-10">
	<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Action trail</h2>
	{#if data.actions.length === 0}
		<p class="mt-3 text-slate-500">Nothing run yet.</p>
	{:else}
		<div class="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="w-full text-sm">
				<thead class="border-b border-slate-200 text-left text-slate-500">
					<tr>
						<th class="px-5 py-3 font-medium">When</th>
						<th class="px-5 py-3 font-medium">Action</th>
						<th class="px-5 py-3 font-medium">Outcome</th>
						<th class="px-5 py-3 font-medium">Subject</th>
						<th class="px-5 py-3 font-medium">Records</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.actions as action (action.id)}
						<tr>
							<td class="px-5 py-3 text-slate-500">
								{new Date(action.ranAt).toLocaleString()}
							</td>
							<td class="px-5 py-3">{action.kind}</td>
							<td class="px-5 py-3">{action.outcome}</td>
							<td class="px-5 py-3"><code class="text-xs">{action.subjectDigest}</code></td>
							<td class="px-5 py-3">
								{action.kind === 'erase' ? action.rowsAffected : action.recordCount}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="mt-3 max-w-3xl text-sm text-slate-500">
			The subject column is a digest, not an address: SHA-256 of the identifier, first six bytes.
			It is the same reference the engine writes to its own logs, so a line here can be matched to
			a line there, and a register of erasures does not become the last place the erased address
			survives.
		</p>
	{/if}
</section>

<p class="mt-10 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
	This desk is authenticated as <strong>{data.operator.email}</strong> ({data.operator.roles.join(
		', '
	)}). The DSAR routes accept nothing less than super_admin. That account is also the one erasure
	refuses to touch, because anonymizing it empties its roles and bumps its token version, and every
	request after that answers 401.
</p>
