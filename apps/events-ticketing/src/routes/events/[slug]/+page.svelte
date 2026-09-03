<script lang="ts">
	let { data, form } = $props();
	const event = $derived(data.event);
</script>

<svelte:head><title>{event.title}</title></svelte:head>

<article>
	<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All sessions</a>

	<p class="mt-6 text-xs font-medium uppercase tracking-wide text-slate-400">
		<time datetime={event.startsAt}>{event.whenLabel}</time>
	</p>
	<h1 class="mt-2 text-3xl font-semibold tracking-tight">{event.title}</h1>
	<p class="mt-2 text-slate-500">{event.venue}</p>

	{#if event.coverId}
		<img src="/media/{event.coverId}" alt="" class="mt-8 w-full rounded-lg object-cover" />
	{/if}

	{#if event.summary}
		<p class="mt-8 text-lg text-slate-700">{event.summary}</p>
	{/if}

	<div class="mt-6 space-y-4 leading-relaxed text-slate-700">
		{#each event.body.split('\n\n').filter(Boolean) as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	<section class="mt-12 rounded-lg border border-slate-200 p-6">
		<div class="flex items-baseline justify-between">
			<h2 class="text-lg font-semibold tracking-tight">Register</h2>
			<p class="text-sm {event.soldOut ? 'text-slate-900' : 'text-emerald-700'}">{event.places}</p>
		</div>
		<p class="mt-1 text-sm text-slate-500">
			{event.registered} of {event.capacity} places taken.
		</p>

		{#if form?.name && !form?.error}
			<p class="mt-5 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
				You are on the list, {form.name}. {form.remaining}
				{form.remaining === 1 ? 'place remains' : 'places remain'}.
			</p>
			{#if !form.counterUpdated}
				<p class="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
					Your place was recorded, but the counter on this page did not move. The registration
					and the count are two separate writes and nothing ties them together.
				</p>
			{/if}
		{:else if event.closed}
			<p class="mt-5 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-700">
				Registration for this session has closed.
			</p>
		{:else if event.soldOut}
			<p class="mt-5 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-700">
				Every place has gone. There is no waiting list: this example keeps a number, not a queue.
			</p>
		{:else}
			<form method="POST" class="mt-5 space-y-4">
				{#if form?.error}
					<p class="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-900">{form.error}</p>
				{/if}

				<div>
					<label class="block text-sm font-medium text-slate-700" for="name">Name</label>
					<input
						id="name"
						name="name"
						required
						maxlength="120"
						value={form?.name ?? ''}
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-slate-700" for="email">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						maxlength="200"
						value={form?.email ?? ''}
						class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
					/>
				</div>

				<button
					class="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700"
				>
					Take a place
				</button>
			</form>
		{/if}
	</section>

	{#if data.counterBehind}
		<p class="mt-6 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
			There are more sign-ups recorded here than the counter admits to. The count is a field on
			the event, updated by a read, an addition and a write, and one of those writes was lost.
		</p>
	{/if}

	{#if data.signUps.length > 0}
		<section class="mt-10">
			<h2 class="text-sm font-medium uppercase tracking-wide text-slate-400">
				Registered here ({data.signUps.length})
			</h2>
			<ul class="mt-3 divide-y divide-slate-100 text-sm">
				{#each data.signUps as signUp (signUp.id)}
					<li class="flex justify-between py-2">
						<span class="text-slate-700">{signUp.name}</span>
						<time class="text-slate-400" datetime={signUp.registeredAt}>
							{signUp.registeredLabel}
						</time>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</article>
