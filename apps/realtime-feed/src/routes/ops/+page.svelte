<script lang="ts">
	import { SEVERITIES, SEVERITY_LABEL, STATES, STATE_LABEL } from '$lib/board';

	let { data, form } = $props();
</script>

<svelte:head><title>Operations</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Operations</h1>
<p class="mt-2 text-slate-400">
	Every write here goes to the admin router. Nothing on this page tells the status board anything:
	the engine publishes the change and each connected browser hears it through its own stream.
</p>

{#if form?.error}
	<p class="mt-6 rounded-md bg-rose-950 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-900">
		{form.error}
	</p>
{:else if form?.done}
	<p class="mt-6 rounded-md bg-emerald-950 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-900">
		{form.done}
	</p>
{/if}

<section class="mt-8 rounded-lg bg-slate-900 p-6 ring-1 ring-slate-800">
	<h2 class="font-medium">Open an incident</h2>

	<form method="POST" action="?/open" class="mt-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="text-sm">
				<span class="text-slate-400">Service</span>
				<select
					name="service_id"
					required
					class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-slate-400"
				>
					{#each data.services as service (service.id)}
						<option value={service.id}>{service.name}</option>
					{/each}
				</select>
			</label>

			<label class="text-sm">
				<span class="text-slate-400">Severity</span>
				<select
					name="severity"
					class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-slate-400"
				>
					{#each SEVERITIES as severity (severity)}
						<option value={severity} selected={severity === 'major'}>
							{SEVERITY_LABEL[severity]}
						</option>
					{/each}
				</select>
			</label>
		</div>

		<label class="mt-4 block text-sm">
			<span class="text-slate-400">Headline</span>
			<input
				name="title"
				value={form?.title ?? ''}
				required
				maxlength="120"
				placeholder="Checkout API returning 502s in eu-west"
				class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-slate-400"
			/>
		</label>

		<label class="mt-4 block text-sm">
			<span class="text-slate-400">First update</span>
			<textarea
				name="summary"
				rows="3"
				required
				maxlength="2000"
				placeholder="We are seeing elevated error rates on checkout and are investigating."
				class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-slate-400"
				>{form?.summary ?? ''}</textarea
			>
		</label>

		<button
			class="mt-5 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
		>
			Open incident
		</button>
	</form>
</section>

<h2 class="mt-12 text-lg font-semibold tracking-tight">Open incidents</h2>
{#if data.open.length === 0}
	<p class="mt-3 text-slate-400">Nothing open. Open one above and watch the status board move.</p>
{:else}
	<div class="mt-4 space-y-6">
		{#each data.open as incident (incident.id)}
			<section class="rounded-lg bg-slate-900 p-6 ring-1 ring-slate-800">
				<div class="flex items-baseline justify-between gap-4">
					<h3 class="font-medium">{incident.title}</h3>
					<span class="shrink-0 text-xs uppercase tracking-wide text-slate-400">
						{STATE_LABEL[incident.state]}
					</span>
				</div>

				<form method="POST" action="?/update" class="mt-4">
					<input type="hidden" name="slug" value={incident.slug} />
					<label class="block text-sm">
						<span class="text-slate-400">Update</span>
						<textarea
							name="summary"
							rows="2"
							required
							maxlength="2000"
							placeholder="Cause identified as a bad deploy. Rolling back now."
							class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-slate-400"
						></textarea>
					</label>

					<div class="mt-3 flex flex-wrap items-end gap-3">
						<label class="text-sm">
							<span class="text-slate-400">Move to</span>
							<select
								name="state"
								class="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-slate-400"
							>
								{#each STATES.filter((s) => s !== 'resolved') as state (state)}
									<option value={state} selected={state === incident.state}>
										{STATE_LABEL[state]}
									</option>
								{/each}
							</select>
						</label>
						<button
							class="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white"
						>
							Post update
						</button>
						<button
							formaction="?/resolve"
							class="rounded-md border border-emerald-800 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-950"
						>
							Resolve with this note
						</button>
					</div>
				</form>
			</section>
		{/each}
	</div>
{/if}
