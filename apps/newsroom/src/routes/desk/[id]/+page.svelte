<script lang="ts">
	let { data, form } = $props();

	const story = $derived(data.story);

	// Every action returns the same flat shape, so this reads the fields rather
	// than narrowing a union first.
	const notice = $derived.by(() => {
		if (!form) return null;
		if (form.error) return form.error;
		if (form.saved) return `Saved as revision ${story.currentRev}: ${form.saved}`;
		if (form.published) return 'Published. The desk status and the public status both moved.';
		if (form.unpublished) return 'Pulled back to draft on both sides.';
		if (form.archived) return 'Archived on the desk, and taken off the public list.';
		if (form.restored) return `Restored revision ${form.restored} as a new revision.`;
		if (form.submitted) return 'Submitted for review at the first stage.';
		if (form.transitioned) return `Recorded ${form.transitioned}.`;
		if (form.commented) return 'Comment filed.';
		if (form.embargoed) return `Embargo set for ${new Date(form.embargoed).toLocaleString()}.`;
		if (form.embargoCleared) return 'Embargo cleared.';
		return null;
	});

	function badge(status: string): string {
		if (status === 'published') return 'bg-emerald-100 text-emerald-900';
		if (status === 'archived') return 'bg-slate-200 text-slate-700';
		if (status === 'missing') return 'bg-red-100 text-red-900';
		return 'bg-amber-100 text-amber-900';
	}

	function minutes(seconds: number): string {
		if (seconds <= 0) return 'no budget';
		if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
		return `${(seconds / 3600).toFixed(1)} h`;
	}
</script>

<svelte:head><title>{story.title} &middot; desk</title></svelte:head>

<a href="/desk" class="text-sm text-slate-500 hover:underline">&larr; The desk</a>

