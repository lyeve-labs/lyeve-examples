<script lang="ts">
	interface Suggestion {
		id: string;
		title: string;
		slug: string;
	}

	interface Reply {
		query: string;
		results: Suggestion[];
		tookMs: number;
		roundTripMs: number;
		fullTotal: number | null;
	}

	let term = $state('');
	let reply = $state<Reply | null>(null);
	let pending = $state(false);
	let failure = $state('');

	let timer: ReturnType<typeof setTimeout> | undefined;
	let sequence = 0;

	/**
	 * Debounced so a burst of keystrokes is one query.
	 *
	 * Every request goes through this app's own endpoint, which holds the
	 * credential. The sequence number discards a slow reply that arrives after a
	 * newer one, which is the ordinary out-of-order hazard of typing faster than
	 * a round trip.
	 */
	function onInput(event: Event) {
		term = (event.currentTarget as HTMLInputElement).value;
		clearTimeout(timer);

		if (!term.trim()) {
			reply = null;
			failure = '';
			pending = false;
			return;
		}

		pending = true;
		const mine = ++sequence;
		timer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/instant?q=${encodeURIComponent(term)}`);
				if (!res.ok) throw new Error(`instant search failed (${res.status})`);
				const body: Reply = await res.json();
				if (mine !== sequence) return;
				reply = body;
				failure = '';
			} catch (err) {
				if (mine !== sequence) return;
				failure = err instanceof Error ? err.message : 'instant search failed';
			} finally {
				if (mine === sequence) pending = false;
			}
		}, 120);
	}
</script>

<svelte:head><title>Instant search</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Instant search</h1>

<p class="mt-3 max-w-2xl text-slate-600">
	A different endpoint from the search box on the front page, and a much narrower one. It matches a
	prefix of the title with <code class="rounded bg-slate-100 px-1.5 py-0.5">LIKE</code>, so it never
	looks at the body or the keywords, never stems a word, and will not match a word in the middle of
	a title. It returns published entries only, ordered by last update rather than by relevance, and
	no total.
</p>

<label class="mt-6 block">
	<span class="text-sm font-medium">Type the first word of a title</span>
	<input
		type="search"
		value={term}
		oninput={onInput}
		placeholder="che"
		autocomplete="off"
		class="mt-2 w-full max-w-xl rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
	/>
</label>

{#if failure}
	<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
		{failure}
	</p>
{/if}

{#if reply}
	<p class="mt-4 text-xs text-slate-500">
		{reply.results.length} suggestion{reply.results.length === 1 ? '' : 's'} ·
		engine reported {reply.tookMs} ms · {reply.roundTripMs} ms through this app
		{#if reply.fullTotal !== null}
			· full search on the same term matches {reply.fullTotal}
		{/if}
		{#if pending}· updating{/if}
	</p>

	{#if reply.results.length === 0}
		<p class="mt-4 text-slate-500">
			Nothing starts with that. A full search on the same term
			{#if reply.fullTotal}finds {reply.fullTotal} articles{:else}finds nothing either{/if}, which
			is the whole difference between a prefix match on the title and a match on the document.
		</p>
	{:else}
		<ul class="mt-4 max-w-xl divide-y divide-slate-200 rounded-md border border-slate-200">
			{#each reply.results as suggestion (suggestion.id)}
				<li>
					<a href="/articles/{suggestion.slug}" class="block px-3 py-2 text-sm hover:bg-slate-50">
						{suggestion.title}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{:else if pending}
	<p class="mt-4 text-xs text-slate-500">Searching</p>
{/if}

<section class="mt-10 max-w-2xl rounded-md border border-slate-200 p-4 text-sm text-slate-600">
	<h2 class="text-sm font-semibold text-slate-900">Things worth trying</h2>
	<ul class="mt-2 list-disc space-y-1 pl-5">
		<li>
			<code class="rounded bg-slate-100 px-1 py-0.5">che</code> suggests the checkpoint titles,
			because they begin with it.
		</li>
		<li>
			<code class="rounded bg-slate-100 px-1 py-0.5">checkpoint</code> suggests the same titles and
			the full search finds several more, including the articles that only discuss checkpoints in
			the body.
		</li>
		<li>
			<code class="rounded bg-slate-100 px-1 py-0.5">point</code> suggests nothing at all, while the
			full search still finds them. A prefix match starts at the beginning of the title.
		</li>
		<li>
			<code class="rounded bg-slate-100 px-1 py-0.5">indexes</code> suggests nothing, because there
			is no stemming here, while the full search treats it as
			<code class="rounded bg-slate-100 px-1 py-0.5">index</code>.
		</li>
	</ul>
</section>
