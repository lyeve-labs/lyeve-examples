<script lang="ts">
	import { formatWhen } from '$lib/forum';

	let { data } = $props();
</script>

<svelte:head><title>Lanternfish Community</title></svelte:head>

<div class="flex items-baseline justify-between">
	<h1 class="text-2xl font-semibold tracking-tight">Topics</h1>
	<a href="/new" class="text-sm font-medium text-slate-600 hover:text-slate-900">Start a topic</a>
</div>

{#if data.total === 0}
	<p class="mt-6 text-slate-500">
		No topics yet. Run <code class="rounded bg-slate-200 px-1.5 py-0.5">pnpm run setup</code> to create
		the content type and seed a board with a few threads.
	</p>
{:else}
	{#each data.groups as group (group.slug)}
		<section class="mt-10 first:mt-8">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.label}</h2>
			<p class="mt-1 text-sm text-slate-500">{group.blurb}</p>

			<ul class="mt-4 divide-y divide-slate-200 rounded-lg bg-white ring-1 ring-slate-200">
				{#each group.topics as topic (topic.slug)}
					<li class="flex items-start gap-4 px-5 py-4">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								{#if topic.pinned}
									<span
										class="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20"
									>
										Pinned
									</span>
								{/if}
								{#if topic.locked}
									<span
										class="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-500/20"
									>
										Closed
									</span>
								{/if}
								<a
									href="/topics/{topic.slug}"
									class="truncate font-medium hover:underline"
									title={topic.title}
								>
									{topic.title}
								</a>
							</div>
							{#if topic.excerpt}
								<p class="mt-1 line-clamp-2 text-sm text-slate-600">{topic.excerpt}</p>
							{/if}
							<p class="mt-2 text-xs text-slate-400">
								{topic.authorName} started this {formatWhen(topic.startedAt)}
								{#if topic.lastPostedAt}
									&middot; last reply {formatWhen(topic.lastPostedAt)}
								{/if}
							</p>
						</div>

						<div class="shrink-0 text-right text-sm">
							<p class="font-medium text-slate-700">
								{topic.replies}
								{topic.replies === 1 ? 'reply' : 'replies'}
							</p>
							{#if topic.pending > 0}
								<p class="mt-1 text-xs text-amber-700">{topic.pending} awaiting review</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}
