<script lang="ts">
	import { initials } from '$lib/schedule';

	let { data } = $props();
	const person = $derived(data.practitioner);
	const openTotal = $derived(
		data.days.reduce((sum, day) => sum + day.slots.filter((slot) => slot.bookable).length, 0)
	);
</script>

<svelte:head><title>{person.title}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All practitioners</a>

<div class="mt-6 flex items-start gap-5">
	{#if person.photoId}
		<img src="/media/{person.photoId}" alt="" class="h-16 w-16 rounded-full object-cover" />
	{:else}
		<span
			class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-200 font-medium text-slate-500"
		>
			{initials(person.title)}
		</span>
	{/if}
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{person.title}</h1>
		<p class="text-slate-500">{person.role}</p>
	</div>
</div>

<p class="mt-5 max-w-2xl leading-relaxed text-slate-700">{person.bio}</p>

<h2 class="mt-10 text-lg font-semibold tracking-tight">
	Availability
	<span class="ml-2 text-sm font-normal text-slate-500">
		{openTotal}
		{openTotal === 1 ? 'hour' : 'hours'} free, times in UTC
	</span>
</h2>

{#if data.days.length === 0}
	<p class="mt-4 text-slate-500">Nothing on the diary yet.</p>
{:else}
	<div class="mt-4 space-y-6">
		{#each data.days as day (day.key)}
			<section class="rounded-lg border border-slate-200 bg-white p-5">
				<h3 class="text-sm font-medium uppercase tracking-wide text-slate-400">{day.label}</h3>
				<ul class="mt-3 flex flex-wrap gap-2">
					{#each day.slots as slot (slot.id)}
						<li>
							{#if slot.bookable}
								<a
									href="/book/{slot.slug}"
									class="block rounded-md border border-slate-300 px-3 py-2 text-sm hover:border-slate-900 hover:bg-slate-900 hover:text-white"
								>
									<span class="font-medium">{slot.start}</span>
									<span class="text-xs opacity-70"> to {slot.end}</span>
								</a>
							{:else}
								<span
									class="block rounded-md border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400 line-through"
									title={slot.state === 'held' ? 'Held for another inquiry' : 'Already taken'}
								>
									<span class="font-medium">{slot.start}</span>
									<span class="text-xs"> to {slot.end}</span>
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}
