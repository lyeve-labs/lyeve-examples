<script lang="ts">
	import { CATEGORY_LABEL, formatWhen, indentFor, paragraphs } from '$lib/forum';

	let { data, form } = $props();
	const topic = $derived(data.topic);
</script>

<svelte:head><title>{topic.title}</title></svelte:head>

<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All topics</a>

<article class="mt-6 rounded-lg bg-white p-6 ring-1 ring-slate-200">
	<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
		{CATEGORY_LABEL[topic.category] ?? topic.category}
	</p>
	<h1 class="mt-2 text-2xl font-semibold tracking-tight">{topic.title}</h1>
	<p class="mt-2 text-sm text-slate-400">
		{topic.authorName} &middot; {formatWhen(topic.startedAt)}
	</p>

	<div class="mt-5 space-y-4 leading-relaxed text-slate-700">
		{#each topic.body.split('\n\n') as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>
</article>

<h2 class="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">
	{data.replyCount}
	{data.replyCount === 1 ? 'reply' : 'replies'}
	{#if data.awaiting > 0}
		<span class="font-normal normal-case tracking-normal text-amber-700">
			&middot; {data.awaiting} waiting for a moderator
		</span>
	{/if}
</h2>

{#if form?.voteMessage}
	<p class="mt-3 text-sm text-rose-600">{form.voteMessage}</p>
{/if}

<ul class="mt-4 space-y-3">
	{#each data.thread as row (row.comment.id)}
		<li class={indentFor(row.depth)}>
			<div class="rounded-lg bg-white p-4 ring-1 ring-slate-200">
				<div class="flex items-baseline justify-between gap-4">
					<p class="text-sm font-medium text-slate-900">{row.comment.authorName}</p>
					<p class="shrink-0 text-xs text-slate-400">{formatWhen(row.comment.postedAt)}</p>
				</div>

				{#if row.detached}
					<p class="mt-1 text-xs text-slate-400">
						Replying to a comment that is not visible in this thread.
					</p>
				{/if}

				<!--
					The body is rendered as text, split into paragraphs on blank
					lines. The content engine strips dangerous markup from a
					string it stores, but nothing renders markdown any more, and
					this page does not need to trust a commenter's markup.
				-->
				<div class="prose-forum mt-2 text-slate-700">
					{#each paragraphs(row.comment.body) as paragraph, i (i)}
						<p class="whitespace-pre-wrap">{paragraph}</p>
					{/each}
				</div>

				<div class="mt-3 text-xs">
					<form method="POST" action="?/vote" class="flex items-center gap-2">
						<input type="hidden" name="comment_id" value={row.comment.id} />
						<button
							name="direction"
							value="1"
							class="rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-600 hover:border-slate-900 hover:text-slate-900"
							aria-label="Useful"
						>
							&plus;
						</button>
						<span class="tabular-nums text-slate-500">{row.comment.score}</span>
						<button
							name="direction"
							value="-1"
							class="rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-600 hover:border-slate-900 hover:text-slate-900"
							aria-label="Not useful"
						>
							&minus;
						</button>
					</form>

					{#if !topic.locked}
						<details class="mt-2">
							<summary class="cursor-pointer text-slate-500 hover:text-slate-900">Reply</summary>
							<form method="POST" action="?/reply" class="mt-3 w-full max-w-xl space-y-2">
								<input type="hidden" name="parent_id" value={row.comment.id} />
								<div class="flex gap-2">
									<input
										name="author_name"
										placeholder="Your name"
										required
										maxlength="80"
										class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
									/>
									<input
										name="author_email"
										type="email"
										placeholder="Email (optional)"
										maxlength="120"
										class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
									/>
								</div>
								<textarea
									name="body"
									rows="4"
									required
									maxlength={data.maxBody}
									placeholder="Markdown works here"
									class="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
								></textarea>
								<button
									class="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
								>
									Post reply
								</button>
							</form>
						</details>
					{/if}
				</div>
			</div>
		</li>
	{/each}
</ul>

{#if topic.locked}
	<p class="mt-8 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
		This topic is closed. The engine does not know what a topic is, so the rule is enforced by this
		app and nowhere else.
	</p>
{:else}
	<section class="mt-8 rounded-lg bg-white p-6 ring-1 ring-slate-200">
		<h3 class="text-sm font-semibold text-slate-900">Add a reply</h3>
		<p class="mt-1 text-sm text-slate-500">
			Replies are held for a moderator before anyone else can read them.
		</p>

		{#if form?.posted}
			<p class="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
				Posted. It is waiting for a moderator, so it is not on the page yet.
			</p>
		{/if}

		<form method="POST" action="?/reply" class="mt-4 space-y-3">
			<input type="hidden" name="parent_id" value="" />
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="text-sm">
					<span class="text-slate-600">Your name</span>
					<input
						name="author_name"
						value={form?.authorName ?? ''}
						required
						maxlength="80"
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
					/>
				</label>
				<label class="text-sm">
					<span class="text-slate-600">Email (optional)</span>
					<input
						name="author_email"
						type="email"
						value={form?.authorEmail ?? ''}
						maxlength="120"
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
					/>
				</label>
			</div>

			<label class="block text-sm">
				<span class="text-slate-600">Reply</span>
				<textarea
					name="body"
					rows="6"
					required
					maxlength={data.maxBody}
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
					>{form?.body ?? ''}</textarea
				>
			</label>

			{#if form?.message}
				<p class="text-sm text-rose-600">{form.message}</p>
			{/if}

			<button
				class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
			>
				Post reply
			</button>
		</form>
	</section>
{/if}

<style>
	.prose-forum p {
		margin-bottom: 0.5rem;
	}
	.prose-forum p:last-child {
		margin-bottom: 0;
	}
</style>
