<script lang="ts">
	import { page } from '$app/state';
	import { COMPANY } from '$lib/site';

	interface Props {
		title: string;
		description?: string;
		/** Media id of a social preview image, served through this app's /media route. */
		imageId?: string | null;
		type?: string;
	}

	let { title, description = '', imageId = null, type = 'website' }: Props = $props();

	const fullTitle = $derived(title ? `${title} | ${COMPANY.name}` : COMPANY.name);

	// Canonical drops the query string on purpose. /careers?department=Security
	// is the same document as /careers with a filter applied, and letting each
	// filter claim its own canonical splits the page across a crawler's index.
	const canonical = $derived(new URL(page.url.pathname, page.url.origin).href);
	const image = $derived(imageId ? new URL(`/media/${imageId}`, page.url.origin).href : '');
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<link rel="canonical" href={canonical} />
	{#if description}
		<meta name="description" content={description} />
		<meta property="og:description" content={description} />
		<meta name="twitter:description" content={description} />
	{/if}
	<meta property="og:title" content={fullTitle} />
	<meta property="og:type" content={type} />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:title" content={fullTitle} />
	{#if image}
		<meta property="og:image" content={image} />
		<meta name="twitter:image" content={image} />
	{/if}
</svelte:head>
