<script lang="ts">
	import { formatMinutes } from '$lib/format';

	let { data, form } = $props();

	const course = $derived(data.course);
	const lessonCount = $derived(
		data.modules.reduce((total, module) => total + module.lessons.length, 0)
	);
</script>

<svelte:head><title>{course.title}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; Catalog</a>

<article class="mt-6">
	{#if course.coverId}
		<img
			src="/media/{course.coverId}"
			alt=""
			width="960"
			height="540"
			class="aspect-video w-full rounded-lg object-cover"
		/>
	{/if}

	<p class="mt-6 text-xs font-medium uppercase tracking-wide text-slate-400">{course.level}</p>
	<h1 class="mt-2 text-3xl font-semibold tracking-tight">{course.title}</h1>
	<p class="mt-3 max-w-2xl text-lg leading-relaxed text-slate-600">{course.summary}</p>
	<p class="mt-4 text-sm text-slate-400">
		{data.modules.length} modules · {lessonCount} lessons · {formatMinutes(data.minutes)} · {data.enrolled}
		enrolled
	</p>

	<div class="mt-8 max-w-2xl space-y-4 leading-relaxed text-slate-700">
		{#each course.body.split('\n\n') as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>
</article>

<section class="mt-12">
	<h2 class="text-xl font-semibold tracking-tight">Curriculum</h2>
	<ol class="mt-5 space-y-6">
		{#each data.modules as module, moduleIndex (module.id)}
			<li class="rounded-lg border border-slate-200">
				<div class="border-b border-slate-200 px-5 py-3">
					<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
						Module {moduleIndex + 1}
					</p>
					<h3 class="mt-0.5 font-semibold">{module.title}</h3>
				</div>
				<ul class="divide-y divide-slate-100">
					{#each module.lessons as lesson (lesson.id)}
						<li>
							<a
								href="/courses/{course.slug}/{lesson.slug}"
								class="flex items-baseline justify-between gap-4 px-5 py-3 hover:bg-slate-50"
							>
								<span class="text-slate-800">{lesson.title}</span>
								<span class="shrink-0 text-sm text-slate-400">
									{formatMinutes(lesson.durationMinutes)}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ol>
</section>

<section class="mt-12 max-w-xl rounded-lg bg-slate-50 p-6">
	<h2 class="text-lg font-semibold tracking-tight">Enroll a student</h2>

	{#if form?.enrolled}
		<p class="mt-3 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
			{form.name} is enrolled on {course.title}.
		</p>
	{:else}
		<p class="mt-2 text-sm text-slate-600">
			The form posts to a server action, which writes an enrollment through the admin route and
			links it to this course.
		</p>
	{/if}

	{#if form?.message}
		<p class="mt-3 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">{form.message}</p>
	{/if}

	<form method="POST" action="?/enroll" class="mt-4 space-y-3">
		<label class="block">
			<span class="text-sm font-medium text-slate-700">Student name</span>
			<input
				name="student_name"
				value={form?.name ?? ''}
				autocomplete="name"
				class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>
		<label class="block">
			<span class="text-sm font-medium text-slate-700">Email</span>
			<input
				name="student_email"
				type="email"
				value={form?.email ?? ''}
				autocomplete="email"
				class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>
		<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
			Enroll
		</button>
	</form>
</section>
