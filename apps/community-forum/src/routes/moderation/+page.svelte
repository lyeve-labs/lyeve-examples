<script lang="ts">
	import { ACTION_LABEL, MODERATION_ACTIONS, formatWhen } from '$lib/forum';

	let { data, form } = $props();

	const button = 'rounded-md px-3 py-1.5 text-sm font-medium';
	const primary = `${button} bg-slate-900 text-white hover:bg-slate-700`;
	const secondary = `${button} border border-slate-300 text-slate-700 hover:border-slate-900`;
</script>

<svelte:head><title>Moderation queue</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Moderation queue</h1>
<p class="mt-2 text-slate-600">
	Every reply arrives pending. Approving one is what makes it readable. The other two decisions keep
	it out of the thread.
</p>

{#if form?.done}
	<p class="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{form.done}</p>
{/if}
{#if form?.message}
	<p class="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{form.message}</p>
{/if}

{#if data.queue.length === 0}
	<p class="mt-8 rounded-lg bg-white p-6 text-slate-500 ring-1 ring-slate-200">
		Nothing waiting. Post a reply on any topic and it will appear here.
	</p>
{:else}
	<ul class="mt-8 space-y-4">
		{#each data.queue as item (item.id)}
			<li class="rounded-lg bg-white p-5 ring-1 ring-slate-200">
				<div class="flex items-baseline justify-between gap-4">
					<p class="text-sm">
						<span class="font-medium text-slate-900">{item.authorName}</span>
						{#if item.authorEmail}
							<span class="text-slate-400">&lt;{item.authorEmail}&gt;</span>
						{/if}
						<span class="text-slate-400">
							{item.isReply ? 'replied in' : 'posted in'}
						</span>
						{#if item.topicSlug}
							<a href="/topics/{item.topicSlug}" class="font-medium hover:underline">
								{item.topicTitle}
							</a>
						{:else}
							<span class="text-slate-500">{item.topicTitle}</span>
						{/if}
					</p>
					<p class="shrink-0 text-xs text-slate-400">{formatWhen(item.postedAt)}</p>
				</div>

				<p class="mt-3 whitespace-pre-wrap text-slate-700">{item.body}</p>

				<form method="POST" class="mt-4 flex flex-wrap items-center gap-2">
					<input type="hidden" name="comment_id" value={item.id} />
					{#each MODERATION_ACTIONS as action (action)}
						<button
							name="action"
							value={action}
							class={action === 'approve' ? primary : secondary}
						>
							{ACTION_LABEL[action]}
						</button>
					{/each}
				</form>
			</li>
		{/each}
	</ul>
{/if}

