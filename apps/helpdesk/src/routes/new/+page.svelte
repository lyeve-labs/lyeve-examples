<script lang="ts">
	import { PRIORITY_LABEL, TICKET_PRIORITIES } from '$lib/desk';

	let { form } = $props();
</script>

<svelte:head><title>Open a ticket</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Open a ticket</h1>
<p class="mt-2 text-slate-600">
	Tell us what happened and we will pick it up. You will get a link to the thread.
</p>

<form method="POST" class="mt-8 rounded-lg bg-white p-6 ring-1 ring-slate-200">
	<div class="grid gap-4 sm:grid-cols-2">
		<label class="text-sm">
			<span class="text-slate-600">Your name</span>
			<input
				name="requester_name"
				value={form?.requesterName ?? ''}
				required
				maxlength="80"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>

		<label class="text-sm">
			<span class="text-slate-600">Email</span>
			<input
				name="requester_email"
				type="email"
				value={form?.requesterEmail ?? ''}
				required
				maxlength="120"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>
	</div>

	<label class="mt-4 block text-sm">
		<span class="text-slate-600">Subject</span>
		<input
			name="subject"
			value={form?.subject ?? ''}
			required
			maxlength="120"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
	</label>

	<label class="mt-4 block text-sm sm:w-56">
		<span class="text-slate-600">Priority</span>
		<select
			name="priority"
			class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
		>
			{#each TICKET_PRIORITIES as priority (priority)}
				<option value={priority} selected={(form?.priority ?? 'normal') === priority}>
					{PRIORITY_LABEL[priority]}
				</option>
			{/each}
		</select>
	</label>

	<label class="mt-4 block text-sm">
		<span class="text-slate-600">What happened</span>
		<textarea
			name="body"
			rows="7"
			required
			maxlength="4000"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			>{form?.body ?? ''}</textarea
		>
	</label>

	{#if form?.message}
		<p class="mt-3 text-sm text-rose-600">{form.message}</p>
	{/if}

	<button
		class="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
	>
		Submit ticket
	</button>
</form>
