<script lang="ts">
	import { formatMinutes } from '$lib/format';

	let { data } = $props();

	const lesson = $derived(data.lesson);
</script>

<svelte:head><title>{lesson.title}</title></svelte:head>

<a href="/courses/{data.course.slug}" class="flex items-center gap-3 text-sm text-slate-500">
	{#if data.course.coverId}
		<img
			src="/media/{data.course.coverId}"
			alt=""
			width="960"
			height="540"
			class="h-8 w-14 rounded object-cover"
		/>
	{/if}
	<span class="hover:underline">{data.course.title}</span>
</a>

<article class="mt-8 max-w-2xl">
	<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
		{lesson.moduleTitle} · Lesson {data.position.index} of {data.position.total}
	</p>
	<h1 class="mt-2 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
	<p class="mt-3 text-sm text-slate-400">{formatMinutes(lesson.durationMinutes)}</p>

	<div class="mt-8 space-y-4 leading-relaxed text-slate-700">
		{#each lesson.body.split('\n\n') as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>
</article>

<nav class="mt-12 flex gap-4 border-t border-slate-200 pt-6">
	<div class="flex-1">
		{#if data.previous}
			<a href="/courses/{data.course.slug}/{data.previous.slug}" class="group block">
				<span class="text-xs uppercase tracking-wide text-slate-400">Previous</span>
				<span class="mt-1 block font-medium group-hover:underline">{data.previous.title}</span>
			</a>
		{/if}
	</div>
	<div class="flex-1 text-right">
		{#if data.next}
			<a href="/courses/{data.course.slug}/{data.next.slug}" class="group block">
				<span class="text-xs uppercase tracking-wide text-slate-400">Next</span>
				<span class="mt-1 block font-medium group-hover:underline">{data.next.title}</span>
			</a>
		{/if}
	</div>
</nav>
