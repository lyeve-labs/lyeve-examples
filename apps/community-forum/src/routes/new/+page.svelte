<script lang="ts">
	import { CATEGORIES } from '$lib/forum';

	let { form } = $props();
</script>

<svelte:head><title>Start a topic</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Start a topic</h1>
<p class="mt-2 text-slate-600">
	A topic is published straight away. Replies to it are held for a moderator.
</p>

<form method="POST" class="mt-8 rounded-lg bg-white p-6 ring-1 ring-slate-200">
	<div class="grid gap-4 sm:grid-cols-2">
		<label class="text-sm">
			<span class="text-slate-600">Your name</span>
			<input
				name="author_name"
				value={form?.authorName ?? ''}
				required
				maxlength="80"
				class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			/>
		</label>

		<label class="text-sm">
			<span class="text-slate-600">Category</span>
			<select
				name="category"
				class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
			>
				{#each CATEGORIES as category (category.slug)}
					<option value={category.slug} selected={(form?.category ?? 'help') === category.slug}>
						{category.label}
					</option>
				{/each}
			</select>
		</label>
	</div>

	<label class="mt-4 block text-sm">
		<span class="text-slate-600">Title</span>
		<input
			name="title"
			value={form?.title ?? ''}
			required
			maxlength="120"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
		/>
	</label>

	<label class="mt-4 block text-sm">
		<span class="text-slate-600">Opening post</span>
		<textarea
			name="body"
			rows="9"
			required
			maxlength="8000"
			class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
			>{form?.body ?? ''}</textarea
		>
	</label>

	{#if form?.message}
		<p class="mt-3 text-sm text-rose-600">{form.message}</p>
	{/if}

	<button
		class="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
	>
		Publish topic
	</button>
</form>
