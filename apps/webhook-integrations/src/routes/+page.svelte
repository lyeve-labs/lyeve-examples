<script lang="ts">
	import { percent } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>Webhook endpoints</title></svelte:head>

<header class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Endpoints</h1>
		<p class="mt-1 text-sm text-slate-500">
			Three registrations, all pointing at this app's own receiver. Two hold its signing key and
			one deliberately does not.
		</p>
	</div>
	<form method="POST" action="?/register">
		<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
			Register at {data.receiverUrl}
		</button>
	</form>
</header>

{#if form?.error}
	<p class="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
		{form.error}
	</p>
{/if}
{#if form?.registered}
	<p class="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
		{form.registered}. Delivering to {form.target}.
	</p>
{/if}
{#if form?.rotated}
	<p class="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
		Rotated {form.rotated}. This receiver accepts the previous key for another ten minutes.
	</p>
{/if}
{#if form?.tested}
	<p
		class="mt-6 rounded-md border px-4 py-3 text-sm {form.success
			? 'border-emerald-200 bg-emerald-50 text-emerald-900'
			: 'border-amber-200 bg-amber-50 text-amber-900'}"
	>
		Test fired: HTTP {form.status}. {form.message}
	</p>
{/if}
{#if form?.toggled}
	<p class="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
		{form.toggled} is now {form.enabled ? 'enabled' : 'disabled'}.
	</p>
{/if}

<section class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
	{#if data.health}
		<div class="rounded-lg border border-slate-200 p-4">
			<p class="text-xs uppercase tracking-wide text-slate-400">Webhooks</p>
			<p class="mt-1 text-2xl font-semibold">{data.health.total_webhooks}</p>
			<p class="text-xs text-slate-500">{data.health.unhealthy_webhooks} unhealthy</p>
		</div>
		<div class="rounded-lg border border-slate-200 p-4">
			<p class="text-xs uppercase tracking-wide text-slate-400">Retries pending</p>
			<p class="mt-1 text-2xl font-semibold">{data.health.pending_retries}</p>
			<p class="text-xs text-slate-500">the worker ticks every 30s</p>
		</div>
		<div class="rounded-lg border border-slate-200 p-4">
			<p class="text-xs uppercase tracking-wide text-slate-400">Dead letters</p>
			<p class="mt-1 text-2xl font-semibold">{data.health.pending_dlq}</p>
			<p class="text-xs text-slate-500">{data.health.total_dlq} in total</p>
		</div>
	{/if}
	<div class="rounded-lg border border-slate-200 p-4">
		<p class="text-xs uppercase tracking-wide text-slate-400">Receipts written</p>
		<p class="mt-1 text-2xl font-semibold">{data.receipts ?? 0}</p>
		<p class="text-xs text-slate-500">accepted and rejected</p>
	</div>
</section>

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Signing keys this receiver accepts</h2>
	<ul class="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
		{#each data.keys as key (key.position)}
			<li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
				<code class="font-mono text-slate-700">{key.shape}</code>
				{#if key.active}
					<span class="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
						active, used for new registrations
					</span>
				{:else}
					<span class="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
						retiring in {key.retiresInSeconds}s, still verifies
					</span>
				{/if}
			</li>
		{/each}
	</ul>
	<p class="mt-3 text-sm text-slate-500">
		{#if data.usingEnvironmentKey}
			This is the key from the environment, so a restart changes nothing.
		{:else}
			This key exists only in this process. Restart the app and it reverts to the environment's
			key, while the engine keeps signing with the rotated one, and every delivery is rejected
			until the endpoints are registered again.
		{/if}
	</p>
	<form method="POST" action="?/rotate" class="mt-3">
		<button class="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
			Rotate the signing key
		</button>
	</form>
</section>

<section class="mt-10 space-y-4">
	{#each data.endpoints as endpoint (endpoint.channel)}
		<article class="rounded-lg border border-slate-200 p-5">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 class="font-semibold tracking-tight">
						{endpoint.name}
						<span class="ml-2 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
							{endpoint.channel}
						</span>
					</h2>
					<p class="mt-1 text-sm text-slate-600">{endpoint.description}</p>
				</div>
				{#if endpoint.registered}
					<div class="flex flex-wrap gap-2">
						<form method="POST" action="?/test">
							<input type="hidden" name="id" value={endpoint.id} />
							<button class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
								Send a test
							</button>
						</form>
						<form method="POST" action="?/toggle">
							<input type="hidden" name="id" value={endpoint.id} />
							<input type="hidden" name="channel" value={endpoint.channel} />
							<input type="hidden" name="enable" value={endpoint.enabled ? 'false' : 'true'} />
							<button class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
								{endpoint.enabled ? 'Disable' : 'Enable'}
							</button>
						</form>
						<form method="POST" action="?/remove">
							<input type="hidden" name="id" value={endpoint.id} />
							<button class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
								Remove
							</button>
						</form>
					</div>
				{/if}
			</div>

			{#if !endpoint.registered}
				<p class="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
					Not registered yet. Use the button above, which registers all three at once.
				</p>
			{:else}
				<dl class="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
					<div class="sm:col-span-2">
						<dt class="text-slate-500">URL</dt>
						<dd class="font-mono text-xs break-all">{endpoint.url}</dd>
					</div>
					<div>
						<dt class="text-slate-500">Events</dt>
						<dd class="font-mono text-xs">{endpoint.events.join(', ')}</dd>
					</div>
					<div>
						<dt class="text-slate-500">Schemas</dt>
						<dd class="font-mono text-xs">{endpoint.schemas.join(', ')}</dd>
					</div>
					{#if endpoint.jsonpathFilter}
						<div class="sm:col-span-2">
							<dt class="text-slate-500">JSONPath filter</dt>
							<dd class="font-mono text-xs">{endpoint.jsonpathFilter}</dd>
						</div>
					{/if}
					{#if endpoint.excludeFields.length > 0}
						<div class="sm:col-span-2">
							<dt class="text-slate-500">Excluded top-level fields</dt>
							<dd class="font-mono text-xs">{endpoint.excludeFields.join(', ')}</dd>
						</div>
					{/if}
					<div>
						<dt class="text-slate-500">Signing key</dt>
						<dd>
							{#if endpoint.holdsAppKey}
								this app's, so deliveries verify
							{:else}
								a key the receiver does not hold, so every delivery is rejected with 401
							{/if}
						</dd>
					</div>
					<div>
						<dt class="text-slate-500">State</dt>
						<dd>{endpoint.enabled ? 'enabled' : 'disabled'}</dd>
					</div>
				</dl>

				<div class="mt-4 flex flex-wrap items-center gap-6 text-sm">
					{#if endpoint.stats}
						<span>
							<strong>{endpoint.stats.total}</strong> deliveries,
							{endpoint.stats.success_count} accepted,
							{endpoint.stats.failure_count} refused
						</span>
						<span class="text-slate-500">{percent(endpoint.stats.success_rate)} accepted</span>
						<span class="text-slate-500">
							{Math.round(endpoint.stats.avg_latency_ms)} ms average
						</span>
					{/if}
					{#if endpoint.condition}
						<span class="text-slate-500">
							health says {endpoint.condition.healthy ? 'healthy' : 'unhealthy'} over
							{endpoint.condition.total_attempts} attempts
						</span>
					{/if}
					<a class="font-medium underline" href="/deliveries?webhook={endpoint.id}">
						Delivery log
					</a>
				</div>
			{/if}
		</article>
	{/each}
</section>

{#if data.strangers.length > 0}
	<section class="mt-10">
		<h2 class="text-lg font-semibold tracking-tight">Other registrations on this engine</h2>
		<p class="mt-1 text-sm text-slate-500">
			Every example shares one instance, so these belong to something else. Listed to make the point
			that a webhook is engine-wide, not per application.
		</p>
		<ul class="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
			{#each data.strangers as stranger (stranger.id)}
				<li class="px-4 py-3">
					<span class="font-medium">{stranger.name}</span>
					<span class="ml-2 font-mono text-xs text-slate-500">{stranger.url}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if data.inbound}
	<p class="mt-10 text-sm text-slate-500">
		The inbound endpoint is wired too: <a class="underline" href="/inbound">/inbound</a> posts a
		signed sample to the engine and writes into {data.inbound.schema}.
	</p>
{/if}
