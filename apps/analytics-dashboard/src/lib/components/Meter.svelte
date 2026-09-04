<script lang="ts">
	import StateMark from './StateMark.svelte';

	interface Props {
		label: string;
		/** 0 to 1. Anything above 1 is clamped for drawing and stated in the caption. */
		fraction: number;
		/** The reading in its own units, for example "3 of 10 connections". */
		caption: string;
		/** Set when the ratio is not a measurement, so the meter renders as unset. */
		unmeasured?: boolean;
	}

	let { label, fraction, caption, unmeasured = false }: Props = $props();

	const clamped = $derived(Math.max(0, Math.min(1, fraction)));

	/**
	 * The fill carries severity and the track is a lighter step of the same blue,
	 * so the state reads across the whole bar rather than only where it is
	 * filled. A severity always ships with its word, never color alone.
	 */
	const severity = $derived(
		unmeasured
			? { fill: '#b7d3f6', shape: 'hollow' as const, word: 'not measured' }
			: clamped >= 0.9
				? { fill: '#d03b3b', shape: 'cross' as const, word: 'critical' }
				: clamped >= 0.75
					? { fill: '#fab219', shape: 'triangle' as const, word: 'high' }
					: { fill: '#2a78d6', shape: 'filled' as const, word: 'normal' }
	);
</script>

<div>
	<div class="flex items-baseline justify-between gap-3">
		<p class="text-sm font-medium text-slate-700">{label}</p>
		<p class="inline-flex items-center gap-1.5 text-sm text-slate-500">
			<StateMark shape={severity.shape} color={severity.fill} />
			{severity.word}
		</p>
	</div>

	<svg
		viewBox="0 0 320 12"
		class="mt-2 w-full"
		style="height: 12px"
		role="img"
		aria-label="{label}: {caption}, {severity.word}"
	>
		<rect x="0" y="2" width="320" height="8" rx="4" fill="#e3eefb" />
		{#if clamped > 0}
			<rect x="0" y="2" width={Math.max(4, clamped * 320)} height="8" rx="4" fill={severity.fill} />
		{/if}
	</svg>

	<p class="mt-2 text-sm text-slate-600">{caption}</p>
</div>
