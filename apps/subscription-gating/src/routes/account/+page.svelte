<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const reader = $derived(data.reader);
	const entitlements = $derived(data.entitlements);

	const statusLabel: Record<string, string> = {
		active: 'Active',
		past_due: 'Payment failed',
		canceled: 'Canceled'
	};
</script>

<svelte:head><title>Your account</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Your account</h1>

{#if reader}
	<section class="mt-6 rounded-lg border border-slate-200 p-6">
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-lg font-medium">{reader.name}</p>
				<p class="text-sm text-slate-500">{reader.email}</p>
			</div>
			<span
				class="rounded-full px-3 py-1 text-sm font-medium {reader.tier === 'member' &&
				reader.status === 'active'
					? 'bg-emerald-100 text-emerald-800'
					: 'bg-amber-100 text-amber-800'}"
			>
				{reader.tier === 'member' ? 'Member' : 'Free'}
			</span>
		</div>

		<dl class="mt-6 grid grid-cols-2 gap-4 text-sm">
			<div>
				<dt class="text-slate-500">Plan</dt>
				<dd class="mt-0.5 font-medium">{reader.tier === 'member' ? 'Member' : 'Free'}</dd>
			</div>
			<div>
				<dt class="text-slate-500">Subscription status</dt>
				<dd class="mt-0.5 font-medium">{statusLabel[reader.status] ?? reader.status}</dd>
			</div>
		</dl>

		{#if reader.status === 'past_due'}
			<p class="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
				The provider has not settled your last charge. Paid articles stay locked until it sends the
				webhook that says it did.
			</p>
		{/if}

		<form method="POST" action="?/signout" use:enhance class="mt-6">
			<button class="text-sm text-slate-500 underline hover:text-slate-900">Sign out</button>
		</form>
	</section>
{:else}
	<section class="mt-6 rounded-lg border border-slate-200 p-6">
		<h2 class="font-medium">Sign in</h2>
		<p class="mt-1 text-sm text-slate-500">
			Enter a subscriber email. There is no password: this example demonstrates gating, not
			authentication.
		</p>

		<form method="POST" action="?/signin" use:enhance class="mt-4 flex gap-2">
			<input
				type="email"
				name="email"
				required
				value={form?.email ?? ''}
				placeholder="you@example.com"
				class="flex-1 rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
			<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
				Sign in
			</button>
		</form>

		{#if form?.error}
			<p class="mt-3 text-sm text-red-700">{form.error}</p>
		{/if}

		{#if data.roster.length > 0}
			<p class="mt-6 text-sm text-slate-500">Seeded accounts:</p>
			<ul class="mt-2 space-y-1 text-sm">
				{#each data.roster as person (person.email)}
					<li class="text-slate-600">
						<code class="rounded bg-slate-100 px-1.5 py-0.5">{person.email}</code>
						<span class="text-slate-400">
							{person.name}, {person.tier}, {statusLabel[person.status] ?? person.status}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<section class="mt-10">
	<h2 class="text-lg font-semibold tracking-tight">Engine license</h2>
	<p class="mt-1 text-sm text-slate-500">
		Read live from <code class="rounded bg-slate-100 px-1.5 py-0.5">GET /api/admin/entitlements</code
		>. This is what the engine grants itself, not what a reader has bought.
	</p>

	{#if entitlements}
		<div class="mt-4 rounded-lg border border-slate-200 p-6">
			<dl class="grid grid-cols-3 gap-4 text-sm">
				<div>
					<dt class="text-slate-500">Plan</dt>
					<dd class="mt-0.5 font-medium">{entitlements.plan}</dd>
				</div>
				<div>
					<dt class="text-slate-500">State</dt>
					<dd class="mt-0.5 font-medium">{entitlements.state}</dd>
				</div>
				<div>
					<dt class="text-slate-500">Tenant quota</dt>
					<dd class="mt-0.5 font-medium">{entitlements.quota}</dd>
				</div>
			</dl>

			<p class="mt-6 text-sm text-slate-500">
				{entitlements.features.length} features enforced
			</p>
			<ul class="mt-2 flex flex-wrap gap-1.5">
				{#each entitlements.features as feature (feature)}
					<li class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
						{feature}
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
			The engine did not answer the entitlements route. It is admin-only, so a credential
			without an admin role is refused.
		</p>
	{/if}
</section>
