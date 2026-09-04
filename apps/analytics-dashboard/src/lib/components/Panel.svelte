<script lang="ts">
	import StateMark from './StateMark.svelte';
	import { STATE_LOOK, type Provenance } from '$lib/provenance';

	interface Props {
		title: string;
		provenance: Provenance;
		/** Rendered under the title, above the badge. */
		subtitle?: string;
		children?: import('svelte').Snippet;
	}

	let { title, provenance, subtitle, children }: Props = $props();

	const look = $derived(STATE_LOOK[provenance.state]);
</script>

<!--
	The wrapper every figure on this dashboard sits inside.

	The badge is not chrome. A panel of zeroes is either a measurement or a gap
	in the instrumentation, and the two need opposite responses from whoever is
	reading, so the panel states which one it is and names the route it came
	from. The state carries a shape and a word as well as a color, so it
	survives a colorblind reader and a grayscale print.
-->
<section class="rounded-lg border border-slate-200 bg-white">
	<header class="border-b border-slate-100 px-5 py-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<h2 class="font-semibold tracking-tight text-slate-900">{title}</h2>
				{#if subtitle}<p class="mt-1 text-sm text-slate-500">{subtitle}</p>{/if}
			</div>
			<span
				class="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium {look.className}"
				aria-label="Source state: {look.label}"
			>
				<StateMark shape={look.shape} />
				{look.label}
			</span>
		</div>

		<p class="mt-3 text-sm leading-relaxed text-slate-600">
			{provenance.detail}
		</p>
		<p class="mt-1 font-mono text-xs text-slate-400">{provenance.route}</p>
	</header>

	<div class="px-5 py-5 {look.trustworthy ? '' : 'opacity-70'}">
		{#if children}
			{@render children()}
		{/if}
	</div>
</section>
