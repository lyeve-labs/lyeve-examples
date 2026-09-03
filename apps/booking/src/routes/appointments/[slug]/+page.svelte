<script lang="ts">
	let { data } = $props();
	const appointment = $derived(data.appointment);
	const person = $derived(data.practitioner);
</script>

<svelte:head><title>Appointment {appointment.reference}</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">You are booked in</h1>
<p class="mt-2 text-slate-600">
	We sent nothing anywhere. This example stores the appointment and shows it back to you.
</p>

<div class="mt-6 rounded-lg border border-slate-200 bg-white p-6">
	<p class="text-xs font-medium uppercase tracking-wide text-slate-400">Reference</p>
	<p class="font-mono text-lg">{appointment.reference}</p>

	<dl class="mt-6 grid gap-4 sm:grid-cols-2">
		<div>
			<dt class="text-xs font-medium uppercase tracking-wide text-slate-400">When</dt>
			<dd class="mt-1">
				{#if appointment.day}
					{appointment.day}<br />
					<span class="text-slate-600">
						{appointment.start} to {appointment.end} UTC, {appointment.durationMinutes} minutes
					</span>
				{:else}
					<span class="text-slate-500">The time this was booked against is gone.</span>
				{/if}
			</dd>
		</div>

		<div>
			<dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Who with</dt>
			<dd class="mt-1">
				{#if person}
					{person.title}<br />
					<span class="text-slate-600">{person.role}</span>
				{:else}
					<span class="text-slate-500">Unassigned</span>
				{/if}
			</dd>
		</div>

		<div>
			<dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Name</dt>
			<dd class="mt-1">{appointment.customerName}</dd>
		</div>

		<div>
			<dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Email</dt>
			<dd class="mt-1">{appointment.customerEmail}</dd>
		</div>
	</dl>

	{#if appointment.notes}
		<div class="mt-6 border-t border-slate-100 pt-4">
			<p class="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
			<p class="mt-1 whitespace-pre-line text-slate-700">{appointment.notes}</p>
		</div>
	{/if}
</div>

{#if appointment.state && appointment.state !== 'booked'}
	<p class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
		The slot behind this appointment reads
		<strong>{appointment.state}</strong>, not booked. Something wrote it after the booking went
		through, which is a state only an operator can resolve.
	</p>
{/if}

<p class="mt-8">
	{#if person}
		<a href="/practitioners/{person.slug}" class="text-sm text-slate-500 hover:underline">
			&larr; Back to the diary
		</a>
	{:else}
		<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All practitioners</a>
	{/if}
</p>
