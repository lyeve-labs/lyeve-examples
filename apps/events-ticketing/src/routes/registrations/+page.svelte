<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Door list</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Door list</h1>
<p class="mt-2 text-slate-600">
	Every registration, newest first, with the event each one points at. The event title comes from
	the same request as the registration: a populated relation arrives inflated instead of as an id.
</p>

{#if data.registrations.length === 0}
	<p class="mt-8 text-slate-500">No registrations yet.</p>
{:else}
	<ul class="mt-8 divide-y divide-slate-200">
		{#each data.registrations as row (row.id)}
			<li class="flex items-baseline justify-between gap-4 py-3">
				<div class="min-w-0">
					<p class="font-medium text-slate-900">{row.name}</p>
					{#if row.eventTitle && row.eventSlug}
						<a href="/events/{row.eventSlug}" class="text-sm text-slate-500 hover:underline">
							{row.eventTitle}
						</a>
					{:else}
						<p class="text-sm text-slate-400">Event no longer listed</p>
					{/if}
				</div>
				<time class="shrink-0 text-sm text-slate-400" datetime={row.registeredAt}>
					{row.registeredLabel}
				</time>
			</li>
		{/each}
	</ul>
{/if}
