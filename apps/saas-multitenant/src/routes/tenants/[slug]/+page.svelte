<script lang="ts">
	import { bytes, count, day, limit, percent } from '$lib/format';

	let { data, form } = $props();

	const tenant = $derived(data.tenant);
	const usedPct = $derived(
		data.usage && data.quota ? percent(data.usage.apiCalls, data.quota.requestsLimit) : null
	);
</script>

<svelte:head><title>{tenant.name}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All tenants</a>

<div class="mt-5 flex items-start gap-5">
	{#if data.profile?.logoId}
		<img src="/media/{data.profile.logoId}" alt="" class="h-14 w-14 shrink-0 rounded-lg object-cover" />
	{/if}
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
		<p class="mt-1 font-mono text-sm text-slate-500">{tenant.slug}</p>
	</div>
</div>

<dl class="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-6 text-sm sm:grid-cols-3">
	<div>
		<dt class="text-xs uppercase tracking-wide text-slate-500">Plan</dt>
		<dd class="mt-1">{data.profile?.planTitle ?? tenant.plan}</dd>
	</div>
	<div>
		<dt class="text-xs uppercase tracking-wide text-slate-500">Billing contact</dt>
		<dd class="mt-1">
			{data.profile?.contactName || 'not recorded'}
			{#if data.profile?.contactEmail}
				<span class="block text-slate-500">{data.profile.contactEmail}</span>
			{/if}
		</dd>
	</div>
	<div>
		<dt class="text-xs uppercase tracking-wide text-slate-500">Region</dt>
		<dd class="mt-1">{data.profile?.region || 'not set'}</dd>
	</div>
	<div>
		<dt class="text-xs uppercase tracking-wide text-slate-500">Tenant id</dt>
		<dd class="mt-1 font-mono text-xs break-all text-slate-600">{tenant.id}</dd>
	</div>
	<div>
		<dt class="text-xs uppercase tracking-wide text-slate-500">Created</dt>
		<dd class="mt-1">{day(tenant.createdAt)}</dd>
	</div>
	<div>
		<dt class="text-xs uppercase tracking-wide text-slate-500">State</dt>
		<dd class="mt-1">
			{tenant.enabled ? 'enabled' : 'disabled'}{tenant.archived ? ', archived' : ''}
		</dd>
	</div>
	{#if data.profile?.notes}
		<div class="sm:col-span-3">
			<dt class="text-xs uppercase tracking-wide text-slate-500">Account notes</dt>
			<dd class="mt-1 text-slate-600">{data.profile.notes}</dd>
		</div>
	{/if}
</dl>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">This month</h2>
	{#if data.usage}
		<div class="mt-4 grid gap-4 sm:grid-cols-4">
			<div class="rounded-lg border border-slate-200 bg-white p-5">
				<p class="text-xs uppercase tracking-wide text-slate-500">API calls</p>
				<p class="mt-1 text-2xl font-semibold tracking-tight">{count(data.usage.apiCalls)}</p>
				{#if data.quota}
					<p class="mt-1 text-xs text-slate-500">of {limit(data.quota.requestsLimit)}</p>
					{#if usedPct !== null}
						<div class="mt-3 h-1.5 rounded-full bg-slate-100">
							<div class="h-1.5 rounded-full bg-slate-900" style="width: {usedPct}%"></div>
						</div>
					{/if}
				{/if}
			</div>
			<div class="rounded-lg border border-slate-200 bg-white p-5">
				<p class="text-xs uppercase tracking-wide text-slate-500">Bandwidth</p>
				<p class="mt-1 text-2xl font-semibold tracking-tight">{bytes(data.usage.bandwidthBytes)}</p>
				{#if data.quota}
					<p class="mt-1 text-xs text-slate-500">of {bytes(data.quota.bandwidthLimit)}</p>
				{/if}
			</div>
			<div class="rounded-lg border border-slate-200 bg-white p-5">
				<p class="text-xs uppercase tracking-wide text-slate-500">Content entries</p>
				<p class="mt-1 text-2xl font-semibold tracking-tight">{count(data.usage.contentCount)}</p>
			</div>
			<div class="rounded-lg border border-slate-200 bg-white p-5">
				<p class="text-xs uppercase tracking-wide text-slate-500">Media</p>
				<p class="mt-1 text-2xl font-semibold tracking-tight">{count(data.usage.mediaCount)}</p>
				<p class="mt-1 text-xs text-slate-500">{bytes(data.usage.storageBytes)}</p>
			</div>
		</div>
	{:else}
		<p class="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
			The usage plugin answers 404 for this tenant. It decides a tenant exists by looking for an API
			key, so a tenant that has never been issued one has no usage record at all, not even zeros.
			Mint a key below.
		</p>
	{/if}
</section>

<section class="mt-10">
	<div class="flex items-baseline justify-between">
		<h2 class="text-lg font-semibold tracking-tight">API keys</h2>
		<p class="text-sm text-slate-500">{data.keys.length} on this tenant</p>
	</div>

	{#if form?.revokeError}
		<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
			{form.revokeError}
		</p>
	{/if}

	{#if data.keys.length === 0}
		<p class="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
			No keys yet.
		</p>
	{:else}
		<div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
					<tr>
						<th class="px-5 py-3 font-medium">Key</th>
						<th class="px-5 py-3 font-medium">Scopes</th>
						<th class="px-5 py-3 font-medium">Monthly limit</th>
						<th class="px-5 py-3 font-medium">Issued</th>
						<th class="px-5 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.keys as key (key.id)}
						<tr>
							<td class="px-5 py-4">
								<p class="font-medium">{key.name}</p>
								<p class="mt-0.5 font-mono text-xs text-slate-400">{key.id}</p>
								{#if !key.enabled}
									<span class="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
										revoked
									</span>
								{/if}
							</td>
							<td class="px-5 py-4">
								{#if key.scopes.length === 0}
									<span class="rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-800">
										none, so every scoped route answers 403
									</span>
								{:else}
									<div class="flex flex-wrap gap-1">
										{#each key.scopes as scope (scope)}
											<span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{scope}</span>
										{/each}
									</div>
								{/if}
							</td>
							<td class="px-5 py-4 text-slate-600">{limit(key.monthlyLimit)}</td>
							<td class="px-5 py-4 text-slate-500">{day(key.createdAt)}</td>
							<td class="px-5 py-4 text-right">
								{#if key.enabled}
									<form method="POST" action="?/revoke">
										<input type="hidden" name="id" value={key.id} />
										<button class="text-sm text-rose-700 hover:underline">Revoke</button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Mint a key</h2>

	{#if form?.minted}
		<div class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
			<p class="text-sm font-medium text-emerald-900">
				Copy this now. The engine returns the secret once and every later read answers with the
				hash.
			</p>
			<code class="mt-3 block overflow-x-auto rounded-md bg-white px-3 py-2 font-mono text-sm">
				{form.minted.rawKey}
			</code>
			<p class="mt-3 text-xs text-emerald-900">
				{form.minted.name}, scoped to {form.minted.scopes.join(', ')}
			</p>
		</div>
	{/if}

	{#if form?.mintError}
		<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
			{form.mintError}
		</p>
	{/if}

	<form method="POST" action="?/mint" class="mt-4 rounded-lg border border-slate-200 bg-white p-6">
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="block text-sm">
				<span class="font-medium">Name</span>
				<input
					name="name"
					placeholder="Storefront renderer"
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
			</label>
			<label class="block text-sm">
				<span class="font-medium">Monthly request limit</span>
				<input
					name="monthly_limit"
					type="number"
					min="0"
					value="0"
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
				<span class="mt-1 block text-xs text-slate-500">
					Zero means unlimited. Above zero the engine answers 429 once the month's count passes it.
				</span>
			</label>
		</div>

		<fieldset class="mt-5">
			<legend class="text-sm font-medium">Scopes</legend>
			<p class="mt-1 text-xs text-slate-500">
				A scope is a resource and an action, derived from the route the key will call. Roles do not
				substitute: a key with roles and no scopes authenticates and is refused everywhere.
			</p>
			<div class="mt-3 grid gap-2 sm:grid-cols-2">
				{#each data.scopeOptions as option (option.value)}
					<label class="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
						<input
							type="checkbox"
							name="scopes"
							value={option.value}
							checked={option.value === 'content:read' || option.value === 'schemas:read'}
							class="mt-1"
						/>
						<span>
							<span class="font-medium">{option.label}</span>
							<span class="block font-mono text-xs text-slate-500">{option.value}</span>
							<span class="block text-xs text-slate-500">{option.hint}</span>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<button class="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
			Mint key
		</button>
	</form>
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Spend one request</h2>
	<p class="mt-1 max-w-2xl text-sm text-slate-600">
		Sends a single <code class="rounded bg-slate-100 px-1 py-0.5">GET /api/v1/schemas</code> with the
		key in the <code class="rounded bg-slate-100 px-1 py-0.5">X-API-Key</code> header. The key is used
		once and never stored. This is the only way the figures above move: metering runs on the public
		router for key traffic alone, so nothing this console does with its own session is billed to the
		tenant.
	</p>

	{#if form?.probeError}
		<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
			{form.probeError}
		</p>
	{/if}

	{#if form?.probe}
		<div class="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm">
			<p>
				<span class="font-mono font-medium">{form.probe.status}</span>
				<span class="ml-2 text-slate-700">{form.probe.verdict}</span>
			</p>
			{#if form.probe.rows !== null}
				<p class="mt-2 text-slate-600">
					The response held {form.probe.rows}
					{form.probe.rows === 1 ? 'schema' : 'schemas'} visible to this tenant.
				</p>
			{/if}
		</div>
	{/if}

	<form method="POST" action="?/probe" class="mt-4 flex gap-2">
		<input
			name="key"
			type="password"
			autocomplete="off"
			placeholder="Paste a key issued for this tenant"
			class="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900"
		/>
		<button class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">
			Send
		</button>
	</form>
</section>

{#if data.quota}
	<section class="mt-10">
		<h2 class="text-lg font-semibold tracking-tight">Quota</h2>
		<dl class="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-white p-6 text-sm sm:grid-cols-3">
			<div>
				<dt class="text-xs uppercase tracking-wide text-slate-500">Requests</dt>
				<dd class="mt-1">{limit(data.quota.requestsLimit)}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase tracking-wide text-slate-500">Storage</dt>
				<dd class="mt-1">{bytes(data.quota.storageLimit)}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase tracking-wide text-slate-500">Bandwidth</dt>
				<dd class="mt-1">{bytes(data.quota.bandwidthLimit)}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase tracking-wide text-slate-500">Enforcement</dt>
				<dd class="mt-1">{data.quota.isHardLimit ? 'hard limit' : 'soft limit'}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase tracking-wide text-slate-500">Blocks on exceeded</dt>
				<dd class="mt-1">{data.quota.blockOnExceeded ? 'yes' : 'no'}</dd>
			</div>
			<div>
				<dt class="text-xs uppercase tracking-wide text-slate-500">Blocked</dt>
				<dd class="mt-1">{data.quota.blockedAt ? day(data.quota.blockedAt) : 'no'}</dd>
			</div>
		</dl>
	</section>
{/if}
