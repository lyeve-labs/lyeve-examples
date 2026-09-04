<script lang="ts">
	import { barChart, compact, SERIES_1, type Bar } from '$lib/charts';

	interface Props {
		bars: Bar[];
		seriesLabel: string;
		/** Header for the label column in the table twin. */
		categoryLabel: string;
		valueLabel?: (bar: Bar) => string;
	}

	let { bars, seriesLabel, categoryLabel, valueLabel }: Props = $props();

	const geometry = $derived(barChart(bars));
	let hovered = $state<number | null>(null);

	const format = (bar: Bar) => (valueLabel ? valueLabel(bar) : compact(bar.value));

	/**
	 * A value only goes inside the bar when it comfortably fits, measured against
	 * the rendered width rather than assumed. Otherwise it sits past the bar end.
	 * Clipping it, or hiding the overflow, crops the digits and is worse than no
	 * label at all.
	 */
	function fitsInside(width: number, text: string): boolean {
		return width > text.length * 7 + 16;
	}
</script>

<figure class="m-0">
	<svg
		viewBox="0 0 {geometry.width} {geometry.height}"
		class="w-full"
		style="height: {geometry.height}px"
		role="img"
		aria-label="{seriesLabel} by {categoryLabel}. The same values are in the table below the chart."
	>
		{#each geometry.bars as row, i (row.bar.label)}
			<text
				x={geometry.labelWidth - 10}
				y={row.y + row.h / 2 + 4}
				text-anchor="end"
				font-size="12"
				fill={hovered === i ? '#0b0b0b' : '#52514e'}
			>
				{row.bar.label.length > 38 ? `${row.bar.label.slice(0, 36)}...` : row.bar.label}
			</text>

			{#if row.w > 0}
				<path
					d="M{geometry.labelWidth} {row.y} L{geometry.labelWidth + row.w - 4} {row.y} Q{geometry.labelWidth +
						row.w} {row.y} {geometry.labelWidth + row.w} {row.y + 4} L{geometry.labelWidth + row.w} {row.y +
						row.h -
						4} Q{geometry.labelWidth + row.w} {row.y + row.h} {geometry.labelWidth + row.w - 4} {row.y +
						row.h} L{geometry.labelWidth} {row.y + row.h} Z"
					fill={SERIES_1.light}
					opacity={hovered === null || hovered === i ? 1 : 0.55}
				/>
			{/if}

			{#if fitsInside(row.w, format(row.bar))}
				<text
					x={geometry.labelWidth + row.w - 8}
					y={row.y + row.h / 2 + 4}
					text-anchor="end"
					font-size="11"
					font-weight="600"
					fill="#ffffff"
				>
					{format(row.bar)}
				</text>
			{:else}
				<text
					x={geometry.labelWidth + row.w + 8}
					y={row.y + row.h / 2 + 4}
					font-size="11"
					font-weight="600"
					fill="#0b0b0b"
				>
					{format(row.bar)}
				</text>
			{/if}

			<rect
				x="0"
				y={row.y - 1}
				width={geometry.width}
				height={geometry.rowHeight}
				fill="transparent"
				tabindex="0"
				role="button"
				aria-label="{row.bar.label}: {format(row.bar)}{row.bar.note ? `, ${row.bar.note}` : ''}"
				onpointerenter={() => (hovered = i)}
				onpointerleave={() => (hovered = null)}
				onfocus={() => (hovered = i)}
				onblur={() => (hovered = null)}
			/>
		{/each}
	</svg>

	<p class="mt-2 h-5 text-sm" aria-live="polite">
		{#if hovered !== null}
			<span class="font-semibold text-slate-900">{format(geometry.bars[hovered].bar)}</span>
			<span class="text-slate-500">
				{geometry.bars[hovered].bar.label}{geometry.bars[hovered].bar.note
					? ` · ${geometry.bars[hovered].bar.note}`
					: ''}
			</span>
		{:else}
			<span class="text-slate-400">{seriesLabel}</span>
		{/if}
	</p>

	<details class="mt-2">
		<summary class="cursor-pointer text-sm text-slate-500 hover:text-slate-900">Table view</summary>
		<div class="mt-2 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-slate-200 text-left text-slate-500">
						<th class="py-1 font-medium">{categoryLabel}</th>
						<th class="py-1 text-right font-medium">{seriesLabel}</th>
						<th class="py-1 text-right font-medium">Detail</th>
					</tr>
				</thead>
				<tbody>
					{#each geometry.bars as row (row.bar.label)}
						<tr class="border-b border-slate-100">
							<td class="py-1 font-mono text-xs break-all">{row.bar.label}</td>
							<td class="py-1 text-right tabular-nums">{format(row.bar)}</td>
							<td class="py-1 text-right tabular-nums text-slate-500">{row.bar.note ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</figure>
