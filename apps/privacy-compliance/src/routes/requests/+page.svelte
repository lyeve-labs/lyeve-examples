<script lang="ts">
	import { STATE_LABELS, TYPE_LABELS } from '$lib/desk';

	let { data } = $props();

	const filed = $derived(data.columns.reduce((n, c) => n + c.requests.length, 0));
</script>

<svelte:head><title>Request register</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Request register</h1>
<p class="mt-2 max-w-2xl text-slate-600">
	{filed} filed. A request is a record first: it is verified, assigned and answered, and the DSAR
	routes only run from the request page once somebody has read it.
</p>

{#if filed === 0}
	<p class="mt-8 rounded-lg border border-slate-200 bg-white px-5 py-4 text-slate-500">
		The register is empty. Run <code class="rounded bg-slate-200 px-1.5 py-0.5">pnpm run setup</code> to
		seed it, or file one on <a href="/request" class="underline">the public form</a>.
	</p>
{:else}
	<div class="mt-8 grid gap-6 lg:grid-cols-2">
		{#each data.columns as column (column.state)}
			<section class="rounded-lg border border-slate-200 bg-white">
				<h2
					class="flex items-baseline justify-between border-b border-slate-200 px-5 py-3 text-sm font-semibold"
				>
					{STATE_LABELS[column.state]}
					<span class="font-normal text-slate-500">{column.requests.length}</span>
				</h2>
				{#if column.requests.length === 0}
					<p class="px-5 py-4 text-sm text-slate-400">Nothing here.</p>
				{:else}
					<ul class="divide-y divide-slate-100">
						{#each column.requests as request (request.slug)}
							<li class="px-5 py-4">
								<a href="/requests/{request.slug}" class="font-medium hover:underline">
									{request.title}
								</a>
								<p class="mt-1 text-sm text-slate-500">
									{TYPE_LABELS[request.type]} · {request.handlerName ?? 'unassigned'}
								</p>
								<p class="mt-1 text-sm {request.daysLeft < 0 ? 'text-red-600' : 'text-slate-400'}">
									received {new Date(request.receivedAt).toLocaleDateString()} ·
									{request.daysLeft < 0
										? `${Math.abs(request.daysLeft)} days past the deadline`
										: `${request.daysLeft} days left`}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	</div>
{/if}
