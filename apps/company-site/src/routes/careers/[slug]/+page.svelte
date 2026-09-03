<script lang="ts">
	import PageMeta from '$lib/components/PageMeta.svelte';
	import { paragraphs } from '$lib/site';

	let { data } = $props();
	const role = $derived(data.role);
</script>

<PageMeta title={role.title} description={role.summary} type="article" />

<article class="max-w-3xl">
	<a href="/careers" class="text-sm text-slate-500 hover:underline">&larr; All roles</a>

	<h1 class="mt-6 text-3xl font-semibold tracking-tight">{role.title}</h1>
	<p class="mt-2 text-sm text-slate-500">
		{role.department} &middot; {role.location} &middot; {role.employmentType}
	</p>

	{#if role.summary}
		<p class="mt-6 text-lg text-slate-600">{role.summary}</p>
	{/if}

	<div class="mt-8 space-y-4 leading-relaxed text-slate-700">
		{#each paragraphs(role.body) as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	<aside class="mt-12 rounded-lg bg-slate-50 p-6">
		{#if role.hiringManager}
			<p class="text-sm text-slate-600">
				You will report to <span class="font-medium text-slate-900">{role.hiringManager.name}</span
				>, {role.hiringManager.role}.
			</p>
		{:else if role.hiringManagerAssigned}
			<p class="text-sm text-slate-600">
				Your hiring manager is named on the interview brief.
			</p>
		{:else}
			<p class="text-sm text-slate-600">
				This role reports into the {role.department} lead.
			</p>
		{/if}
		<a
			href="/contact"
			class="mt-4 inline-block rounded-md bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700"
		>
			Apply through contact
		</a>
	</aside>
</article>
