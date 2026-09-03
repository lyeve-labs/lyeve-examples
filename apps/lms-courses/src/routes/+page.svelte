<script lang="ts">
	import { formatMinutes } from '$lib/format';

	let { data } = $props();

	const totals = $derived({
		modules: data.courses.reduce((n, course) => n + course.moduleCount, 0),
		lessons: data.courses.reduce((n, course) => n + course.lessonCount, 0)
	});
</script>

<svelte:head><title>Meridian Learning</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Course catalog</h1>
<p class="mt-2 max-w-2xl text-slate-600">
	{data.courses.length} courses, {totals.modules} modules and {totals.lessons} lessons, stored as
	three related content types.
</p>

{#if data.courses.length === 0}
	<p class="mt-8 text-slate-500">
		Nothing published yet. Run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> to
		provision the content types and seed the catalog.
	</p>
{:else}
	<ul class="mt-8 grid gap-6 sm:grid-cols-2">
		{#each data.courses as course (course.id)}
			<li class="overflow-hidden rounded-lg border border-slate-200">
				<a href="/courses/{course.slug}" class="block">
					{#if course.coverId}
						<img
							src="/media/{course.coverId}"
							alt=""
							width="960"
							height="540"
							class="aspect-video w-full object-cover"
						/>
					{/if}
					<div class="p-5">
						<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
							{course.level}
						</p>
						<h2 class="mt-1 text-lg font-semibold tracking-tight">{course.title}</h2>
						<p class="mt-2 text-sm leading-relaxed text-slate-600">{course.summary}</p>
						<p class="mt-4 text-sm text-slate-400">
							{course.moduleCount} modules · {course.lessonCount} lessons · {formatMinutes(
								course.minutes
							)}
						</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
