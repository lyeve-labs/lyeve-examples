<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Search console</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Search console</h1>
<p class="mt-2 max-w-3xl text-slate-600">
	The parts of the search plugin the other examples never touch. Two of the five tabs manage records
	the engine stores and does not read, which is the most important thing on this page and is stated
	on each of them rather than only in the README.
</p>

<nav class="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-px text-sm">
	{#each data.tabs as tab (tab.key)}
		<a
			href="/console?tab={tab.key}"
			class="rounded-t border border-b-0 px-3 py-2 {data.tab === tab.key
				? 'border-slate-300 bg-white font-medium text-slate-900'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			{tab.label}
		</a>
	{/each}
</nav>

{#if form?.error}
	<p class="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
		{form.error}
	</p>
{/if}

{#if data.tab === 'synonyms'}
	<section class="mt-6">
		<p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
			The engine stores these groups and never applies them. Its own query-expansion helper exists
			and has no caller, so the native search builds its SQL from the request text alone. A group
			created here changes a result only because the front page reads the groups and rewrites the
			query itself.
		</p>

		{#if form?.created}
			<p class="mt-3 text-sm text-emerald-700">Created a group for {form.created}.</p>
		{/if}
		{#if form?.removed}
			<p class="mt-3 text-sm text-emerald-700">Group removed.</p>
		{/if}

		<table class="mt-6 w-full text-sm">
			<thead class="text-left text-xs uppercase tracking-wide text-slate-400">
				<tr>
					<th class="pb-2 pr-4 font-medium">Base term</th>
					<th class="pb-2 pr-4 font-medium">Name</th>
					<th class="pb-2 pr-4 font-medium">Synonyms</th>
					<th class="pb-2 font-medium"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200">
				{#each data.synonyms as group (group.id)}
					<tr>
						<td class="py-2 pr-4 font-medium">{group.baseTerm}</td>
						<td class="py-2 pr-4 text-slate-600">{group.name}</td>
						<td class="py-2 pr-4 text-slate-600">{group.synonyms.join(', ')}</td>
						<td class="py-2 text-right">
							<form method="POST" action="?tab=synonyms&/removeSynonym">
								<input type="hidden" name="id" value={group.id} />
								<button class="text-xs text-slate-500 hover:text-red-700">Delete</button>
							</form>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="py-4 text-slate-500">
							No groups. Provisioning creates one for
							<code class="rounded bg-slate-100 px-1 py-0.5">p99</code>, so an empty table means it
							was deleted here.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<form method="POST" action="?tab=synonyms&/addSynonym" class="mt-8 max-w-xl space-y-3">
			<h2 class="text-sm font-semibold">Add a group</h2>
			<label class="block text-sm">
				<span class="font-medium">Base term</span>
				<input
					name="base_term"
					required
					placeholder="deadlock"
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
				/>
			</label>
			<label class="block text-sm">
				<span class="font-medium">Synonyms, comma separated</span>
				<input
					name="synonyms"
					required
					placeholder="lock, blocking, contention"
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
				/>
			</label>
			<label class="block text-sm">
				<span class="font-medium">Name</span>
				<input
					name="name"
					placeholder="Defaults to the base term"
					class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
				/>
			</label>
			<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
				Create
			</button>
			<p class="text-xs text-slate-500">
				The base term is unique per tenant. A second group claiming one is refused with a 409 whose
				body names no field, so the error above is this app translating the status rather than
				repeating a message from the engine.
			</p>
		</form>
	</section>
{/if}

{#if data.tab === 'ranking'}
	<section class="mt-6">
		<p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
			The engine stores this config and never reads it. A hit's score comes from a Postgres vector
			whose weights are compiled into a database trigger, so changing a weight here changes no
			ordering inside the engine, and a reindex does not help because the reindex rewrites the
			vector with those same compiled weights. Saving a config is only visible because the front
			page reads it and re-scores the page it received.
		</p>

		{#if form?.saved}
			<p class="mt-3 text-sm text-emerald-700">
				Saved for {form.saved}. Stored id {form.savedId}.
				{#if form.rejectedLines?.length}
					Lines that could not be parsed: {form.rejectedLines.join(' | ')}.
				{/if}
				{#if form.unmatchable?.length}
					Stored rules this app cannot evaluate: {form.unmatchable.join(', ')}.
				{/if}
			</p>
		{/if}
		{#if form?.rankingRemoved}
			<p class="mt-3 text-sm text-emerald-700">Config removed, so the route answers defaults again.</p>
		{/if}

		{#if data.ranking}
			<p class="mt-6 text-sm text-slate-600">
				{#if data.ranking.stored}
					A config is stored for
					<code class="rounded bg-slate-100 px-1 py-0.5">{data.ranking.schemaName}</code>.
				{:else}
					Nothing is stored for
					<code class="rounded bg-slate-100 px-1 py-0.5">{data.ranking.schemaName}</code>. The route
					still answered 200 with the defaults and a nil id, so a 200 here is not evidence that a
					record exists.
				{/if}
			</p>

			<form method="POST" action="?tab=ranking&/saveRanking" class="mt-4 max-w-xl space-y-3">
				<label class="block text-sm">
					<span class="font-medium">Schema</span>
					<input
						name="schema_name"
						value={data.ranking.schemaName}
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
					/>
					<span class="mt-1 block text-xs text-slate-500">
						The key is (tenant, schema). The route defaults to the literal string
						<code class="rounded bg-slate-100 px-1 py-0.5">*</code>, which is an ordinary key and not
						a wildcard: a config stored under it is not consulted for a named schema.
					</span>
				</label>

				<div class="grid gap-3 sm:grid-cols-3">
					<label class="block text-sm">
						<span class="font-medium">Title weight</span>
						<input
							name="title_weight"
							type="text"
							inputmode="decimal"
							value={data.ranking.titleWeight}
							class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
						/>
					</label>
					<label class="block text-sm">
						<span class="font-medium">Body weight</span>
						<input
							name="body_weight"
							type="text"
							inputmode="decimal"
							value={data.ranking.bodyWeight}
							class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
						/>
					</label>
					<label class="block text-sm">
						<span class="font-medium">Keyword weight</span>
						<input
							name="tag_weight"
							type="text"
							inputmode="decimal"
							value={data.ranking.tagWeight}
							class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
						/>
					</label>
				</div>
				<p class="text-xs text-slate-500">
					The third weight is called tag weight and is applied here to this app's
					<code class="rounded bg-slate-100 px-1 py-0.5">keywords</code> field. The engine reads tags
					from <code class="rounded bg-slate-100 px-1 py-0.5">meta.tags</code>, and the admin content
					write path never sets meta, so the C-weighted third of every vector in this corpus is
					empty.
				</p>

				<label class="block text-sm">
					<span class="font-medium">Boost rules, one per line as field value boost</span>
					<textarea
						name="rules"
						rows="4"
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
						placeholder="keyword checkpoint 2&#10;status published 0.5">{data.ranking.rulesText}</textarea>
					<span class="mt-1 block text-xs text-slate-500">
						The engine stores the field name and attaches no meaning to it. This app answers
						{data.knownBoostFields.join(', ')} and reports anything else as unmatched.
						{#if data.ranking.unmatchable.length}
							Currently stored and unmatchable: {data.ranking.unmatchable.join(', ')}.
						{/if}
					</span>
				</label>

				<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
					Save
				</button>
			</form>

			{#if data.ranking.stored}
				<form method="POST" action="?tab=ranking&/removeRanking" class="mt-4">
					<input type="hidden" name="id" value={data.ranking.id} />
					<button class="text-xs text-slate-500 hover:text-red-700">Delete this config</button>
				</form>
			{/if}

			<div class="mt-8 rounded-md border border-slate-200 p-4 text-sm text-slate-600">
				<h2 class="text-sm font-semibold text-slate-900">Seeing it work</h2>
				<p class="mt-2">
					Twelve articles match checkpoint. Four name it in the title and never in the body, and
					eight the other way round. Search for
					<a href="/?q=checkpoint&rank=config" class="underline">checkpoint with the config applied</a>
					and the four titled ones lead, because the default title weight is 1.0 against a body
					weight of 0.4. Set the title weight to 0 and the body weight to 3, save, and
					<a href="/?q=checkpoint&rank=config" class="underline">the same search</a> puts all eight
					body articles above them. The engine's own order, which the
					<a href="/?q=checkpoint" class="underline">unswitched search</a> shows, does not move
					either way.
				</p>
			</div>
		{:else}
			<p class="mt-6 text-slate-500">The ranking config could not be read.</p>
		{/if}
	</section>
{/if}

{#if data.tab === 'analytics'}
	<section class="mt-6">
		<p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
			Running a search records nothing. The engine has no automatic logging: the search handler
			answers the query and returns, and these tables stay empty unless the caller posts to
			<code class="rounded bg-white px-1 py-0.5">/analytics/log</code> itself. Everything below was
			written by this app's own front page, and an application that never posts has a summary of
			zeroes forever with nothing anywhere to say why.
		</p>

		<nav class="mt-4 flex gap-2 text-xs">
			{#each data.windows as choice (choice.key)}
				<a
					href="/console?tab=analytics&window={choice.key}"
					class="rounded border px-2 py-1 {data.windowKey === choice.key
						? 'border-slate-900 bg-slate-900 text-white'
						: 'border-slate-300 text-slate-600'}"
				>
					{choice.label}
				</a>
			{/each}
		</nav>

		{#if data.summary}
			<dl class="mt-6 grid gap-4 sm:grid-cols-3">
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Searches</dt>
					<dd class="mt-1 text-2xl font-semibold">{data.summary.total_searches}</dd>
				</div>
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Distinct queries</dt>
					<dd class="mt-1 text-2xl font-semibold">{data.summary.unique_queries}</dd>
				</div>
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Zero-result share</dt>
					<dd class="mt-1 text-2xl font-semibold">{data.summary.zero_result_pct.toFixed(1)}%</dd>
				</div>
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Average results</dt>
					<dd class="mt-1 text-2xl font-semibold">{data.summary.avg_result_count.toFixed(1)}</dd>
				</div>
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Average duration</dt>
					<dd class="mt-1 text-2xl font-semibold">{data.summary.avg_duration_ms.toFixed(0)} ms</dd>
					<dd class="mt-1 text-xs text-slate-500">
						This app's own round trip, because the value posted is whatever the caller measured.
					</dd>
				</div>
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Click-through</dt>
					<dd class="mt-1 text-2xl font-semibold text-slate-400">not available</dd>
					<dd class="mt-1 text-xs text-slate-500">
						The click endpoint writes the clicked entry onto the analytics row and no read route
						returns that column. There is no route that lists raw rows either, so the rate cannot be
						computed from this API.
					</dd>
				</div>
			</dl>

			<h2 class="mt-8 text-sm font-semibold">Top queries</h2>
			<p class="mt-1 text-xs text-slate-500">
				The twenty most frequent, which is a fixed cap in the handler rather than a parameter.
			</p>
			<ul class="mt-3 max-w-xl divide-y divide-slate-200 text-sm">
				{#each data.summary.top_queries as entry (entry.query_text)}
					<li class="flex justify-between gap-4 py-2">
						<a href="/?q={encodeURIComponent(entry.query_text)}" class="truncate hover:underline">
							{entry.query_text}
						</a>
						<span class="text-slate-400">{entry.count}</span>
					</li>
				{:else}
					<li class="py-4 text-slate-500">
						Nothing logged in this window. Run a few searches on the front page and come back.
					</li>
				{/each}
			</ul>

			<h2 class="mt-8 text-sm font-semibold">What this process reported</h2>
			<p class="mt-1 text-xs text-slate-500">
				Counted in memory by this app, lost on restart, and not what the engine holds. It is here
				because the clicks it sent cannot be read back.
			</p>
			<ul class="mt-2 text-sm text-slate-600">
				<li>{data.tally.searchesLogged} searches logged</li>
				<li>{data.tally.clicksReported} clicks reported</li>
				{#if data.tally.lastQuery}
					<li>last query: {data.tally.lastQuery} at {data.tally.lastAt}</li>
				{/if}
			</ul>
		{:else}
			<p class="mt-6 text-slate-500">The analytics summary could not be read.</p>
		{/if}
	</section>
{/if}

{#if data.tab === 'reindex'}
	<section class="mt-6 max-w-3xl">
		<p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
			This is not scoped to this app. A super_admin with no tenant header resolves to the implicit
			default tenant, which the handler maps to the whole corpus, so pressing the button rebuilds
			every example's content on the shared engine.
		</p>

		<div class="mt-4 space-y-3 text-sm text-slate-600">
			<p>
				On Postgres the index is a tsvector maintained by a trigger on insert and on any update of
				the title, body or meta, so a rebuild is not needed after a write and is not needed after a
				ranking change either. What it is for is a row the trigger never saw: content that predates
				the plugin's migration, or a row written while the plugin was unlicensed.
			</p>
			<p>
				It streams every entry in batches of five hundred keys and skips a row whose stored index
				already matches its content, counting it as indexed anyway. So on a current corpus this is a
				full read and no writes, and
				<code class="rounded bg-slate-100 px-1 py-0.5">indexed</code> is the number of rows examined
				rather than the number rewritten.
			</p>
			<p>
				It is safe to call while serving, in the sense that it takes no exclusive lock and rewrites
				nothing that is already current. It is also synchronous: the request does not return until
				the pass is finished, so on a corpus large enough it can outlive the engine's write timeout
				and hand the caller a dropped connection rather than a result.
			</p>
		</div>

		<form method="POST" action="?tab=reindex&/reindex" class="mt-6">
			<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
				Reindex the whole corpus
			</button>
		</form>

		{#if form?.reindexed}
			<dl class="mt-6 grid gap-4 sm:grid-cols-4">
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Indexed</dt>
					<dd class="mt-1 text-2xl font-semibold">{form.reindexed.indexed}</dd>
				</div>
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Skipped</dt>
					<dd class="mt-1 text-2xl font-semibold">{form.reindexed.skipped}</dd>
				</div>
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Errors</dt>
					<dd class="mt-1 text-2xl font-semibold">{form.reindexed.errors}</dd>
				</div>
				<div class="rounded-md border border-slate-200 p-4">
					<dt class="text-xs uppercase tracking-wide text-slate-400">Elapsed</dt>
					<dd class="mt-1 text-2xl font-semibold">{form.reindexMs} ms</dd>
					<dd class="mt-1 text-xs text-slate-500">Measured here. The reply carries no timing.</dd>
				</div>
			</dl>
			<p class="mt-3 text-sm text-slate-600">{form.reindexed.message}</p>
		{/if}
	</section>
{/if}

{#if data.tab === 'verbs'}
	<section class="mt-6 max-w-3xl">
		<p class="text-sm text-slate-600">
			The same search run as a query string and as a JSON body. They answer the same thing, and the
			differences are in what each will accept.
		</p>

		<form method="GET" class="mt-4 flex gap-2">
			<input type="hidden" name="tab" value="verbs" />
			<input
				name="probe"
				value={data.probe}
				class="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
			/>
			<button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
				Run both
			</button>
		</form>

		{#if data.verbs}
			<div class="mt-6 grid gap-4 sm:grid-cols-2">
				<div class="rounded-md border border-slate-200 p-4 text-sm">
					<h2 class="font-semibold">GET /api/admin/search</h2>
					<p class="mt-2 text-slate-600">total {data.verbs.query.total}, limit {data.verbs.query.limit}</p>
					<ol class="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
						{#each data.verbs.query.titles as title, i (i)}
							<li>{title} <span class="text-slate-400">({data.verbs.query.ranks[i].toFixed(4)})</span></li>
						{/each}
					</ol>
				</div>
				<div class="rounded-md border border-slate-200 p-4 text-sm">
					<h2 class="font-semibold">POST /api/admin/search</h2>
					<p class="mt-2 text-slate-600">total {data.verbs.body.total}, limit {data.verbs.body.limit}</p>
					<ol class="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
						{#each data.verbs.body.titles as title, i (i)}
							<li>{title} <span class="text-slate-400">({data.verbs.body.ranks[i].toFixed(4)})</span></li>
						{/each}
					</ol>
				</div>
			</div>
		{:else}
			<p class="mt-6 text-slate-500">One of the two calls failed.</p>
		{/if}

		<div class="mt-8 space-y-3 text-sm text-slate-600">
			<h2 class="text-sm font-semibold text-slate-900">Where they differ</h2>
			<p>
				<strong>Unknown parameters.</strong> The body is decoded strictly, so
				<code class="rounded bg-slate-100 px-1 py-0.5">{'{"q":"x","fuzziness":2}'}</code> is a 400.
				The query string ignores anything it does not recognize, so
				<code class="rounded bg-slate-100 px-1 py-0.5">?q=x&amp;fuzziness=2</code> is a 200 that
				silently did something else. POST is the honest way to find out that a parameter does not
				exist, and there is no fuzziness, no field selector and no sort on either.
			</p>
			<p>
				<strong>Dates.</strong> Both take an RFC 3339
				<code class="rounded bg-slate-100 px-1 py-0.5">published_after</code> and
				<code class="rounded bg-slate-100 px-1 py-0.5">published_before</code>. On the query string
				an unparseable value is dropped and the search runs unfiltered. In the body it is a decode
				error.
			</p>
			<p>
				<strong>Facets.</strong> The query string splits on commas, removes duplicates and keeps at
				most three. The body takes the array as given. Only
				<code class="rounded bg-slate-100 px-1 py-0.5">schema</code>,
				<code class="rounded bg-slate-100 px-1 py-0.5">status</code> and
				<code class="rounded bg-slate-100 px-1 py-0.5">tags</code> produce buckets, so the cap costs
				nothing.
			</p>
			<p>
				<strong>Limit.</strong> Both default to 20 and end up capped at 200. Unlike the content
				route there is no floor, so a page of three is a page of three.
			</p>
			<p>
				<strong>Tenant.</strong> A <code class="rounded bg-slate-100 px-1 py-0.5">tenant_id</code>
				in the body is accepted by the decoder and then overwritten with the tenant from the request
				context, so it cannot be used to read another tenant's content.
			</p>
			<p>
				<strong>Null bytes.</strong> The query string path rejects them explicitly. The body path
				has no such check, because JSON can carry one and the driver boundary is where it would
				matter.
			</p>
		</div>
	</section>
{/if}
