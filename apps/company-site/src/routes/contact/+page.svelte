<script lang="ts">
	import PageMeta from '$lib/components/PageMeta.svelte';
	import { COMPANY } from '$lib/site';

	let { data, form } = $props();

	const def = $derived(data.contactForm);
	const values = $derived((form?.values ?? {}) as Record<string, string>);
	const inputClass =
		'mt-2 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900';
</script>

<PageMeta
	title="Contact"
	description="Reach the {COMPANY.name} team about an evaluation, a migration or a security review."
/>

<div class="max-w-2xl">
	{#if !def}
		<h1 class="text-3xl font-semibold tracking-tight">Contact</h1>
		<p class="mt-4 text-slate-600">
			The contact form has not been provisioned yet. Run
			<code class="rounded bg-slate-100 px-1.5 py-0.5">pnpm run setup</code> in this app.
		</p>
	{:else}
		<h1 class="text-3xl font-semibold tracking-tight">{def.title}</h1>
		{#if def.description}
			<p class="mt-4 text-slate-600">{def.description}</p>
		{/if}

		{#if form?.success}
			<p class="mt-8 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
				{form.message}
			</p>
		{:else}
			{#if form?.message}
				<p class="mt-8 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-900">
					{form.message}
				</p>
			{/if}

			<!--
				A plain POST to the page's own action. No client-side enhancement, so
				the form works with JavaScript switched off, and the engine is the
				only thing validating the submission.
			-->
			<form method="POST" class="mt-8 space-y-6">
				{#each def.fields as field (field.name)}
					<div>
						<label class="block" for="field-{field.name}">
							<span class="text-sm font-medium">
								{field.label}
								{#if !field.required}<span class="font-normal text-slate-400">(optional)</span>{/if}
							</span>

							{#if field.type === 'textarea'}
								<textarea
									id="field-{field.name}"
									name={field.name}
									rows={field.rows ?? 6}
									placeholder={field.placeholder ?? ''}
									required={field.required}
									minlength={field.min_length || undefined}
									maxlength={field.max_length || undefined}
									class={inputClass}>{values[field.name] ?? ''}</textarea
								>
							{:else if field.type === 'select'}
								<select
									id="field-{field.name}"
									name={field.name}
									required={field.required}
									class={inputClass}
								>
									<option value="" disabled selected={!values[field.name]}>Choose one</option>
									{#each field.options ?? [] as option (option)}
										<option value={option} selected={values[field.name] === option}>{option}</option>
									{/each}
								</select>
							{:else}
								<input
									id="field-{field.name}"
									type={field.type === 'email' ? 'email' : 'text'}
									name={field.name}
									placeholder={field.placeholder ?? ''}
									required={field.required}
									minlength={field.min_length || undefined}
									maxlength={field.max_length || undefined}
									value={values[field.name] ?? ''}
									class={inputClass}
								/>
							{/if}
						</label>
						{#if field.help_text}
							<p class="mt-1 text-xs text-slate-500">{field.help_text}</p>
						{/if}
					</div>
				{/each}

				{#if def.honeypot}
					<!--
						The spam trap. A person never sees it and never tabs into it, so
						anything in it came from something filling every input on the
						page. The server forwards it only when it is filled, and the
						engine answers a filled trap with the ordinary success message
						while storing nothing.
					-->
					<div class="hidden" aria-hidden="true">
						<label for="field-website">Website</label>
						<input id="field-website" type="text" name="_website" tabindex="-1" autocomplete="off" />
					</div>
				{/if}

				<button
					class="rounded-md bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700"
				>
					{def.submitText}
				</button>
			</form>
		{/if}
	{/if}
</div>
