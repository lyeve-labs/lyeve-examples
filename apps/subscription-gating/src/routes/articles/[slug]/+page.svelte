<script lang="ts">
	let { data } = $props();
	const article = $derived(data.article);

	const notice = $derived(
		{
			anonymous: {
				heading: 'The rest of this article is for members',
				detail: 'Sign in with a subscriber email to read it in full.'
			},
			not_subscribed: {
				heading: 'Your plan does not include this article',
				detail: 'Members get the full archive. Your account is on the free plan.'
			},
			payment_failed: {
				heading: 'We could not take your last payment',
				detail:
					'Your membership is on hold until the provider settles the charge. Access returns the moment it does.'
			},
			canceled: {
				heading: 'Your membership has ended',
				detail: 'You kept access until the end of the paid period. Resubscribe to pick it back up.'
			}
		}[data.refusal ?? 'anonymous']
	);
</script>

<svelte:head><title>{article.title}</title></svelte:head>

<article>
	<a href="/" class="text-sm text-slate-500 hover:underline">&larr; All articles</a>

	<div class="mt-6 flex items-center gap-2">
		{#if article.tier === 'member'}
			<span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
				Members only
			</span>
		{:else}
			<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
				Free to read
			</span>
		{/if}
		<span class="text-xs text-slate-400">
			{new Date(article.publishedAt).toLocaleDateString()}
		</span>
	</div>

	<h1 class="mt-2 text-3xl font-semibold tracking-tight">{article.title}</h1>
	{#if article.excerpt}
		<p class="mt-3 text-lg text-slate-600">{article.excerpt}</p>
	{/if}

	<div class="mt-8 space-y-4 leading-relaxed text-slate-700">
		{#each article.body.split('\n\n') as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	{#if !data.unlocked}
		<aside class="mt-10 rounded-lg border border-amber-200 bg-amber-50 p-6">
			<h2 class="font-semibold text-amber-900">{notice.heading}</h2>
			<p class="mt-1 text-sm text-amber-900">{notice.detail}</p>
			{#if article.hiddenParagraphs > 0}
				<p class="mt-3 text-sm text-amber-800">
					{article.hiddenParagraphs} more
					{article.hiddenParagraphs === 1 ? 'paragraph' : 'paragraphs'} were left on the server.
				</p>
			{/if}
			<a
				href="/account"
				class="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
			>
				Go to your account
			</a>
		</aside>
	{/if}
</article>
