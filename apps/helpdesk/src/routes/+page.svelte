<script lang="ts">
	import {
		PRIORITY_LABEL,
		PRIORITY_STYLE,
		STATUS_LABEL,
		STATUS_STYLE,
		formatWhen
	} from '$lib/desk';

	let { data } = $props();

	const tabs = $derived([
		{ view: 'active', label: 'Active', count: data.counts.active },
		{ view: 'open', label: 'Open', count: data.counts.open },
		{ view: 'pending', label: 'Waiting', count: data.counts.pending },
		{ view: 'closed', label: 'Closed', count: data.counts.closed }
	]);
</script>

<svelte:head><title>Inbox</title></svelte:head>

<div class="flex items-baseline justify-between">
	<h1 class="text-2xl font-semibold tracking-tight">Inbox</h1>
	<a href="/new" class="text-sm text-slate-500 hover:underline">Open a ticket</a>
</div>

<nav class="mt-6 flex flex-wrap gap-2">
	{#each tabs as tab (tab.view)}
		<a
			href="/?view={tab.view}"
			class="rounded-full px-3 py-1.5 text-sm {data.view === tab.view
				? 'bg-slate-900 text-white'
				: 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'}"
		>
			{tab.label}
			<span class="ml-1 tabular-nums opacity-70">{tab.count}</span>
		</a>
	{/each}
</nav>

{#if data.tickets.length === 0}
	<p class="mt-10 text-slate-500">
		Nothing in this queue. Run <code class="rounded bg-slate-200 px-1.5 py-0.5">pnpm run setup</code> to
		provision the content types and seed a desk with traffic on it.
	</p>
{:else}
	<ul class="mt-6 divide-y divide-slate-200 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
		{#each data.tickets as ticket (ticket.id)}
			<li class="px-5 py-4">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {PRIORITY_STYLE[
							ticket.priority
						]}"
					>
						{PRIORITY_LABEL[ticket.priority]}
					</span>
					<span
						class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset {STATUS_STYLE[
							ticket.status
						]}"
					>
						{STATUS_LABEL[ticket.status]}
					</span>
					<span class="ml-auto text-xs text-slate-400">{formatWhen(ticket.openedAt)}</span>
				</div>

				<h2 class="mt-2 font-medium">
					<a href="/tickets/{ticket.slug}" class="hover:underline">{ticket.subject}</a>
				</h2>
				<p class="mt-1 text-sm text-slate-500">
					{ticket.requesterName}
					{#if ticket.requesterEmail}<span class="text-slate-400">
							&lt;{ticket.requesterEmail}&gt;</span
						>{/if}
					{#if ticket.replies > 0}
						<span class="text-slate-400">
							· {ticket.replies}
							{ticket.replies === 1 ? 'reply' : 'replies'}</span
						>
					{/if}
				</p>
			</li>
		{/each}
	</ul>
{/if}
