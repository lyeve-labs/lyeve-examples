<script lang="ts">
	import { shortId, when } from '$lib/format';

	let { data } = $props();

	const severityClass: Record<string, string> = {
		major: 'bg-red-100 text-red-800',
		minor: 'bg-amber-100 text-amber-800',
		info: 'bg-slate-100 text-slate-700'
	};
</script>

<svelte:head><title>Notice feed</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Notice feed</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	The read the phone makes, made here with the console's session so the payload can be shown beside
	its own caveats. It is the cursor route, which is the one built for a client that pages: it honors
	a page of {data.pageSize} where the offset route would not.
</p>

<p class="mt-4 overflow-x-auto rounded-md bg-slate-900 px-4 py-3 font-mono text-xs text-slate-100">
	GET {data.requestPath}
</p>

<div class="mt-6 grid grid-cols-2 gap-4">
	<div class="rounded-lg border border-slate-200 p-5">
		<p class="text-sm text-slate-500">Cursor route</p>
		<p class="mt-1 text-lg font-medium">
			asked {data.pageSize}, got {data.notices.length}
		</p>
		<p class="mt-1 text-xs text-slate-400">limit is honored from 1 to 1000</p>
	</div>
	<div class="rounded-lg border border-slate-200 p-5">
		<p class="text-sm text-slate-500">Offset route, same limit</p>
		<p class="mt-1 text-lg font-medium">
			asked {data.offset.asked}, got {data.offset.got}
		</p>
		<p class="mt-1 text-xs text-slate-400">clamped up to 25, so a small page is impossible there</p>
	</div>
</div>

{#if data.notices.length === 0}
	<p class="mt-8 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
		Nothing here. Either run <code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code>, or
		this is the empty final page the cursor route serves when the collection divides exactly by the
		page size.
	</p>
{:else}
	<ul class="mt-8 divide-y divide-slate-200 rounded-lg border border-slate-200">
		{#each data.notices as notice (notice.id)}
			<li class="p-5">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class="text-xs font-medium uppercase tracking-wide text-slate-400">{notice.line}</p>
						<h2 class="mt-1 font-medium">{notice.title}</h2>
						<p class="mt-1 text-sm text-slate-600">{notice.body}</p>
					</div>
					<span
						class="shrink-0 rounded px-2 py-0.5 text-xs font-medium {severityClass[
							notice.severity
						] ?? severityClass.info}"
					>
						{notice.severity}
					</span>
				</div>
				<p class="mt-3 text-xs text-slate-400">
					id {shortId(notice.id)}, written {when(notice.createdAt)}
					{#if notice.effectiveFrom}, effective {when(notice.effectiveFrom)}{/if}
				</p>
			</li>
		{/each}
	</ul>
{/if}

<div class="mt-6 flex items-center gap-4">
	{#if data.cursor}
		<a href="/feed" class="text-sm text-slate-500 hover:underline">&larr; First page</a>
	{/if}
	{#if data.nextCursor}
		<a
			href="/feed?cursor={data.nextCursor}"
			class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
		>
			Next page
		</a>
	{:else}
		<span class="text-sm text-slate-400">No next cursor, so this is the end.</span>
	{/if}
</div>

<section class="mt-12 max-w-3xl space-y-4 text-sm text-slate-600">
	<h2 class="text-lg font-semibold tracking-tight text-slate-900">What to know before shipping it</h2>
	<p>
		<strong class="font-medium text-slate-900">The order is the row id.</strong> Not created_at, not
		effective_from. The id is a random UUID, so the sequence above is arbitrary and stable, which is
		exactly what a cursor needs and exactly not what a newest-first feed needs. Compare the written
		timestamps: they are not in order. A feed that must be chronological either sorts a whole page
		in the app or uses the offset route, which orders created_at descending and cannot page below
		twenty-five.
	</p>
	<p>
		<strong class="font-medium text-slate-900">next_cursor is set when the page came back full.</strong
		> It is the last row's id, so a collection whose size divides exactly by the page size serves one
		final empty page before it stops. Following the cursor until it is empty is right. Treating a full
		page as proof of more is not.
	</p>
	<p>
		<strong class="font-medium text-slate-900">The relation is written under one name and read under
			another.</strong
		> A notice declares <code class="rounded bg-slate-100 px-1.5 py-0.5">line</code>, the engine
		stores <code class="rounded bg-slate-100 px-1.5 py-0.5">line_id</code>, and an unpopulated read
		hands back both that and a dead <code class="rounded bg-slate-100 px-1.5 py-0.5">line: null</code
		>. Asking for <code class="rounded bg-slate-100 px-1.5 py-0.5">populate=line</code> is what puts
		the line name in the payload instead of a second round trip per notice, and it works on this
		route as well as the offset one.
	</p>
	<p>
		<strong class="font-medium text-slate-900">There is no filter that reaches through the
			relation.</strong
		> Notices for one line are found by resolving the line's slug to an id and then filtering
		<code class="rounded bg-slate-100 px-1.5 py-0.5">filters[line_id]=</code>. The engine does not
		join, so that is two requests, and the cursor route takes no filters at all.
	</p>
</section>
