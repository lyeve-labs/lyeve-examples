<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Northgate Sessions</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Upcoming sessions</h1>
<p class="mt-2 text-slate-600">
	Evening talks and weekend workshops for people who ship software. Registration is free and each
	room has a hard limit.
</p>

{#if data.events.length === 0}
	<p class="mt-8 text-slate-500">
		Nothing on the calendar. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">make setup</code>
		from the repo root to provision the content types and seed a season of events.
	</p>
{:else}
	<ul class="mt-8 divide-y divide-slate-200">
		{#each data.events as event (event.id)}
			{@const scarce = event.remaining <= 5}
			<li class="py-6 first:pt-0">
				<article class="flex gap-5">
					{#if event.coverId}
						<img
							src="/media/{event.coverId}"
							alt=""
							class="h-24 w-32 shrink-0 rounded object-cover"
						/>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
							<time datetime={event.startsAt}>{event.whenLabel}</time>
						</p>
						<h2 class="mt-1 text-xl font-semibold tracking-tight">
							<a href="/events/{event.slug}" class="hover:underline">{event.title}</a>
						</h2>
						<p class="mt-1 text-sm text-slate-500">{event.venue}</p>
						{#if event.summary}
							<p class="mt-2 text-slate-600">{event.summary}</p>
						{/if}
					</div>
					<div class="w-28 shrink-0 text-right">
						{#if event.soldOut}
							<span
								class="inline-block rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
							>
								Sold out
							</span>
						{:else}
							<span
								class="inline-block rounded-full px-3 py-1 text-xs font-medium {scarce
									? 'bg-amber-100 text-amber-900'
									: 'bg-emerald-100 text-emerald-900'}"
							>
								{event.places}
							</span>
						{/if}
						<p class="mt-2 text-xs text-slate-400">
							{event.registered} of {event.capacity} taken
						</p>
					</div>
				</article>
			</li>
		{/each}
	</ul>
{/if}
