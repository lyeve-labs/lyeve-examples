<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { DEFAULT_LOCALE, localeLabel } from '$lib/locales';

	let { data, form } = $props();
</script>

<svelte:head><title>Translations</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Translations</h1>
<p class="mt-2 text-slate-600">
	Every record and every locale this site publishes, with the state the engine holds for each.
</p>

{#if form?.message}
	<p
		class="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700"
	>
		{form.message}
	</p>
{/if}

<div class="mt-6 overflow-x-auto">
	<table class="w-full min-w-[42rem] border-collapse text-sm">
		<thead>
			<tr class="border-b border-slate-300 text-left">
				<th class="py-2 pr-4 font-medium">Record</th>
				{#each data.siteLocales as locale (locale.code)}
					<th class="px-2 py-2 font-medium">{locale.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each data.rows as row (row.id)}
				<tr class="border-b border-slate-200 align-top">
					<td class="py-3 pr-4">
						<a href={`/translations/${row.slug}`} class="font-medium hover:underline">
							{row.title}
						</a>
						<p class="text-xs text-slate-400">{row.kind} · {row.slug}</p>
					</td>

					{#each row.cells as cell (cell.locale)}
						<td class="px-2 py-3">
							<StatusBadge status={cell.status ?? 'missing'} />

							{#if cell.status}
								<form method="POST" action="?/mark" class="mt-1.5 flex flex-col gap-1">
									<input type="hidden" name="entryId" value={row.id} />
									<input type="hidden" name="locale" value={cell.locale} />
									{#if cell.status === 'outdated'}
										<button
											name="status"
											value="translated"
											class="text-xs text-slate-500 hover:text-slate-900 hover:underline"
										>
											mark translated
										</button>
									{:else}
										<button
											name="status"
											value="outdated"
											class="text-xs text-slate-500 hover:text-slate-900 hover:underline"
										>
											mark outdated
										</button>
									{/if}
								</form>
							{:else}
								<p class="mt-1.5 text-xs text-slate-400">no row</p>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<section class="mt-10 grid gap-6 sm:grid-cols-2">
	<div class="rounded-lg border border-slate-200 p-5 text-sm">
		<h2 class="font-medium text-slate-900">Coverage</h2>
		<ul class="mt-3 space-y-1 text-slate-600">
			{#each data.coverage as row (row.locale)}
				<li>
					{localeLabel(row.locale)}: {row.translated} of {row.total} marked translated
					{#if row.locale === DEFAULT_LOCALE}
						<span class="text-slate-400">(the source language)</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<div class="rounded-lg border border-slate-200 p-5 text-sm">
		<h2 class="font-medium text-slate-900">Who decides the locale list</h2>
		<p class="mt-2 text-slate-600">
			This site publishes
			<span class="font-medium text-slate-900">
				{data.siteLocales.map((l) => l.code).join(', ')}
			</span>
			, declared in code.
		</p>
		<p class="mt-2 text-slate-600">
			The engine reports
			<span class="font-medium text-slate-900">
				{data.engineLocales.enabled_locales.join(', ')}
			</span>
			with
			<span class="font-medium text-slate-900">{data.engineLocales.default_locale}</span>
			as the default. That list is a DISTINCT over the translation rows in the tenant, so it misses a
			locale nothing is translated into yet and picks up locales belonging to other applications on
			the same engine. Its PUT accepts a body and changes nothing.
		</p>
	</div>
</section>
