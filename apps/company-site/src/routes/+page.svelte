<script lang="ts">
	import PageMeta from '$lib/components/PageMeta.svelte';
	import { COMPANY, paragraphs } from '$lib/site';

	let { data } = $props();
	const home = $derived(data.home);
</script>

<PageMeta title="" description={home?.summary ?? COMPANY.tagline} imageId={home?.heroId} />

{#if !home}
	<div class="rounded-lg border border-slate-200 bg-slate-50 p-6">
		<h1 class="text-xl font-semibold tracking-tight">Nothing provisioned yet</h1>
		<p class="mt-2 text-slate-600">
			Run <code class="rounded bg-white px-1.5 py-0.5">pnpm run setup</code> in this app to create the
			content types, define the contact form and seed the company.
		</p>
	</div>
{:else}
	<section class="max-w-3xl">
		<h1 class="text-4xl font-semibold leading-tight tracking-tight">{home.title}</h1>
		{#if home.summary}
			<p class="mt-5 text-lg text-slate-600">{home.summary}</p>
		{/if}
		<div class="mt-8 flex flex-wrap gap-3">
			<a
				href="/contact"
				class="rounded-md bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700"
			>
				Talk to an engineer
			</a>
			<a
				href="/about"
				class="rounded-md border border-slate-300 px-5 py-2.5 font-medium hover:border-slate-900"
			>
				Who we are
			</a>
		</div>
	</section>

	{#if home.heroId}
		<img
			src="/media/{home.heroId}"
			alt=""
			class="mt-12 w-full rounded-lg border border-slate-200 object-cover"
		/>
	{/if}

	{#if home.body}
		<div class="mt-14 max-w-3xl space-y-4 leading-relaxed text-slate-700">
			{#each paragraphs(home.body) as paragraph}
				<p>{paragraph}</p>
			{/each}
		</div>
	{/if}

	{#if data.featuredRoles.length > 0}
		<section class="mt-16 border-t border-slate-200 pt-10">
			<div class="flex items-baseline justify-between gap-4">
				<h2 class="text-xl font-semibold tracking-tight">We are hiring</h2>
				<a href="/careers" class="text-sm text-slate-500 hover:text-slate-900">
					All {data.openRoleCount} roles
				</a>
			</div>
			<ul class="mt-6 divide-y divide-slate-200">
				{#each data.featuredRoles as role (role.id)}
					<li class="py-4">
						<a href="/careers/{role.slug}" class="font-medium hover:underline">{role.title}</a>
						<p class="mt-1 text-sm text-slate-500">
							{role.department} &middot; {role.location} &middot; {role.employmentType}
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
{/if}
