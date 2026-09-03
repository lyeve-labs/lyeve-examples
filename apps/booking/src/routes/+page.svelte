<script lang="ts">
	import { initials } from '$lib/schedule';

	let { data } = $props();
</script>

<svelte:head><title>Book a consultation</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Book a consultation</h1>
<p class="mt-2 max-w-2xl text-slate-600">
	Pick a practitioner to see the hours they have left this week. Times are shown in UTC.
</p>

{#if data.practitioners.length === 0}
	<p class="mt-8 text-slate-500">
		No practitioners yet. Run <code class="rounded bg-slate-200 px-1.5 py-0.5">pnpm run setup</code> to
		create the content types and seed a schedule.
	</p>
{:else}
	<ul class="mt-8 grid gap-4 sm:grid-cols-2">
		{#each data.practitioners as person (person.id)}
			<li class="rounded-lg border border-slate-200 bg-white p-5">
				<a href="/practitioners/{person.slug}" class="flex items-start gap-4">
					{#if person.photoId}
						<img
							src="/media/{person.photoId}"
							alt=""
							class="h-12 w-12 shrink-0 rounded-full object-cover"
						/>
					{:else}
						<span
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-500"
						>
							{initials(person.title)}
						</span>
					{/if}
					<div class="min-w-0">
						<h2 class="font-semibold tracking-tight hover:underline">{person.title}</h2>
						<p class="text-sm text-slate-500">{person.role}</p>
					</div>
				</a>

				<p class="mt-4 line-clamp-3 text-sm text-slate-600">{person.bio}</p>

				<p class="mt-4 text-sm">
					{#if person.openCount > 0}
						<span class="font-medium text-emerald-700">
							{person.openCount}
							{person.openCount === 1 ? 'hour' : 'hours'} free
						</span>
						<span class="text-slate-500"> from {person.nextFree}</span>
					{:else}
						<span class="text-slate-500">Fully booked for now</span>
					{/if}
				</p>
			</li>
		{/each}
	</ul>
{/if}
