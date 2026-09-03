<script lang="ts">
	let { data, form } = $props();
	const job = $derived(data.job);
	const company = $derived(data.company);
</script>

<svelte:head><title>{job.title}</title></svelte:head>

<article>
	<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All roles</a>

	<h1 class="mt-6 text-3xl font-semibold tracking-tight">{job.title}</h1>
	<p class="mt-2 text-slate-500">
		{company?.title ?? 'Company withheld'} · {job.location}
	</p>

	<p class="mt-4 flex flex-wrap gap-2 text-xs">
		<span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
			{job.employmentLabel}
		</span>
		<span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
			{job.salary}
		</span>
		<span class="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
			Posted {new Date(job.postedAt).toLocaleDateString()}
		</span>
	</p>

	{#if job.summary}
		<p class="mt-8 text-lg text-slate-700">{job.summary}</p>
	{/if}

	<div class="mt-6 space-y-4 leading-relaxed text-slate-700">
		{#each job.paragraphs as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	{#if company?.bio}
		<aside class="mt-10 rounded-lg bg-slate-50 p-5 text-sm text-slate-600">
			<p class="font-medium text-slate-900">About {company.title}</p>
			<p class="mt-1">{company.bio}</p>
			{#if company.website}
				<p class="mt-2">
					<a href={company.website} rel="nofollow noopener" class="underline">
						{company.website}
					</a>
				</p>
			{/if}
		</aside>
	{/if}
</article>

<section class="mt-12 border-t border-slate-200 pt-10">
	<h2 class="text-xl font-semibold tracking-tight">Apply for this role</h2>

	{#if form?.submitted}
		<div class="mt-4 rounded-lg bg-emerald-50 p-5 text-emerald-900">
			<p class="font-medium">Application received.</p>
			<p class="mt-1 text-sm">
				Your reference is {form.reference}. Your CV was uploaded to the employer's media
				library and attached to the application.
			</p>
		</div>
	{:else}
		<p class="mt-2 text-slate-600">
			Your CV is sent to this server, which passes it to the engine. PDF, DOC or DOCX, up to 4 MB.
		</p>

		{#if form?.error}
			<p class="mt-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-900">
				{form.error} Attach your CV again before resending.
			</p>
		{/if}

		<form method="POST" action="?/apply" enctype="multipart/form-data" class="mt-6 grid gap-4">
			<label class="grid gap-1">
				<span class="text-sm font-medium">Your name</span>
				<input
					name="applicant_name"
					required
					value={form?.applicant_name ?? ''}
					class="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
			</label>

			<label class="grid gap-1">
				<span class="text-sm font-medium">Email</span>
				<input
					name="applicant_email"
					type="email"
					required
					value={form?.applicant_email ?? ''}
					class="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
				/>
			</label>

			<label class="grid gap-1">
				<span class="text-sm font-medium">Why you fit the role</span>
				<textarea
					name="cover_letter"
					rows="6"
					required
					class="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
					>{form?.cover_letter ?? ''}</textarea
				>
			</label>

			<label class="grid gap-1">
				<span class="text-sm font-medium">CV</span>
				<input
					name="cv"
					type="file"
					required
					accept=".pdf,.doc,.docx,application/pdf"
					class="rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
				/>
			</label>

			<div>
				<button class="rounded-md bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700">
					Send application
				</button>
			</div>
		</form>
	{/if}
</section>
