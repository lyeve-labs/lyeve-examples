<script lang="ts">
	import PageMeta from '$lib/components/PageMeta.svelte';
	import { COMPANY } from '$lib/site';

	let { data } = $props();

	const heading = $derived(data.department ? `${data.department} roles` : 'Open roles');
</script>

<PageMeta
	title="Careers"
	description="Open engineering, security and revenue roles at {COMPANY.name}."
/>

<h1 class="text-3xl font-semibold tracking-tight">{heading}</h1>
<p class="mt-4 max-w-2xl text-slate-600">
	We hire for the shift as well as the job. Every role below has a named hiring manager and a
	two-week decision window.
</p>

<nav class="mt-8 flex flex-wrap gap-2 text-sm">
	<a
		href="/careers"
		class="rounded-full border px-3 py-1 {data.department === ''
			? 'border-slate-900 bg-slate-900 text-white'
			: 'border-slate-300 text-slate-600 hover:border-slate-900'}"
	>
		All
	</a>
	{#each data.departments as dept (dept)}
		<a
			href="/careers?department={encodeURIComponent(dept)}"
			class="rounded-full border px-3 py-1 {data.department === dept
				? 'border-slate-900 bg-slate-900 text-white'
				: 'border-slate-300 text-slate-600 hover:border-slate-900'}"
		>
			{dept}
		</a>
	{/each}
</nav>

{#if data.roles.length === 0}
	<p class="mt-10 text-slate-500">No open roles in this team right now.</p>
{:else}
	<ul class="mt-10 divide-y divide-slate-200 border-t border-slate-200">
		{#each data.roles as role (role.id)}
			<li class="py-6">
				<h2 class="text-lg font-semibold tracking-tight">
					<a href="/careers/{role.slug}" class="hover:underline">{role.title}</a>
				</h2>
				<p class="mt-1 text-sm text-slate-500">
					{role.department} &middot; {role.location} &middot; {role.employmentType}
				</p>
				{#if role.summary}
					<p class="mt-3 max-w-2xl text-slate-600">{role.summary}</p>
				{/if}
				{#if role.hiringManager}
					<p class="mt-3 text-sm text-slate-400">
						Hiring manager: {role.hiringManager.name}, {role.hiringManager.role}
					</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