<header class="mt-4 border-b border-slate-200 pb-5">
	<h1 class="font-serif text-2xl font-bold tracking-tight">{story.title}</h1>
	<div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
		<span class="rounded px-2 py-0.5 text-xs capitalize {badge(story.deskStatus)}">
			desk: {story.deskStatus}
		</span>
		<span class="rounded px-2 py-0.5 text-xs capitalize {badge(story.publicStatus)}">
			public: {story.publicStatus}
		</span>
		<span class="text-slate-500">revision {story.currentRev}</span>
		<a href="/desk/{story.id}/preview" class="text-slate-600 underline">Preview</a>
		{#if story.publicStatus === 'published'}
			<a href="/stories/{story.slug}" class="text-slate-600 underline">Public page</a>
		{/if}
	</div>
	{#if !story.aligned}
		<p class="mt-3 rounded bg-amber-50 px-4 py-2 text-sm text-amber-900">
			These two disagree. The desk status and the public status are separate columns and no engine
			route writes both. The desk list has an action that puts them back in step.
		</p>
	{/if}
	{#if story.embargo}
		<p class="mt-3 text-sm text-slate-600">
			Embargoed until {new Date(story.embargo).toLocaleString()}. The content plugin's scheduler
			polls every thirty seconds and will move the desk status to published, but it cannot write the
			public status, so the story still needs aligning after it fires.
		</p>
	{/if}
</header>

{#if notice}
	<p
		class="mt-5 rounded px-4 py-2 text-sm {form?.error
			? 'bg-red-50 text-red-900'
			: 'bg-emerald-50 text-emerald-900'}"
	>
		{notice}
	</p>
{/if}

<div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
	<div class="space-y-8">
		<section>
			<h2 class="font-medium">Copy</h2>
			<p class="mt-1 text-sm text-slate-500">
				Every save is a new numbered revision with the note attached. The update replaces the body
				rather than merging it, so the whole field set is posted each time.
			</p>
			<form method="POST" action="?/save" class="mt-4 space-y-4">
				<div>
					<label class="block text-sm font-medium" for="title">Headline</label>
					<input
						id="title"
						name="title"
						value={story.title}
						class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
					/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label class="block text-sm font-medium" for="slug">Slug</label>
						<input
							id="slug"
							name="slug"
							value={story.slug}
							class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium" for="dateline">Dateline</label>
						<input
							id="dateline"
							name="dateline"
							value={story.dateline}
							class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
						/>
					</div>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label class="block text-sm font-medium" for="desk">Desk</label>
						<select
							id="desk"
							name="desk"
							class="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
						>
							<option value="">Unassigned</option>
							{#each data.desks as option (option.id)}
								<option value={option.id} selected={option.id === story.desk}>{option.title}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium" for="reporter">Byline</label>
						<select
							id="reporter"
							name="reporter"
							class="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
						>
							<option value="">Staff reporter</option>
							{#each data.reporters as option (option.id)}
								<option value={option.id} selected={option.id === story.reporter}>
									{option.title}
								</option>
							{/each}
						</select>
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium" for="standfirst">Standfirst</label>
					<textarea
						id="standfirst"
						name="standfirst"
						rows="2"
						class="mt-1 w-full rounded border border-slate-300 px-3 py-2">{story.standfirst}</textarea
					>
				</div>
				<div>
					<label class="block text-sm font-medium" for="body">Copy</label>
					<textarea
						id="body"
						name="body"
						rows="14"
						class="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
						>{story.body}</textarea
					>
				</div>
				<input type="hidden" name="cover_media_id" value={story.coverMediaId} />
				<div class="flex flex-wrap items-end gap-3">
					<div class="grow">
						<label class="block text-sm font-medium" for="change_note">Change note</label>
						<input
							id="change_note"
							name="change_note"
							placeholder="what changed, and why"
							class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
						/>
					</div>
					<button class="rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
						Save revision
					</button>
				</div>
			</form>
		</section>

		<section>
			<h2 class="font-medium">Revisions</h2>
			<p class="mt-1 text-sm text-slate-500">
				Restoring writes the old copy back as a new revision, so nothing is lost. The engine's own
				revision table holds {data.engineRevisions} for this story, because that table is written
				by the public update route and this app writes through the admin one.
			</p>
			<ul class="mt-4 divide-y divide-slate-200 border-y border-slate-200">
				{#each data.revisions as rev (rev.num)}
					<li class="flex flex-wrap items-baseline justify-between gap-3 py-3">
						<div class="min-w-0">
							<p class="text-sm">
								<span class="font-medium">Revision {rev.num}</span>
								<span class="text-slate-500"> &middot; {rev.note}</span>
							</p>
							<p class="mt-0.5 text-xs text-slate-500">
								{rev.title} &middot; {rev.status} &middot; {rev.author} &middot;
								{new Date(rev.at).toLocaleString()}
							</p>
						</div>
						{#if rev.num !== story.currentRev}
							<form method="POST" action="?/restore">
								<input type="hidden" name="revision_num" value={rev.num} />
								<button class="rounded border border-slate-300 px-2.5 py-1 text-xs hover:border-slate-500">
									Restore
								</button>
							</form>
						{:else}
							<span class="text-xs text-slate-400">current</span>
						{/if}
					</li>
				{/each}
			</ul>

			{#if data.revisions.length > 1}
				<form method="GET" class="mt-4 flex flex-wrap items-end gap-3 text-sm">
					<div>
						<label class="block text-xs font-medium" for="from">Diff from</label>
						<input
							id="from"
							name="from"
							type="number"
							min="1"
							value={data.diffRange.from}
							class="mt-1 w-20 rounded border border-slate-300 px-2 py-1"
						/>
					</div>
					<div>
						<label class="block text-xs font-medium" for="to">to</label>
						<input
							id="to"
							name="to"
							type="number"
							min="1"
							value={data.diffRange.to}
							class="mt-1 w-20 rounded border border-slate-300 px-2 py-1"
						/>
					</div>
					<button class="rounded border border-slate-300 px-3 py-1 hover:border-slate-500">
						Compare
					</button>
				</form>
				{#if data.diff}
					<pre
						class="mt-3 overflow-x-auto rounded bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{data
							.diff.text}</pre>
				{/if}
			{/if}
		</section>

		<section>
			<h2 class="font-medium">Audit trail</h2>
			<p class="mt-1 text-sm text-slate-500">
				The audit insert shares its transaction with the content write, so there is no change here
				without a row.
			</p>
			<ul class="mt-3 space-y-1 text-sm text-slate-600">
				{#each data.audit as record (record.id)}
					<li>
						<span class="font-medium">{record.action}</span>
						&middot; revision {record.revision} &middot; {record.actor} &middot;
						{new Date(record.at).toLocaleString()}
					</li>
				{/each}
			</ul>
		</section>
	</div>

	<div class="space-y-8">
		<section class="rounded border border-slate-200 p-5">
			<h2 class="font-medium">Publication</h2>
			<div class="mt-3 flex flex-wrap gap-2">
				<form method="POST" action="?/publish">
					<button
						class="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
					>
						Publish
					</button>
				</form>
				<form method="POST" action="?/unpublish">
					<button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:border-slate-500">
						Back to draft
					</button>
				</form>
				<form method="POST" action="?/archive">
					<button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:border-slate-500">
						Archive
					</button>
				</form>
			</div>
			<p class="mt-3 text-xs text-slate-500">
				Each button is two writes: <code>PUT /api/admin/content/{'{id}'}</code> for the desk status,
				then <code>PUT /api/v1/content/news_stories/{'{id}'}/publish</code> or
				<code>/unpublish</code> for the public one.
			</p>

			<h3 class="mt-5 text-sm font-medium">Embargo</h3>
			<form method="POST" action="?/embargo" class="mt-2 flex flex-wrap items-end gap-2">
				<input
					name="publish_at"
					type="datetime-local"
					class="rounded border border-slate-300 px-2 py-1 text-sm"
				/>
				<button class="rounded border border-slate-300 px-3 py-1.5 text-sm hover:border-slate-500">
					Set
				</button>
			</form>
			{#if story.embargo}
				<form method="POST" action="?/clearEmbargo" class="mt-2">
					<button class="text-xs text-slate-500 underline">Clear the embargo</button>
				</form>
			{/if}
		</section>

		<section class="rounded border border-slate-200 p-5">
			<h2 class="font-medium">Review</h2>
			{#if !data.review}
				<p class="mt-2 text-sm text-slate-500">
					No review is defined for this content type. Run <code>pnpm run setup</code>.
				</p>
			{:else}
				<p class="mt-1 text-sm text-slate-500">{data.review.name}</p>
				<ol class="mt-3 space-y-2">
					{#each data.review.stages as stage (stage.id)}
						<li class="flex items-baseline gap-2 text-sm">
							<span
								class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full {stage.state === 'done'
									? 'bg-emerald-600'
									: stage.state === 'current'
										? 'bg-amber-500'
										: 'bg-slate-300'}"
							></span>
							<span class={stage.state === 'ahead' ? 'text-slate-400' : ''}>
								{stage.name}
								<span class="text-xs text-slate-500">
									&middot; {stage.requiredRole} &middot; {minutes(stage.slaSeconds)}
								</span>
							</span>
						</li>
					{/each}
				</ol>
				<p class="mt-2 text-xs text-slate-500">
					Each stage's required role is enforced on top of the permission rules. An admin satisfies any stage.
				</p>

				{#if !data.assignment}
					<form method="POST" action="?/submit" class="mt-4">
						<button class="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
							Send to review
						</button>
						<p class="mt-2 text-xs text-slate-500">
							Creating the assignment is the submission: the plugin opens it at the first stage as
							pending_review and logs it as a submit. There is no separate submit action.
						</p>
					</form>
				{:else}
					<p class="mt-4 text-sm">
						<span class="font-medium capitalize">{data.assignment.status.replace('_', ' ')}</span>
						at {data.assignment.stage}, with {data.assignment.assignee}
					</p>

					{#if data.assignment.terminal}
						<p class="mt-3 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
							Approved is terminal: a further transition answers 409. There is no publish
							transition either, so publishing is the desk's own step above.
						</p>
					{:else}
						<form method="POST" action="?/transition" class="mt-3 space-y-2">
							<input type="hidden" name="assignment_id" value={data.assignment.id} />
							<input
								name="comment"
								placeholder="note for the log"
								class="w-full rounded border border-slate-300 px-2 py-1 text-sm"
							/>
							<div class="flex flex-wrap gap-2">
								{#each data.transitions as action (action)}
									<button
										name="action"
										value={action}
										class="rounded border border-slate-300 px-2.5 py-1 text-xs capitalize hover:border-slate-500"
									>
										{action.replace('_', ' ')}
									</button>
								{/each}
							</div>
						</form>
					{/if}

					<form method="POST" action="?/comment" class="mt-4 space-y-2">
						<input type="hidden" name="stage_id" value={data.assignment.stageId} />
						<textarea
							name="body"
							rows="2"
							placeholder="comment at this stage"
							class="w-full rounded border border-slate-300 px-2 py-1 text-sm"
						></textarea>
						<button class="rounded border border-slate-300 px-2.5 py-1 text-xs hover:border-slate-500">
							File comment
						</button>
					</form>

					{#if data.comments.length > 0}
						<ul class="mt-4 space-y-2 text-sm">
							{#each data.comments as comment (comment.id)}
								<li class="rounded bg-slate-50 p-3">
									<p>{comment.body}</p>
									<p class="mt-1 text-xs text-slate-500">
										{comment.author} &middot; {comment.stage} &middot;
										{new Date(comment.at).toLocaleString()}
									</p>
								</li>
							{/each}
						</ul>
					{/if}

					<h3 class="mt-5 text-sm font-medium">Stage log</h3>
					<ul class="mt-2 space-y-1 text-xs text-slate-600">
						{#each data.logs as log (log.id)}
							<li>
								<span class="font-medium">{log.action.replace('_', ' ')}</span>
								&middot; {log.stage} &middot; {log.actor} &middot;
								{new Date(log.at).toLocaleString()}
								{#if log.comment}<span class="block pl-2 text-slate-500">{log.comment}</span>{/if}
							</li>
						{/each}
					</ul>

					<h3 class="mt-5 text-sm font-medium">SLA</h3>
					<ul class="mt-2 space-y-1 text-xs">
						{#each data.sla as row (row.stage)}
							<li class={row.exceeded ? 'text-red-800' : 'text-slate-600'}>
								{row.stage} &middot; budget {minutes(row.budgetSeconds)} &middot;
								{#if !row.entered}
									not reached
								{:else if row.exited}
									left {new Date(row.exited).toLocaleTimeString()}
								{:else}
									open since {new Date(row.entered).toLocaleTimeString()}
								{/if}
								{#if row.exceeded}&middot; over by {minutes(row.overSeconds)}{/if}
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</section>
	</div>
</div>
