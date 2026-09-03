<script lang="ts">
	import { day, limit } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>Tenants</title></svelte:head>

<div class="flex items-baseline justify-between">
	<h1 class="text-2xl font-semibold tracking-tight">Tenants</h1>
	<p class="text-sm text-slate-500">
		{data.tenants.length}
		{data.tenants.length === 1 ? 'account' : 'accounts'}
	</p>
</div>

{#if data.tenants.length === 0}
	<p class="mt-6 rounded-lg border border-slate-200 bg-white p-5 text-slate-600">
		No tenants yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to seed
		three, or create one below.
	</p>
{:else}
	<div class="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
				<tr>
					<th class="px-5 py-3 font-medium">Account</th>
					<th class="px-5 py-3 font-medium">Plan</th>
					<th class="px-5 py-3 font-medium">Region</th>
					<th class="px-5 py-3 font-medium">Request allowance</th>
					<th class="px-5 py-3 font-medium">Created</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.tenants as tenant (tenant.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-5 py-4">
							<a href="/tenants/{tenant.slug}" class="font-medium hover:underline">{tenant.name}</a>
							<p class="mt-0.5 font-mono text-xs text-slate-400">{tenant.slug}</p>
							{#if !tenant.enabled}
								<span class="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
									disabled
								</span>
							{/if}
							{#if tenant.archived}
								<span class="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
									archived
								</span>
							{/if}
							{#if !tenant.hasProfile}
								<span class="mt-1 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-800">
									no profile
								</span>
							{/if}
						</td>
						<td class="px-5 py-4">
							{tenant.planTitle ?? tenant.plan}
							<p class="mt-0.5 font-mono text-xs text-slate-400">{tenant.plan}</p>
						</td>
						<td class="px-5 py-4 text-slate-600">{tenant.region || 'not set'}</td>
						<td class="px-5 py-4 text-slate-600">
							{limit(tenant.requestsLimit)}
							{#if tenant.blocked}
								<span class="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-800">blocked</span>
							{/if}
						</td>
						<td class="px-5 py-4 text-slate-500">{day(tenant.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<section class="mt-12">
	<h2 class="text-lg font-semibold tracking-tight">Provision a tenant</h2>
	<p class="mt-1 max-w-2xl text-sm text-slate-600">
		One submission writes three rows in three plugins: the tenant in the engine roster, the customer
		profile as content, and the plan's allowances as a quota. Nothing joins them but the slug.
	</p>

	{#if form?.error}
		<p class="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
			{form.error}
		</p>
	{/if}

	<form method="POST" action="?/create" class="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
		<label class="block text-sm">
			<span class="font-medium">Company</span>
			<input
				name="company"
				value={form?.company ?? ''}
				placeholder="Halden Instruments"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>

		<label class="block text-sm">
			<span class="font-medium">Handle</span>
			<input
				name="handle"
				value={form?.handle ?? ''}
				placeholder="halden"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono outline-none focus:border-slate-900"
			/>
			<span class="mt-1 block text-xs text-slate-500">
				Becomes <code>saas_&lt;handle&gt;</code>. Lowercase letters, digits and underscores. The
				engine rejects anything else because the slug reaches raw DDL.
			</span>
		</label>

		<label class="block text-sm">
			<span class="font-medium">Billing contact</span>
			<input
				name="contact_name"
				value={form?.contactName ?? ''}
				placeholder="Ingrid Solheim"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>

		<label class="block text-sm">
			<span class="font-medium">Contact email</span>
			<input
				name="contact_email"
				type="email"
				value={form?.contactEmail ?? ''}
				placeholder="ingrid.solheim@halden.example"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>

		<label class="block text-sm">
			<span class="font-medium">Region</span>
			<input
				name="region"
				value={form?.region ?? ''}
				placeholder="eu-north-1"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>

		<label class="block text-sm">
			<span class="font-medium">Plan</span>
			<select
				name="plan"
				class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
			>
				<option value="">Choose a plan</option>
				{#each data.plans as plan (plan.id)}
					<option value={plan.id} selected={form?.planId === plan.id}>
						{plan.title} at ${plan.price} a month
					</option>
				{/each}
			</select>
		</label>

		<div class="sm:col-span-2">
			<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
				Provision tenant
			</button>
		</div>
	</form>
</section>

<section class="mt-12">
	<h2 class="text-lg font-semibold tracking-tight">Plans</h2>
	<p class="mt-1 text-sm text-slate-600">
		Plans are ordinary content. The engine's tenant row holds only a plan string. The commercial
		terms behind it belong to the application.
	</p>
	<ul class="mt-5 grid gap-4 sm:grid-cols-3">
		{#each data.plans as plan (plan.id)}
			<li class="rounded-lg border border-slate-200 bg-white p-5">
				<p class="text-sm font-semibold">{plan.title}</p>
				<p class="mt-1 text-2xl font-semibold tracking-tight">${plan.price}<span class="text-sm font-normal text-slate-500">/mo</span></p>
				<p class="mt-3 text-sm text-slate-600">{plan.summary}</p>
				<dl class="mt-4 space-y-1 text-xs text-slate-500">
					<div class="flex justify-between"><dt>Requests</dt><dd>{limit(plan.requests)}</dd></div>
					<div class="flex justify-between"><dt>Storage</dt><dd>{plan.storageMb} MB</dd></div>
					<div class="flex justify-between"><dt>Bandwidth</dt><dd>{plan.bandwidthGb} GB</dd></div>
				</dl>
			</li>
		{/each}
	</ul>
</section>
