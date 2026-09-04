<script lang="ts">
	interface Props {
		label: string;
		value: string;
		/** Shown under the value: a unit, a period, or why the value is untrustworthy. */
		note?: string;
		/** Renders the value in muted ink, for a figure the engine never fills. */
		inert?: boolean;
	}

	let { label, value, note, inert = false }: Props = $props();
</script>

<!--
	A single current value is a stat tile, not a one-bar chart.

	The value keeps the font's proportional figures. tabular-nums would give
	every digit the width of a zero, which makes a number like 121 look loose at
	this size, and nothing here needs to align vertically.
-->
<div class="rounded-lg border border-slate-200 bg-white px-4 py-3">
	<p class="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
	<p class="mt-1 text-2xl font-semibold {inert ? 'text-slate-400' : 'text-slate-900'}">{value}</p>
	{#if note}<p class="mt-1 text-xs text-slate-500">{note}</p>{/if}
</div>
