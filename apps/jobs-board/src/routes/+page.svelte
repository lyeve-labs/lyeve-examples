<script lang="ts">
	import { EMPLOYMENT_TYPES } from '$lib/jobs';

	let { data } = $props();
	const count = $derived(data.jobs.length);
</script>

<svelte:head><title>Harbourside Jobs</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Open roles</h1>
<p class="mt-2 text-slate-600">
	Every role below is stored in LyEve and read by this server. The browser never sees the engine.
</p>

<form method="GET" class="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
	<input
		type="search"
		name="q"
		value={data.query}
		placeholder="Search titles and descriptions"
		class="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
	/>

	<select
		name="type"
		class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
	>
		<option value="" selected={data.type === ''}>Any contract</option>
		{#each EMPLOYMENT_TYPES as option (option.value)}
			<option value={option.value} selected={data.type === option.value}>{option.label}</option>
		{/each}
	</select>

	<select
		name="sort"
		class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
	>
		<option value="newest" selected={data.sort === 'newest'}>Newest first</option>
		<option value="salary" selected={data.sort === 'salary'}>Highest paid</option>
	</select>

	<button class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
		Filter
	</button>
</form>

<p class="mt-6 text-sm text-slate-500">
	{count}
	{count === 1 ? 'role' : 'roles'}{data.query ? ` matching "${data.query}"` : ''}
</p>

{#if count === 0}
	<p class="mt-6 rounded-lg bg-slate-50 p-5 text-slate-600">
		{#if data.query}
			Nothing matched. Search only sees content written through the admin route, so a listing
			added straight to the public API would be missing here.
		{:else}
			No listings yet. Run <code class="rounded bg-slate-200 px-1.5 py-0.5">pnpm run setup</code> to
			create the content types and seed the board.
		{/if}
	</p>
{:else}
	<ul class="mt-2 divide-y divide-slate-200">
		{#each data.jobs as job (job.id)}
			<li class="py-6">
				<article>
					<h2 class="text-lg font-semibold tracking-tight">
						<a href="/jobs/{job.slug}" class="hover:underline">{job.title}</a>
					</h2>
					<p class="mt-1 text-sm text-slate-500">{job.company} · {job.location}</p>
					{#if job.summary}
						<p class="mt-3 text-slate-600">{job.summary}</p>
					{/if}
					<p class="mt-3 flex flex-wrap gap-2 text-xs">
						<span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
							{job.employmentLabel}
						</span>
						<span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
							{job.salary}
						</span>
					</p>
				</article>
			</li>
		{/each}
	</ul>
{/if}
