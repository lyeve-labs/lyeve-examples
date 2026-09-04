<script lang="ts">
	let { data } = $props();

	const nextOffset = $derived(data.offset + data.limit);
	const prevOffset = $derived(Math.max(0, data.offset - data.limit));
	const maskedSubjects = $derived(data.entries.filter((e) => e.subjectMasked).length);

	function href(action: string, offset: number) {
		const q = new URLSearchParams();
		if (action) q.set('action', action);
		if (offset > 0) q.set('offset', String(offset));
		const s = q.toString();
		return s ? `/audit?${s}` : '/audit';
	}
</script>

<svelte:head><title>DSAR audit trail</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">DSAR audit trail</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	Every export and erasure the engine ran, filtered to
	<code class="rounded bg-slate-200 px-1.5 py-0.5">resource_type={data.resourceType}</code>. Both
	DSAR handlers file under that resource type, which makes it the one filter that catches both
	actions in a single read.
</p>

<div class="mt-6 flex flex-wrap gap-2 text-sm">
	<a
		href={href('', 0)}
		class="rounded-md border px-3 py-1.5 {data.action === ''
			? 'border-slate-900 bg-slate-900 text-white'
			: 'border-slate-300 hover:bg-white'}">All</a
	>
	{#each data.actions as action (action)}
		<a
			href={href(action, 0)}
			class="rounded-md border px-3 py-1.5 {data.action === action
				? 'border-slate-900 bg-slate-900 text-white'
				: 'border-slate-300 hover:bg-white'}"
		>
			<code>{action}</code>
		</a>
	{/each}
</div>

<p class="mt-4 text-sm text-slate-500">
	{data.total} entr{data.total === 1 ? 'y' : 'ies'}
	{#if data.pendingWrites}
		<span class="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">
			plus entries still queued: the total is short by an unknown amount
		</span>
	{/if}
</p>

{#if data.entries.length === 0}
	<p class="mt-6 rounded-lg border border-slate-200 bg-white px-5 py-4 text-slate-500">
		Nothing recorded under this filter. Run an export from a request page and it appears here.
	</p>
{:else}
	<div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="w-full text-sm">
			<thead class="border-b border-slate-200 text-left text-slate-500">
				<tr>
					<th class="px-5 py-3 font-medium">Seq</th>
					<th class="px-5 py-3 font-medium">When</th>
					<th class="px-5 py-3 font-medium">Action</th>
					<th class="px-5 py-3 font-medium">Subject</th>
					<th class="px-5 py-3 font-medium">Operator</th>
					<th class="px-5 py-3 font-medium">From</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.entries as entry (entry.id)}
					<tr>
						<td class="px-5 py-3 text-slate-400">{entry.sequence}</td>
						<td class="px-5 py-3 text-slate-500">
							{new Date(entry.createdAt).toLocaleString()}
						</td>
						<td class="px-5 py-3"><code>{entry.action}</code></td>
						<td class="px-5 py-3">
							{#if entry.subjectMasked}
								<span class="text-slate-400 italic">withheld on read</span>
							{:else}
								<code class="break-all text-xs">{entry.subject}</code>
							{/if}
						</td>
						<td class="px-5 py-3 text-slate-500">
							<code class="text-xs">{entry.userId ?? 'none'}</code>
						</td>
						<td class="px-5 py-3 text-slate-500">
							{entry.ip}
							{#if entry.userAgent}<span class="block text-xs">{entry.userAgent}</span>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="mt-4 flex gap-4 text-sm">
		{#if data.offset > 0}
			<a href={href(data.action, prevOffset)} class="underline">Newer</a>
		{/if}
		{#if nextOffset < data.total}
			<a href={href(data.action, nextOffset)} class="underline">Older</a>
		{/if}
	</div>
{/if}

<div class="mt-8 max-w-3xl space-y-3 text-sm text-slate-500">
	{#if maskedSubjects > 0}
		<p class="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
			{maskedSubjects} of these entries will not say who they were about. The identifier is stored
			in the row, but this route is not exempt from response masking, so an address is replaced on
			the way out. An account id survives, because a UUID matches no rule. The trail can therefore
			prove an export happened and cannot always say whose data it was, which is why this desk keeps
			its own digest beside every action it runs.
		</p>
	{/if}
	<p>
		A DSAR entry carries no tenant. The handlers run without tenant context, so these rows are
		platform-scoped where an ordinary content entry is filed under a tenant.
	</p>
	<p>
		Entries are hash-chained: each row carries the digest of the one before it, so a deletion from
		the middle of the log is detectable. Nothing on this page verifies the chain, and the engine
		exposes no route that does.
	</p>
	<p>
		Writes are asynchronous. The route drains its queue before counting, and says so when it could
		not, which is the amber note above the table.
	</p>
</div>
