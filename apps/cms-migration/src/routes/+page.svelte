<script lang="ts">
	let { data } = $props();

	const ran = $derived(data.run !== null);
	const searchable = $derived(data.visibility.migratedTotal > 0);
</script>

<svelte:head><title>Migration report</title></svelte:head>

{#if !ran && data.counts.posts === 0}
	<div class="rounded-md border border-amber-300 bg-amber-50 p-5">
		<h1 class="font-semibold">The migration has not run here yet</h1>
		<p class="mt-2 text-sm text-slate-700">
			Run <code class="rounded bg-white px-1.5 py-0.5">pnpm run setup</code> from this directory, with
			the engine up and the repository's <code class="rounded bg-white px-1.5 py-0.5">.env</code>
			sourced. It applies the three target content types and then runs
			<code class="rounded bg-white px-1.5 py-0.5">migration/run.sh</code>, which needs a Go
			toolchain and a checkout of the CLI beside this repository.
		</p>
	</div>
{:else if !ran}
	<div class="rounded-md border border-amber-300 bg-amber-50 p-5">
		<h1 class="font-semibold">The content is here, the reports are not</h1>
		<p class="mt-2 text-sm text-slate-700">
			The counts below were read from the engine, so a migration did run, but
			<code class="rounded bg-white px-1.5 py-0.5">migration/reports</code> is empty. That
			directory also holds the checkpoints, and without them another run would insert every row a
			second time, so nothing here re-runs on its own. Drop the
			<code class="rounded bg-white px-1.5 py-0.5">legacy_</code> content types to start over.
		</p>
	</div>
{/if}

<div class="rounded-md border border-rose-300 bg-rose-50 p-5">
	<h2 class="font-semibold">Migrated content is not searchable</h2>
	<p class="mt-2 text-sm text-slate-700">
		The tool writes every entry through <code class="rounded bg-white px-1 py-0.5"
			>{'POST /api/v1/content/{schema}'}</code
		>, which stores the row in the generated table and nowhere else. Search reads the admin
		content table, so it never sees a migrated row. The two queries below are the same query
		shape against the same index.
	</p>
	<dl class="mt-4 grid gap-3 sm:grid-cols-2">
		<div class="rounded border border-rose-200 bg-white p-3">
			<dt class="text-xs uppercase tracking-wide text-slate-500">
				&ldquo;{data.visibility.migratedQuery}&rdquo; in migrated posts
			</dt>
			<dd class="mt-1 text-2xl font-semibold tabular-nums">{data.visibility.migratedTotal}</dd>
			<dd class="text-xs text-slate-500">
				The phrase is in a migrated headline and body. {searchable
					? 'This build found it, which contradicts the note above. Check whether the importer was changed.'
					: 'Search returns nothing, with no error.'}
			</dd>
		</div>
		<div class="rounded border border-rose-200 bg-white p-3">
			<dt class="text-xs uppercase tracking-wide text-slate-500">
				&ldquo;{data.visibility.controlQuery}&rdquo; in the page written by this app
			</dt>
			<dd class="mt-1 text-2xl font-semibold tabular-nums">{data.visibility.controlTotal}</dd>
			<dd class="text-xs text-slate-500">
				Written with the admin content route, and findable.
			</dd>
		</div>
	</dl>
</div>

<section class="mt-10">
	<h2 class="text-xl font-semibold tracking-tight">Read back from the engine</h2>
	<p class="mt-1 text-sm text-slate-500">
		Counted by walking the list route until a page comes back short, because a list response
		carries no total.
	</p>
	<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each [
			{ label: 'Authors', value: data.counts.authors },
			{ label: 'Posts', value: data.counts.posts },
			{ label: 'Pages from the export', value: data.counts.pagesFromExport },
			{ label: 'Pages written in LyEve', value: data.counts.pagesAuthoredInLyeve }
		] as tile (tile.label)}
			<div class="rounded-md border border-slate-200 p-4">
				<dt class="text-xs uppercase tracking-wide text-slate-500">{tile.label}</dt>
				<dd class="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</dd>
			</div>
		{/each}
	</dl>
	{#if data.counts.posts > 0}
		<p
			class="mt-3 text-sm {data.counts.postsWithoutAuthor > 0
				? 'text-rose-700'
				: 'text-slate-500'}"
		>
			{data.counts.postsWithoutAuthor} of {data.counts.posts} posts have no author. A byline
			survives the migration only because the export was rewritten with the ids the engine minted.
			Nothing in the tool translates a legacy key into one.
		</p>
	{/if}
