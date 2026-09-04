<script lang="ts">
	let { data, form } = $props();

	const reconciled = $derived(form?.reconciled ?? null);

	const filters = $derived([
		{ label: `All (${data.total})`, href: '/desk', active: data.status === null },
		...data.counts.map((c) => ({
			label: `${c.status} (${c.count})`,
			href: `/desk?status=${c.status}`,
			active: data.status === c.status
		}))
	]);

	function badge(status: string): string {
		if (status === 'published') return 'bg-emerald-100 text-emerald-900';
		if (status === 'archived') return 'bg-slate-200 text-slate-700';
		if (status === 'missing') return 'bg-red-100 text-red-900';
		return 'bg-amber-100 text-amber-900';
	}
</script>

<svelte:head><title>The desk</title></svelte:head>

<div class="flex items-baseline justify-between">
	<h1 class="font-serif text-2xl font-bold tracking-tight">The desk</h1>
	<p class="text-sm text-slate-500">
		<code class="text-xs">GET /api/admin/content?schema=news_stories</code>
	</p>
</div>

<nav class="mt-5 flex flex-wrap gap-2 text-sm">
	{#each filters as filter (filter.href)}
		<a
			href={filter.href}
			class="rounded-full border px-3 py-1 capitalize {filter.active
				? 'border-slate-900 bg-slate-900 text-white'
				: 'border-slate-300 text-slate-600 hover:border-slate-500'}"
		>
			{filter.label}
		</a>
	{/each}
</nav>

{#if data.drift.length > 0}
	<section class="mt-6 rounded border border-amber-300 bg-amber-50 p-5">
		<h2 class="font-medium text-amber-900">
			{data.drift.length}
			{data.drift.length === 1 ? 'story disagrees' : 'stories disagree'} with themselves
		</h2>
		<p class="mt-2 text-sm text-amber-900">
			A story's status is two columns in two tables. The desk status lives in
			<code class="text-xs">sys_content_entries.status</code>; the status the public read routes
			filter on lives in <code class="text-xs">_news_stories._status</code>. The admin write mirrors
			the title, the slug and the body into the public table and never touches
			<code class="text-xs">_status</code>, so a new draft arrives there at its column default,
			which is <code class="text-xs">published</code>.
		</p>
		<ul class="mt-3 space-y-1 text-sm text-amber-900">
			{#each data.drift as item (item.id)}
				<li>
					<a href="/desk/{item.id}" class="font-medium underline">{item.title}</a>:
					desk says {item.deskStatus}, public table says {item.publicStatus}, should be
					{item.shouldBe}
				</li>
			{/each}
		</ul>
		<form method="POST" action="?/reconcile" class="mt-4">
			<button class="rounded bg-amber-900 px-3 py-1.5 text-sm font-medium text-white">
				Align the public status
			</button>
		</form>
	</section>
{/if}

{#if reconciled !== null}
	<p class="mt-4 rounded bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
		Aligned {reconciled}
		{reconciled === 1 ? 'story' : 'stories'}.
	</p>
{/if}
{#if form?.error}
	<p class="mt-4 rounded bg-red-50 px-4 py-2 text-sm text-red-900">{form.error}</p>
{/if}

<div class="mt-6 overflow-x-auto">
	<table class="w-full min-w-[52rem] text-left text-sm">
		<thead class="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
			<tr>
				<th class="py-2 pr-4 font-medium">Story</th>
				<th class="py-2 pr-4 font-medium">Desk</th>
				<th class="py-2 pr-4 font-medium">Public</th>
				<th class="py-2 pr-4 font-medium">Review</th>
				<th class="py-2 pr-4 font-medium">Rev</th>
				<th class="py-2 font-medium">Updated</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-200">
			{#each data.rows as story (story.id)}
				<tr class:bg-amber-50={!story.aligned}>
					<td class="py-3 pr-4">
						<a href="/desk/{story.id}" class="font-medium hover:underline">{story.title}</a>
						{#if story.standfirst}
							<p class="mt-0.5 max-w-md text-xs text-slate-500">{story.standfirst}</p>
						{/if}
						{#if story.embargo}
							<p class="mt-0.5 text-xs text-slate-500">
								Embargoed until {new Date(story.embargo).toLocaleString()}
							</p>
						{/if}
					</td>
					<td class="py-3 pr-4">
						<span class="rounded px-2 py-0.5 text-xs capitalize {badge(story.deskStatus)}">
							{story.deskStatus}
						</span>
					</td>
					<td class="py-3 pr-4">
						<span class="rounded px-2 py-0.5 text-xs capitalize {badge(story.publicStatus)}">
							{story.publicStatus}
						</span>
					</td>
					<td class="py-3 pr-4 text-slate-600">
						{#if story.review}
							{story.review.status.replace('_', ' ')}
						{:else}
							<span class="text-slate-400">not submitted</span>
						{/if}
					</td>
					<td class="py-3 pr-4 text-slate-500">{story.revision}</td>
					<td class="py-3 text-slate-500">{new Date(story.updatedAt).toLocaleDateString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if data.rows.length === 0}
	<p class="mt-6 text-slate-500">Nothing with that status.</p>
{/if}
