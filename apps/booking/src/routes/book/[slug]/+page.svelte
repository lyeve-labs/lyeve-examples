<script lang="ts">
	let { data, form } = $props();
	const slot = $derived(data.slot);
	const person = $derived(data.practitioner);
</script>

<svelte:head><title>Confirm your appointment</title></svelte:head>

{#if person}
	<a href="/practitioners/{person.slug}" class="text-sm text-slate-500 hover:underline">
		&larr; {person.title}
	</a>
{:else}
	<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All practitioners</a>
{/if}

<h1 class="mt-6 text-2xl font-semibold tracking-tight">Confirm your appointment</h1>

<div class="mt-5 rounded-lg border border-slate-200 bg-white p-5">
	<p class="font-medium">{slot.day}</p>
	<p class="mt-1 text-slate-600">
		{slot.start} to {slot.end} UTC, {slot.durationMinutes} minutes
		{#if person}with {person.title}, {person.role}{/if}
	</p>
</div>

{#if !slot.bookable}
	<p class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
		{slot.state === 'held'
			? 'This time is being held for another inquiry.'
			: 'This time has already been taken.'}
		{#if person}
			<a href="/practitioners/{person.slug}" class="font-medium underline">See what else is free</a>.
		{/if}
	</p>
{:else}
	{#if form?.message}
		<p class="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
			{form.message}
		</p>
	{/if}

	<form method="POST" class="mt-6 space-y-5 rounded-lg border border-slate-200 bg-white p-5">
		<div>
			<label for="customer_name" class="block text-sm font-medium">Name</label>
			<input
				id="customer_name"
				name="customer_name"
				value={form?.values?.name ?? ''}
				autocomplete="name"
				required
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</div>

		<div>
			<label for="customer_email" class="block text-sm font-medium">Email</label>
			<input
				id="customer_email"
				name="customer_email"
				type="email"
				value={form?.values?.email ?? ''}
				autocomplete="email"
				required
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
			<p class="mt-1 text-xs text-slate-500">Your confirmation reference is shown on the next page.</p>
		</div>

		<div>
			<label for="notes" class="block text-sm font-medium">
				What would you like to cover?
				<span class="font-normal text-slate-400">Optional</span>
			</label>
			<textarea
				id="notes"
				name="notes"
				rows="4"
				maxlength="1000"
				value={form?.values?.notes ?? ''}
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			></textarea>
		</div>

		<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
			Book this time
		</button>
	</form>
{/if}
