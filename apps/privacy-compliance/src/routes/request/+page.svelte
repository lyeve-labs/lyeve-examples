<script lang="ts">
	import { REQUEST_TYPES, TYPE_LABELS } from '$lib/desk';

	let { data, form } = $props();
</script>

<svelte:head><title>Make a privacy request</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Make a privacy request</h1>
<p class="mt-2 max-w-2xl text-slate-600">
	Ask for a copy of what is held about you, ask for it to be corrected, or ask for it to be deleted.
	We answer within {data.responseDays} days.
</p>

<p class="mt-4 max-w-2xl rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
	This form records your request. Nothing is exported and nothing is deleted when you press send: a
	person reads it, confirms you are who you say you are, and then acts. That order is deliberate. An
	unauthenticated form wired straight to a deletion route would let anybody delete anybody.
</p>

{#if form?.message}
	<p class="mt-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
		{form.message}
	</p>
{/if}

<form method="POST" class="mt-8 max-w-2xl space-y-5">
	<label class="block text-sm">
		<span class="font-medium">Your name</span>
		<input
			name="subject_name"
			value={form?.subjectName ?? ''}
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
	</label>

	<label class="block text-sm">
		<span class="font-medium">Email address</span>
		<input
			name="subject_email"
			type="email"
			value={form?.subjectEmail ?? ''}
			placeholder="the address we hold for you"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
	</label>

	<label class="block text-sm">
		<span class="font-medium">Account id</span>
		<input
			name="subject_account_id"
			value={form?.subjectAccountId ?? ''}
			placeholder="optional, a UUID if you have one"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
		<span class="mt-1 block text-slate-500">
			An account id names one account and nothing else. An address is only unique among accounts,
			so a request that gives one is easier to answer completely.
		</span>
	</label>

	<fieldset class="text-sm">
		<legend class="font-medium">What are you asking for?</legend>
		<div class="mt-2 space-y-2">
			{#each REQUEST_TYPES as type (type)}
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="request_type"
						value={type}
						checked={(form?.type ?? 'access') === type}
					/>
					<span>{TYPE_LABELS[type]}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<label class="block text-sm">
		<span class="font-medium">Details</span>
		<textarea
			name="details"
			rows="5"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			placeholder="Anything that helps us find your records.">{form?.details ?? ''}</textarea
		>
	</label>

	<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
		Send request
	</button>
</form>