</section>

{#if data.dryRun}
	<section class="mt-10">
		<h2 class="text-xl font-semibold tracking-tight">The dry run</h2>
		<p class="mt-1 text-sm text-slate-500">
			Counted rows and checked that every source column a mapping marked required is present. It
			does not check a field's type, the target schema's own required fields, or whether a
			relation value resolves.
		</p>
		<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each [
				{ label: 'Content types', value: data.dryRun.summary.total_schemas },
				{ label: 'Rows', value: data.dryRun.summary.total_entries },
				{ label: 'Types to create', value: data.dryRun.summary.schemas_to_create },
				{ label: 'Types already there', value: data.dryRun.summary.schemas_already_exist }
			] as tile (tile.label)}
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-500">{tile.label}</dt>
					<dd class="mt-1 text-2xl font-semibold tabular-nums">{tile.value ?? '-'}</dd>
				</div>
			{/each}
		</dl>

		{#if data.dryRun.summary.per_schema.length > 0}
			<div class="mt-4 overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="text-left text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th class="py-2 pr-4">Content type</th>
							<th class="py-2 pr-4 text-right">Rows</th>
							<th class="py-2 pr-4 text-right">Warnings</th>
							<th class="py-2">Verdict</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#each data.dryRun.summary.per_schema as row (row.schema)}
							<tr>
								<td class="py-2 pr-4 font-mono text-xs">{row.schema}</td>
								<td class="py-2 pr-4 text-right tabular-nums">{row.entries}</td>
								<td class="py-2 pr-4 text-right tabular-nums">{row.warnings}</td>
								<td class="py-2">{row.verdict}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<details class="mt-4">
			<summary class="cursor-pointer text-sm text-slate-600">The report as printed</summary>
			<pre class="mt-2 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">{data
					.dryRun.text}</pre>
		</details>
	</section>
{/if}

{#each data.stages as stage (stage.name)}
	{#if stage.summary}
		<section class="mt-10">
			<h2 class="text-xl font-semibold tracking-tight">{stage.label}</h2>
			<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
				{#each [
					{ label: 'Status', value: stage.summary.status },
					{ label: 'Rows seen', value: stage.summary.total_entries },
					{ label: 'Migrated', value: stage.summary.migrated },
					{ label: 'Skipped', value: stage.summary.skipped },
					{ label: 'Failed', value: stage.summary.failed }
				] as tile (tile.label)}
					<div class="rounded-md border border-slate-200 p-4">
						<dt class="text-xs uppercase tracking-wide text-slate-500">{tile.label}</dt>
						<dd class="mt-1 text-lg font-semibold tabular-nums">{tile.value ?? '-'}</dd>
					</div>
				{/each}
			</dl>

			{#if stage.summary.errors.length > 0}
				<ul class="mt-3 space-y-1 text-sm text-rose-700">
					{#each stage.summary.errors as err, i (i)}
						<li class="font-mono text-xs">{err}</li>
					{/each}
				</ul>
			{/if}

			{#if stage.checkpoint}
				<p class="mt-3 text-sm text-slate-500">
					Checkpoint written {new Date(stage.checkpoint.updated_at).toLocaleString()}, holding
					{stage.checkpoint.schemas.reduce(
						(n, s) => n + (s.migrated_ids?.length ?? 0),
						0
					)} migrated row identities. Those identities are the row's position in the file, not a
					key from it, so editing the export invalidates them.
				</p>
			{/if}

			<details class="mt-3">
				<summary class="cursor-pointer text-sm text-slate-600">The summary as printed</summary>
				<pre class="mt-2 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">{stage.text}</pre>
			</details>
		</section>
	{/if}
{/each}

<section class="mt-10">
	<h2 class="text-xl font-semibold tracking-tight">What arrived</h2>
	<ul class="mt-4 divide-y divide-slate-200">
		{#each data.posts as post (post.id)}
			<li class="py-4">
				<div class="flex items-baseline justify-between gap-4">
					<h3 class="font-medium">
						<a href="/posts/{post.slug}" class="hover:underline">{post.title}</a>
					</h3>
					<span class="shrink-0 font-mono text-xs text-slate-400">{post.legacyId ?? 'no key'}</span
					>
				</div>
				{#if post.standfirst}
					<p class="mt-1 text-sm text-slate-600">{post.standfirst}</p>
				{/if}
				<p class="mt-2 text-xs text-slate-400">
					{post.author ?? 'Unattributed'}
					{#if post.section}&middot; {post.section}{/if}
					{#if post.publishedAt}&middot; {new Date(post.publishedAt).toLocaleDateString()}{/if}
				</p>
			</li>
		{:else}
			<li class="py-4 text-sm text-slate-500">
				No posts in <code>legacy_posts</code> yet. The migration has not reached its third stage.
			</li>
		{/each}
	</ul>
</section>

{#if data.authors.length > 0}
	<section class="mt-10">
		<h2 class="text-xl font-semibold tracking-tight">Byline map</h2>
		<p class="mt-1 text-sm text-slate-500">
			The legacy key on the left is the value the export carried. The id on the right is what the
			engine minted, and what the post export had to be rewritten with.
		</p>
		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="text-left text-xs uppercase tracking-wide text-slate-500">
					<tr>
						<th class="py-2 pr-4">Legacy key</th>
						<th class="py-2 pr-4">Name</th>
						<th class="py-2 pr-4">Role</th>
						<th class="py-2">LyEve id</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200">
					{#each data.authors as author (author.id)}
						<tr>
							<td class="py-2 pr-4 font-mono text-xs">{author.legacyId ?? '-'}</td>
							<td class="py-2 pr-4">{author.name}</td>
							<td class="py-2 pr-4 text-slate-500">{author.role ?? '-'}</td>
							<td class="py-2 font-mono text-xs text-slate-500">{author.id}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

{#if data.run}
	<section class="mt-10 rounded-md border border-slate-200 p-5">
		<h2 class="font-semibold">The run</h2>
		<dl class="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
			<dt class="text-slate-500">Started</dt>
			<dd>{new Date(data.run.started_at).toLocaleString()}</dd>
			<dt class="text-slate-500">Finished</dt>
			<dd>{new Date(data.run.finished_at).toLocaleString()}</dd>
			<dt class="text-slate-500">CLI commit</dt>
			<dd class="font-mono text-xs">{data.run.cli_version}</dd>
			<dt class="text-slate-500">Admin listener</dt>
			<dd class="font-mono text-xs">{data.run.engine_admin_url}</dd>
			<dt class="text-slate-500">Public listener</dt>
			<dd class="font-mono text-xs">{data.run.engine_api_url}</dd>
			<dt class="text-slate-500">Seen by the tool as</dt>
			<dd class="font-mono text-xs">{data.run.proxy_url}</dd>
		</dl>
		<ol class="mt-4 space-y-2 text-xs">
			{#each data.run.stages as stage (stage.name)}
				<li class="rounded bg-slate-50 p-3">
					<p class="font-medium">{stage.label} &middot; exit {stage.exit_code}</p>
					<p class="mt-1 overflow-x-auto font-mono text-slate-600">{stage.command}</p>
				</li>
			{/each}
		</ol>
	</section>
{/if}
