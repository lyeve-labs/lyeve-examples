<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>The transport</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">The transport</h1>
<p class="mt-2 max-w-2xl text-slate-600">
	Every request this storefront makes is a POST to <code
		class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">/api/v1/graphql</code
	> on the public router, sent by this server with a bearer token. Below is each document, the
	variables it carried, and the answer it got, taken by running them again now.
</p>

<h2 class="mt-12 text-lg font-semibold tracking-tight">One document per page</h2>

{#each data.pageQueries as item (item.route)}
	<section class="mt-6 rounded-lg border border-slate-200 p-5">
		<div class="flex flex-wrap items-baseline justify-between gap-3">
			<h3 class="font-medium">
				<code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">{item.route}</code>
				<span class="ml-2 text-slate-500">{item.exchange.name}</span>
			</h3>
			<p class="text-sm text-slate-400 tabular-nums">
				HTTP {item.exchange.status} · {item.exchange.elapsedMs} ms
			</p>
		</div>

		<p class="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Sent</p>
		<pre
			class="mt-1 overflow-x-auto rounded bg-slate-900 p-4 text-xs leading-relaxed text-slate-100"><code
				>{item.exchange.text}</code
			></pre>

		{#if item.exchange.variables}
			<p class="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Variables</p>
			<pre
				class="mt-1 overflow-x-auto rounded bg-slate-900 p-4 text-xs leading-relaxed text-slate-100"><code
					>{item.exchange.variables}</code
				></pre>
		{/if}

		<p class="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Received</p>
		<pre
			class="mt-1 max-h-96 overflow-auto rounded bg-slate-50 p-4 text-xs leading-relaxed text-slate-700"><code
				>{item.exchange.response}</code
			></pre>
	</section>
{/each}

<h2 class="mt-12 text-lg font-semibold tracking-tight">What the schema actually offers</h2>
<p class="mt-2 max-w-2xl text-slate-600">
	Introspected live, filtered to this app's three content types. The schema is generated from the
	content types themselves, so nothing here was written by hand and nothing can be added to it
	without adding a field to a content type.
</p>

<h3 class="mt-6 text-sm font-medium uppercase tracking-wide text-slate-400">Root query fields</h3>
<div class="mt-2 overflow-x-auto">
	<table class="w-full text-left text-sm">
		<thead class="border-b border-slate-200 text-slate-500">
			<tr>
				<th class="py-2 pr-4 font-medium">Field</th>
				<th class="py-2 pr-4 font-medium">Returns</th>
				<th class="py-2 font-medium">Arguments</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100">
			{#each data.rootFields as field (field.name)}
				<tr class="align-top">
					<td class="py-2 pr-4 font-mono text-xs">{field.name}</td>
					<td class="py-2 pr-4 font-mono text-xs text-slate-600">{field.returns}</td>
					<td class="py-2 font-mono text-xs text-slate-600">{field.args.join(', ')}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="mt-3 text-sm text-slate-500">
	The by-id field for <code class="rounded bg-slate-100 px-1 text-xs">gql_reviews</code> is
	<code class="rounded bg-slate-100 px-1 text-xs">gql_reviews_one</code>, not
	<code class="rounded bg-slate-100 px-1 text-xs">gql_review</code>. The singular name drops a
	trailing <code class="rounded bg-slate-100 px-1 text-xs">s</code>, unless the name ends in
	<code class="rounded bg-slate-100 px-1 text-xs">ss</code>,
	<code class="rounded bg-slate-100 px-1 text-xs">us</code>,
	<code class="rounded bg-slate-100 px-1 text-xs">is</code> or
	<code class="rounded bg-slate-100 px-1 text-xs">ws</code>, and reviews ends in the last of those.
	There is no by-slug field at all, which is why every page here uses a filtered list of one.
</p>

{#each data.types as type (type.name)}
	<section class="mt-8">
		<h3 class="font-mono text-sm font-medium">{type.name}</h3>
		<div class="mt-2 grid gap-6 sm:grid-cols-2">
			<div>
				<p class="text-xs font-medium uppercase tracking-wide text-slate-400">Selectable</p>
				<ul class="mt-1 space-y-0.5 font-mono text-xs text-slate-600">
					{#each type.fields as field (field.name)}
						<li>{field.name}: {field.type}</li>
					{/each}
				</ul>
			</div>
			<div>
				<p class="text-xs font-medium uppercase tracking-wide text-slate-400">
					Filterable via where
				</p>
				<ul class="mt-1 space-y-0.5 font-mono text-xs text-slate-600">
					{#each type.filterFields as field (field.name)}
						<li>{field.name}: {field.type}</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>
{/each}

<div class="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
	<p class="font-medium">The relations are not there.</p>
	<p class="mt-2">
		<code class="rounded bg-amber-100 px-1 text-xs">GqlProducts.collection</code> is typed
		<code class="rounded bg-amber-100 px-1 text-xs">String</code> and reads back null: it is the
		orphan column a belongs_to relation generates, not the foreign key. The column the engine really
		writes,
		<code class="rounded bg-amber-100 px-1 text-xs">collection_id</code>, is on no GraphQL type,
		cannot be selected, and does not appear in any
		<code class="rounded bg-amber-100 px-1 text-xs">FilterInput</code>. That is why these content
		types carry
		<code class="rounded bg-amber-100 px-1 text-xs">collection_slug</code> and
		<code class="rounded bg-amber-100 px-1 text-xs">product_slug</code> as ordinary text, and why
		this storefront joins in the application.
	</p>
</div>

<h3 class="mt-8 text-sm font-medium uppercase tracking-wide text-slate-400">Mutations</h3>
<p class="mt-2 max-w-2xl text-sm text-slate-600">
	Generated for every content type, and unused here. A mutation writes straight to the generated
	table and never to
	<code class="rounded bg-slate-100 px-1 text-xs">sys_content_entries</code>, so anything created
	through one is invisible to search and to the admin UI, permanently and without an error. The
	README says more.
</p>
<p class="mt-2 font-mono text-xs text-slate-600">{data.mutationNames.join('  ')}</p>

<h3 class="mt-8 text-sm font-medium uppercase tracking-wide text-slate-400">
	The introspection query itself
</h3>
<pre
	class="mt-2 overflow-x-auto rounded bg-slate-900 p-4 text-xs leading-relaxed text-slate-100"><code
		>{data.introspection.text}</code
	></pre>
<p class="mt-2 text-sm text-slate-500">
	Answered because this server holds a super_admin credential. Introspection defaults to
	admin-only, so the same query on a reader's token comes back
	<em>introspection requires admin authentication</em>.
</p>

<h2 class="mt-12 text-lg font-semibold tracking-tight">The limits, refused live</h2>
<p class="mt-2 max-w-2xl text-slate-600">
	Each of these was sent a moment ago, and below it is what came back. A document the endpoint
	refuses outright comes back HTTP 400 with a GraphQL
	<code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">errors</code> array, which is not how a
	resolver error arrives: those are HTTP 200.
</p>

{#each data.limits as limit (limit.title)}
	<section class="mt-6 rounded-lg border border-slate-200 p-5">
		<div class="flex flex-wrap items-baseline justify-between gap-3">
			<h3 class="font-medium">{limit.title} <span class="text-slate-500">{limit.limit}</span></h3>
			<p class="text-sm text-slate-400 tabular-nums">
				HTTP {limit.exchange.status} · {limit.exchange.elapsedMs} ms
			</p>
		</div>
		<p class="mt-2 text-sm text-slate-600">{limit.explanation}</p>

		<pre
			class="mt-4 overflow-x-auto rounded bg-slate-900 p-4 text-xs leading-relaxed text-slate-100"><code
				>{limit.exchange.text}</code
			></pre>
		{#if limit.exchange.elided}
			<p class="mt-1 text-xs text-slate-400">{limit.exchange.elided}</p>
		{/if}

		<pre
			class="mt-4 overflow-x-auto rounded bg-slate-50 p-4 text-xs leading-relaxed text-slate-700"><code
				>{limit.exchange.response}</code
			></pre>
	</section>
{/each}
