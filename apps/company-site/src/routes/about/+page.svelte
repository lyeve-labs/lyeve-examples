<script lang="ts">
	import PageMeta from '$lib/components/PageMeta.svelte';
	import { paragraphs } from '$lib/site';

	let { data } = $props();
	const about = $derived(data.about);
</script>

<PageMeta title={about.title} description={about.summary} imageId={about.heroId} />

<article class="max-w-3xl">
	<h1 class="text-3xl font-semibold tracking-tight">{about.title}</h1>
	{#if about.summary}
		<p class="mt-4 text-lg text-slate-600">{about.summary}</p>
	{/if}

	{#if about.heroId}
		<img
			src="/media/{about.heroId}"
			alt=""
			class="mt-8 w-full rounded-lg border border-slate-200 object-cover"
		/>
	{/if}

	<div class="mt-8 space-y-4 leading-relaxed text-slate-700">
		{#each paragraphs(about.body) as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>
</article>

<section class="mt-16 border-t border-slate-200 pt-10">
	<h2 class="text-xl font-semibold tracking-tight">The team</h2>
	<p class="mt-2 text-slate-600">
		Ordered by the sort field on each record, because the engine always returns rows newest first
		and takes no sort parameter.
	</p>

	<ul class="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.team as member (member.id)}
			<li>
				{#if member.photoId}
					<img
						src="/media/{member.photoId}"
						alt=""
						class="mb-4 h-32 w-32 rounded-full object-cover"
					/>
				{/if}
				<p class="font-medium">{member.name}</p>
				<p class="text-sm text-slate-500">{member.role}</p>
				{#if member.location}
					<p class="text-sm text-slate-400">{member.location}</p>
				{/if}
				{#if member.bio}
					<p class="mt-3 text-sm leading-relaxed text-slate-600">{member.bio}</p>
				{/if}
			</li>
		{/each}
	</ul>
</section>
