<script lang="ts">
	let { data } = $props();

	const nextOffset = $derived(data.log.offset + data.log.limit);
	const prevOffset = $derived(Math.max(0, data.log.offset - data.log.limit));
</script>

<svelte:head><title>Masking rules</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Masking rules</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	Response-body masking runs over every JSON response on both routers and rewrites anything that
	looks like personal data before it reaches the wire. The rules are compiled in: this page reads
	them, and there is no route that adds one, edits one or turns one off.
</p>

{#if data.selfMasked.length > 0}
	<p class="mt-6 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
		<strong>{data.selfMasked.join(', ')}</strong> came back with its own description masked. This
		route is not on the exemption list, so a rule that documents what it matches matches itself on
		the way out: the description below is the masked copy, not what the plugin holds. It is the
		clearest demonstration on the whole desk that masking happens after the handler has decided what
		to send.
	</p>
{/if}

<div class="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
	<table class="w-full text-sm">
		<thead class="border-b border-slate-200 text-left text-slate-500">
			<tr>
				<th class="px-5 py-3 font-medium">Priority</th>
				<th class="px-5 py-3 font-medium">Rule</th>
				<th class="px-5 py-3 font-medium">Replacement</th>
				<th class="px-5 py-3 font-medium">Description</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100">
			{#each data.rules as rule (rule.name)}
				<tr>
					<td class="px-5 py-3 text-slate-500">{rule.priority}</td>
					<td class="px-5 py-3"><code>{rule.name}</code></td>
					<td class="px-5 py-3"><code class="text-xs">{rule.replacement}</code></td>
					<td class="px-5 py-3 text-slate-600">{rule.description}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="mt-4 max-w-3xl text-sm text-slate-500">
	Priority is application order, lowest first, and it matters: the token rule runs before the email
	rule so a bearer token containing an address is redacted whole rather than half-masked. The card
	rule is gated on a Luhn check and an issuer prefix, which is what keeps a long order number from
	being read as a card.
</p>

<h2 class="mt-10 text-lg font-semibold">Exempt paths</h2>
<p class="mt-2 max-w-3xl text-slate-600">
	Four admin prefixes are exempt from the rewrite: the DSAR routes, the operator's own identity, the
	user directory and pending invitations. On those the address is the record being administered, so
	masking it removes the console's ability to do the job rather than protecting anybody. It is why
	the export on this desk hands over real addresses while the audit trail two pages over does not.
</p>
<p class="mt-2 max-w-3xl text-slate-600">
	The exemption suppresses the rewrite and not the record. An export still writes a PII access
	entry, which is the right way round for the one route whose whole purpose is handing over
	somebody's personal data.
</p>

<h2 class="mt-10 text-lg font-semibold">Access log</h2>
<p class="mt-2 max-w-3xl text-slate-600">
	{data.log.total} response(s) carried personal data, this desk's own reads included. Loading this
	page writes another entry, because the log below contains addresses often enough to match.
</p>

{#if data.log.entries.length === 0}
	<p class="mt-4 text-slate-500">Nothing recorded yet.</p>
{:else}
	<div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="w-full text-sm">
			<thead class="border-b border-slate-200 text-left text-slate-500">
				<tr>
					<th class="px-5 py-3 font-medium">When</th>
					<th class="px-5 py-3 font-medium">Viewer</th>
					<th class="px-5 py-3 font-medium">Tenant</th>
					<th class="px-5 py-3 font-medium">Matched</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.log.entries as entry (entry.id)}
					<tr>
						<td class="px-5 py-3 text-slate-500">
							{new Date(entry.accessedAt).toLocaleString()}
						</td>
						<td class="px-5 py-3">{entry.viewerRole || 'unknown'}</td>
						<td class="px-5 py-3 text-slate-500">{entry.tenantId || 'platform'}</td>
						<td class="px-5 py-3">
							{#each entry.types as type (type.name)}
								<span class="mr-2 whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-xs">
									{type.name}{type.count > 1 ? ` x${type.count}` : ''}
								</span>
							{/each}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="mt-4 flex gap-4 text-sm">
		{#if data.log.offset > 0}
			<a href="/masking?offset={prevOffset}" class="underline">Newer</a>
		{/if}
		{#if nextOffset < data.log.total}
			<a href="/masking?offset={nextOffset}" class="underline">Older</a>
		{/if}
	</div>
{/if}

<p class="mt-4 max-w-3xl text-sm text-slate-500">
	An entry records the viewer, the role, the tenant and which rules matched. It does not record the
	route or the value, so it says that a super_admin was served eleven addresses at 12:35 and not
	which addresses or from where. The counts repeat a rule name once per match rather than once per
	kind, so they measure how much was in the response, not how many kinds.
</p>
