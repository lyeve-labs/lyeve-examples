<script lang="ts">
	import { enhance } from '$app/forms';
	import { bytes, count, limitLabel, shortId, when } from '$lib/format';

	let { data, form } = $props();

	const key = $derived(data.key);
	const usage = $derived(data.usage);
</script>

<svelte:head><title>{key.name}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All keys</a>

<h1 class="mt-6 text-2xl font-semibold tracking-tight">{key.name}</h1>
<p class="mt-2 text-sm text-slate-500">
	<code class="rounded bg-slate-100 px-1.5 py-0.5">{key.id}</code>
	, minted {when(key.createdAt)}, tenant {key.tenant || 'default'}
</p>

<div class="mt-8 grid grid-cols-3 gap-4">
	<div class="rounded-lg border border-slate-200 p-5">
		<p class="text-sm text-slate-500">Requests, {data.period}</p>
		<p class="mt-1 text-2xl font-semibold tabular-nums">{count(usage?.requests ?? 0)}</p>
		<p class="mt-1 text-xs text-slate-400">of {limitLabel(key.monthlyLimit)}</p>
	</div>
	<div class="rounded-lg border border-slate-200 p-5">
		<p class="text-sm text-slate-500">Bytes out</p>
		<p class="mt-1 text-2xl font-semibold tabular-nums">{bytes(usage?.bytesOut ?? 0)}</p>
		<p class="mt-1 text-xs text-slate-400">measured after the handler wrote the body</p>
	</div>
	<div class="rounded-lg border border-slate-200 p-5">
		<p class="text-sm text-slate-500">Bytes in</p>
		<p class="mt-1 text-2xl font-semibold tabular-nums">{bytes(usage?.bytesIn ?? 0)}</p>
		<p class="mt-1 text-xs text-slate-400">from Content-Length, so a GET counts zero</p>
	</div>
</div>

{#if !usage}
	<p class="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
		The usage route answered 404, which it does when no key with this id exists in this tenant. The
		counters above are the fallback zero, not a reading.
	</p>
{/if}

<section class="mt-10 rounded-lg border border-slate-200 p-6">
	<h2 class="font-medium">Monthly limit</h2>
	<p class="mt-1 text-sm text-slate-500">
		Enforced by the usage plugin, per key, on the public router only. Past the limit every request
		answers 429 with <code class="rounded bg-slate-100 px-1.5 py-0.5">X-RateLimit-Exceeded: true</code
		>. There is no route that resets the counter, so raising this is how a key that spent its month
		comes back before the period rolls over.
	</p>

	<form method="POST" action="?/limit" use:enhance class="mt-4 flex items-end gap-3">
		<label class="text-sm">
			<span class="font-medium">Requests per month</span>
			<input
				name="monthly_limit"
				type="number"
				min="0"
				value={key.monthlyLimit}
				class="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>
		<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
			Save
		</button>
	</form>

	{#if form?.limitError}
		<p class="mt-3 text-sm text-red-700">{form.limitError}</p>
	{:else if form?.limitSet !== undefined}
		<p class="mt-3 text-sm text-emerald-700">
			Limit is now {limitLabel(form.limitSet)}.
		</p>
	{/if}
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">What this key may call</h2>
	<p class="mt-1 max-w-3xl text-sm text-slate-500">
		Computed here, from the key's scopes and the same rule the engine applies: the resource is the
		third path segment and the action comes from the method. Nothing was called to produce this
		table.
	</p>

	<div class="mt-4 overflow-x-auto rounded-lg border border-slate-200">
		<table class="w-full text-sm">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3 font-medium">Route</th>
					<th class="px-4 py-3 font-medium">Scope derived</th>
					<th class="px-4 py-3 font-medium">Verdict</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200">
				{#each data.probes as probe (probe.method + probe.path)}
					<tr>
						<td class="px-4 py-3 font-mono text-xs text-slate-700">
							{probe.method}
							{probe.path}
						</td>
						<td class="px-4 py-3 font-mono text-xs text-slate-500">
							{#if probe.scopeGated}{probe.required}{:else}not scope gated{/if}
						</td>
						<td class="px-4 py-3">
							{#if !probe.scopeGated}
								<span class="text-slate-600">200, whatever the scopes say</span>
							{:else if probe.allowed}
								<span class="text-emerald-700">granted</span>
							{:else}
								<span class="text-slate-500">403 insufficient scope</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if key.roles.length > 0}
		<p class="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
			This key holds the role {key.roles.join(', ')}. A key with admin or super_admin skips the
			scope check altogether, so the verdicts above understate what it can do.
		</p>
	{/if}

	{#if key.schemas.length > 0}
		<p class="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
			The key names {key.schemas.join(', ')} in its <code>schemas</code> list. That list is stored,
			returned by the API, and read by nothing: it is dropped when the key is turned into request
			claims, so it restricts no content type.
		</p>
	{/if}
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Audit trail</h2>
	<p class="mt-1 max-w-3xl text-sm text-slate-500">
		One row per request that got past the scope check, newest first. A refusal from the scope gate
		is metered and never recorded, because the audit middleware is mounted after it, and requests
		to the quota status route are not recorded either. So this list is shorter than the request
		count above, by design rather than by loss.
	</p>

	{#if data.audit === null}
		<p class="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
			The engine answered 404 for the trail.
		</p>
	{:else if data.audit.length === 0}
		<p class="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
			Nothing yet. Put the key in <code class="rounded bg-slate-100 px-1.5 py-0.5">client/.env</code>
			and run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm client</code>.
		</p>
	{:else}
		<div class="mt-4 overflow-x-auto rounded-lg border border-slate-200">
			<table class="w-full text-sm">
				<thead class="bg-slate-50 text-left text-slate-500">
					<tr>
						<th class="px-4 py-3 font-medium">When</th>
						<th class="px-4 py-3 font-medium">Request</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">From</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200">
					{#each data.audit as entry (entry.id)}
						<tr>
							<td class="px-4 py-3 whitespace-nowrap text-slate-500">{when(entry.ts)}</td>
							<td class="px-4 py-3 font-mono text-xs text-slate-700">
								{entry.method}
								{entry.path}
							</td>
							<td class="px-4 py-3 tabular-nums">
								<span class={entry.status >= 400 ? 'text-red-700' : 'text-emerald-700'}>
									{entry.status}
								</span>
							</td>
							<td class="px-4 py-3 text-slate-500">{entry.ip}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="mt-3 text-sm text-slate-500">
			Oldest row shown is {shortId(data.audit[data.audit.length - 1].id)}. The trail references the
			key with ON DELETE CASCADE, so deleting the key deletes all of this too.
		</p>
	{/if}
</section>
