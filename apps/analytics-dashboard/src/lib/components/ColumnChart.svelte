<script lang="ts">
	import { columnChart, compact, SERIES_1, type Column } from '$lib/charts';

	interface Props {
		columns: Column[];
		/** Names what is plotted. A single series needs this, not a legend box. */
		seriesLabel: string;
		valueLabel?: (column: Column) => string;
		/**
		 * Formats an axis tick. The default rounds to whole numbers, which is
		 * right for counts and wrong for a rate: a 0.2 axis maximum would print
		 * three ticks all reading zero.
		 */
		axisLabel?: (value: number) => string;
		height?: number;
	}

	let { columns, seriesLabel, valueLabel, axisLabel, height = 200 }: Props = $props();

	const geometry = $derived(columnChart(columns, 640, height));
	let hovered = $state<number | null>(null);

	const readout = $derived(hovered === null ? null : geometry.bars[hovered]);
	const format = (column: Column) => (valueLabel ? valueLabel(column) : compact(column.value));
	const tick = (value: number) => (axisLabel ? axisLabel(value) : compact(value));

	// The tallest column is the one worth a direct label. Labeling every column
	// is noise nobody reads, and the axis plus the tooltip carry the rest.
	const peak = $derived(
		geometry.bars.length === 0
			? -1
			: geometry.bars.reduce(
					(best, bar, i) => (bar.column.value > geometry.bars[best].column.value ? i : best),
					0
				)
	);
</script>

<figure class="m-0">
	<svg
		viewBox="0 0 {geometry.width} {geometry.height}"
		class="w-full"
		style="height: {geometry.height}px"
		role="img"
		aria-label="{seriesLabel}. The same values are in the table below the chart."
	>
		<!-- Gridlines are solid hairlines one step off the surface. Dashing would
		     read as a threshold when it is only a grid. -->
		{#each geometry.gridlines as line (line.y)}
			<line
				x1={geometry.plot.x}
				x2={geometry.plot.x + geometry.plot.w}
				y1={line.y}
				y2={line.y}
				stroke="#e1e0d9"
				stroke-width="1"
			/>
			<text x={geometry.plot.x - 8} y={line.y + 4} text-anchor="end" font-size="11" fill="#898781">
				{tick(line.value)}
			</text>
		{/each}

		<line
			x1={geometry.plot.x}
			x2={geometry.plot.x + geometry.plot.w}
			y1={geometry.plot.y + geometry.plot.h}
			y2={geometry.plot.y + geometry.plot.h}
			stroke="#c3c2b7"
			stroke-width="1"
		/>

		{#each geometry.bars as bar, i (bar.column.label)}
			{#if bar.column.absent}
				<!-- An hour the engine returned no row for. Drawn as a hollow floor
				     mark rather than a zero column, because the trend route omits a
				     quiet hour entirely and a flat column would claim it measured one. -->
				<line
					x1={bar.x}
					x2={bar.x + bar.w}
					y1={geometry.plot.y + geometry.plot.h}
					y2={geometry.plot.y + geometry.plot.h}
					stroke="#c3c2b7"
					stroke-width="2"
					stroke-dasharray="2 2"
				/>
			{:else if bar.h > 0}
				<!-- 4px rounded data-end, square at the baseline. -->
				<path
					d="M{bar.x} {bar.y + bar.h} L{bar.x} {bar.y + 4} Q{bar.x} {bar.y} {bar.x + 4} {bar.y} L{bar.x +
						bar.w -
						4} {bar.y} Q{bar.x + bar.w} {bar.y} {bar.x + bar.w} {bar.y + 4} L{bar.x + bar.w} {bar.y +
						bar.h} Z"
					fill={SERIES_1.light}
					opacity={hovered === null || hovered === i ? 1 : 0.55}
				/>
			{/if}

			{#if i === peak && !bar.column.absent && bar.column.value > 0}
				<text
					x={bar.x + bar.w / 2}
					y={Math.max(11, bar.y - 6)}
					text-anchor="middle"
					font-size="11"
					font-weight="600"
					fill="#0b0b0b"
				>
					{format(bar.column)}
				</text>
			{/if}

			<!-- The hit target is the whole band plus the surface gap, so the reader
			     aims at an hour rather than at a column. -->
			<rect
				x={bar.hit.x}
				y={geometry.plot.y}
				width={bar.hit.w}
				height={geometry.plot.h}
				fill="transparent"
				tabindex="0"
				role="button"
				aria-label="{bar.column.label}: {bar.column.absent ? 'no row returned' : format(bar.column)}"
				onpointerenter={() => (hovered = i)}
				onpointerleave={() => (hovered = null)}
				onfocus={() => (hovered = i)}
				onblur={() => (hovered = null)}
			/>
		{/each}

		{#each geometry.ticks as tick (tick.x)}
			<text x={tick.x} y={geometry.height - 8} text-anchor="middle" font-size="11" fill="#898781">
				{tick.label}
			</text>
		{/each}
	</svg>

	<!--
		The tooltip enhances and never gates: the peak is direct-labeled, the axis
		carries the scale, and the table below holds every value.
	-->
	<p class="mt-2 h-5 text-sm" aria-live="polite">
		{#if readout}
			<span class="font-semibold text-slate-900">
				{readout.column.absent ? 'No row returned' : format(readout.column)}
			</span>
			<span class="text-slate-500">at {readout.column.label} UTC</span>
		{:else}
			<span class="text-slate-400">{seriesLabel}</span>
		{/if}
	</p>

	<details class="mt-2">
		<summary class="cursor-pointer text-sm text-slate-500 hover:text-slate-900">Table view</summary>
		<table class="mt-2 w-full text-sm tabular-nums">
			<thead>
				<tr class="border-b border-slate-200 text-left text-slate-500">
					<th class="py-1 font-medium">Hour (UTC)</th>
					<th class="py-1 text-right font-medium">{seriesLabel}</th>
				</tr>
			</thead>
			<tbody>
				{#each geometry.bars as bar (bar.column.label)}
					<tr class="border-b border-slate-100">
						<td class="py-1">{bar.column.label}</td>
						<td class="py-1 text-right">
							{bar.column.absent ? 'no row' : format(bar.column)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>
</figure>
