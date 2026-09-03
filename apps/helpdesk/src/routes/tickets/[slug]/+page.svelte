<script lang="ts">
	import {
		PRIORITY_LABEL,
		PRIORITY_STYLE,
		STATUS_LABEL,
		STATUS_STYLE,
		TICKET_STATUSES,
		formatWhen
	} from '$lib/desk';

	let { data, form } = $props();
	const ticket = $derived(data.ticket);
</script>

<svelte:head><title>{ticket.subject}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; Inbox</a>

<div class="mt-6 flex flex-wrap items-center gap-2">
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
</div>

<h1 class="mt-2 text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
<p class="mt-1 text-sm text-slate-500">
	{ticket.requesterName}
	{#if ticket.requesterEmail}<span class="text-slate-400">&lt;{ticket.requesterEmail}&gt;</span
		>{/if}
	· opened {formatWhen(ticket.openedAt)}
</p>

<form method="POST" action="?/status" class="mt-5 flex flex-wrap items-center gap-2">
	<span class="text-sm text-slate-500">Move to</span>
	{#each TICKET_STATUSES as status (status)}
		<button
			name="status"
			value={status}
			disabled={status === ticket.status}
			class="rounded-md px-3 py-1.5 text-sm ring-1 ring-slate-200 enabled:bg-white enabled:hover:text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
		>
			{STATUS_LABEL[status]}
		</button>
	{/each}
</form>
{#if form?.statusError}
	<p class="mt-2 text-sm text-rose-600">{form.statusError}</p>
{/if}

<section class="mt-8 space-y-4">
	<article class="rounded-lg bg-white p-5 ring-1 ring-slate-200">
		<p class="text-sm font-medium">{ticket.requesterName}</p>
		<div class="mt-2 space-y-3 leading-relaxed whitespace-pre-line text-slate-700">
			{ticket.body}
		</div>
		{#if ticket.attachmentId}
			<img
				src="/media/{ticket.attachmentId}"
				alt="Attachment supplied by the customer"
				class="mt-4 max-w-md rounded border border-slate-200"
			/>
		{/if}
	</article>

	{#each data.thread as reply (reply.id)}
		<article
			class="rounded-lg p-5 ring-1 {reply.role === 'agent'
				? 'bg-sky-50 ring-sky-100'
				: 'bg-white ring-slate-200'}"
		>
			<p class="flex items-baseline gap-2 text-sm">
				<span class="font-medium">{reply.authorName}</span>
				<span class="text-xs text-slate-500">
					{reply.role === 'agent' ? 'Support' : 'Customer'} · {formatWhen(reply.sentAt)}
				</span>
			</p>
			<div class="mt-2 leading-relaxed whitespace-pre-line text-slate-700">{reply.body}</div>
		</article>
	{/each}
</section>

<form method="POST" action="?/reply" class="mt-8 rounded-lg bg-white p-5 ring-1 ring-slate-200">
	<h2 class="font-medium">Add a reply</h2>

	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		<label class="text-sm">
			<span class="text-slate-600">Name</span>
			<input
				name="author_name"
				value={form?.authorName ?? ''}
				required
				maxlength="80"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>

		<fieldset class="text-sm">
			<legend class="text-slate-600">Replying as</legend>
			<div class="mt-2 flex gap-4">
				<label class="flex items-center gap-2">
					<input type="radio" name="role" value="agent" checked />
					Support
				</label>
				<label class="flex items-center gap-2">
					<input type="radio" name="role" value="requester" />
					Customer
				</label>
			</div>
		</fieldset>
	</div>

	<label class="mt-3 block text-sm">
		<span class="text-slate-600">Message</span>
		<textarea
			name="body"
			rows="5"
			required
			maxlength="4000"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			>{form?.body ?? ''}</textarea
		>
	</label>

	{#if form?.replyError}
		<p class="mt-2 text-sm text-rose-600">{form.replyError}</p>
	{/if}
	{#if form?.replied}
		<p class="mt-2 text-sm text-emerald-700">Reply added to the thread.</p>
	{/if}

	<button
		class="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
	>
		Send reply
	</button>
</form>
