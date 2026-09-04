<script lang="ts">
	import { enhance } from '$app/forms';
	import { count, day, limitLabel } from '$lib/format';

	let { data, form } = $props();

	const minted = $derived(form?.minted ?? null);
</script>

<svelte:head><title>API keys</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">API keys</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	A key is the credential the engine designs for a client that is not a browser. It goes in the
	<code class="rounded bg-slate-100 px-1.5 py-0.5">X-API-Key</code> header, it is accepted on the
	public router at
	<code class="rounded bg-slate-100 px-1.5 py-0.5">{data.apiUrl}</code>, and what it may do is
	decided by its scopes and nothing else.
</p>

{#if minted}
	<section class="mt-8 rounded-lg border-2 border-amber-400 bg-amber-50 p-6">
		<h2 class="font-semibold text-amber-900">Copy this now</h2>
		<p class="mt-1 text-sm text-amber-900">
			The engine stores a peppered HMAC of the key and returns the plaintext once. This page is the
			only time it exists outside the client you paste it into. Losing it means minting another.
		</p>
		<p class="mt-4 break-all rounded bg-white px-4 py-3 font-mono text-sm text-slate-900">
			{minted.rawKey}
		</p>
		<dl class="mt-4 grid grid-cols-3 gap-4 text-sm text-amber-900">
			<div>
				<dt class="font-medium">Name</dt>
				<dd class="mt-0.5">{minted.name}</dd>
			</div>
			<div>
				<dt class="font-medium">Scopes</dt>
				<dd class="mt-0.5 font-mono text-xs">{minted.scopes.join(' ')}</dd>
			</div>
			<div>
				<dt class="font-medium">Monthly limit</dt>
				<dd class="mt-0.5">{limitLabel(minted.monthlyLimit)}</dd>
			</div>
		</dl>
		<p class="mt-4 text-sm text-amber-900">
			Put it in <code class="rounded bg-white px-1.5 py-0.5">client/.env</code> as
			<code class="rounded bg-white px-1.5 py-0.5">LYEVE_MOBILE_API_KEY</code>
			and run <code class="rounded bg-white px-1.5 py-0.5">pnpm client</code>.
		</p>
	</section>
{/if}

<section class="mt-8 rounded-lg border border-slate-200 p-6">
	<h2 class="font-medium">Mint a key</h2>
	<p class="mt-1 text-sm text-slate-500">
		Scopes are <code class="rounded bg-slate-100 px-1.5 py-0.5">resource:action</code> pairs. The
		engine derives the pair a request needs from the request itself, so the list below is that rule
		applied to the routes a client actually calls. No role is offered: a key holding
		<code class="rounded bg-slate-100 px-1.5 py-0.5">admin</code> skips the scope check entirely,
		which is the opposite of narrowing it.
	</p>

	<form method="POST" action="?/mint" use:enhance class="mt-5 space-y-5">
		<div class="grid grid-cols-3 gap-4">
			<label class="block text-sm">
				<span class="font-medium">Name</span>
				<input
					name="name"
					required
					placeholder="transit-app-ios"
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
				<span class="mt-1 block text-xs text-slate-500">0 is unlimited.</span>
			</label>
			<label class="block text-sm">
				<span class="font-medium">Expires in days</span>
				<input
					name="expiry_days"
					type="number"
					min="1"
					max="3650"
					placeholder="blank for never"
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
			</label>
		</div>

		<fieldset>
			<legend class="text-sm font-medium">Scopes</legend>
			<div class="mt-2 space-y-2">
				{#each data.scopeChoices as choice (choice.scope)}
					<label class="flex items-start gap-3 text-sm">
						<input
							type="checkbox"
							name="scopes"
							value={choice.scope}
							checked={choice.scope === 'content:read' || choice.scope === 'schemas:read'}
							class="mt-1"
						/>
						<span>
							<code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
								{choice.scope}
							</code>
							<span class="ml-2 text-slate-700">{choice.label}</span>
							{#if choice.dangerous}
								<span class="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
									not for a phone
								</span>
							{/if}
							<span class="mt-0.5 block text-xs text-slate-500">{choice.grants}</span>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
			Mint key
		</button>
	</form>

	{#if form?.mintError}
		<p class="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{form.mintError}</p>
	{/if}
</section>

<section class="mt-10">
	<div class="flex items-baseline justify-between">
		<h2 class="text-lg font-semibold tracking-tight">Issued keys</h2>
		<p class="text-sm text-slate-500">Requests and bytes are for {data.period}, tenant {data.tenant}.</p>
	</div>

	{#if form?.rowError}
		<p class="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{form.rowError}</p>
	{/if}

	{#if data.keys.length === 0}
		<p class="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
			No keys yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to seed the
			content and mint the two the example ships with, or mint one above.
		</p>
	{:else}
		<div class="mt-4 overflow-x-auto rounded-lg border border-slate-200">
			<table class="w-full text-sm">
				<thead class="bg-slate-50 text-left text-slate-500">
					<tr>
						<th class="px-4 py-3 font-medium">Key</th>
						<th class="px-4 py-3 font-medium">Scopes</th>
						<th class="px-4 py-3 font-medium">State</th>
						<th class="px-4 py-3 text-right font-medium">Requests</th>
						<th class="px-4 py-3 text-right font-medium">Limit</th>
						<th class="px-4 py-3 font-medium"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200">
					{#each data.keys as key (key.id)}
						<tr>
							<td class="px-4 py-3">
								<a href="/keys/{key.id}" class="font-medium hover:underline">{key.name}</a>
								<span class="mt-0.5 block text-xs text-slate-400">
									minted {day(key.createdAt)}
									{#if key.expiresAt}, expires {day(key.expiresAt)}{/if}
								</span>
							</td>
							<td class="px-4 py-3">
								{#if key.scopes.length === 0}
									<span class="text-slate-400">none, so every scoped route refuses it</span>
								{:else}
									<span class="font-mono text-xs text-slate-700">{key.scopes.join(' ')}</span>
								{/if}
								{#if key.roles.length > 0}
									<span class="mt-0.5 block text-xs text-red-700">
										holds {key.roles.join(' ')}, which skips the scope check
									</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								{#if !key.enabled}
									<span class="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
										revoked
									</span>
								{:else if key.expired}
									<span class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
										expired
									</span>
								{:else}
									<span
										class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
									>
										live
									</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right tabular-nums">{count(key.requests)}</td>
							<td class="px-4 py-3 text-right tabular-nums">{limitLabel(key.monthlyLimit)}</td>
							<td class="px-4 py-3">
								<div class="flex justify-end gap-3">
									{#if key.enabled}
										<form method="POST" action="?/revoke" use:enhance>
											<input type="hidden" name="id" value={key.id} />
											<button class="text-xs text-slate-500 underline hover:text-slate-900">
												Revoke
											</button>
										</form>
									{/if}
									<form method="POST" action="?/remove" use:enhance>
										<input type="hidden" name="id" value={key.id} />
										<button class="text-xs text-red-700 underline hover:text-red-900">Delete</button>
									</form>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="mt-3 text-sm text-slate-500">
			Revoke disables the key and keeps everything it did. Delete cascades: the usage rows and the
			audit trail go with the key, and the tenant's recorded call count for the period drops by
			what that key had spent. For a credential that leaked, revoke is the honest one.
		</p>
	{/if}
</section>
