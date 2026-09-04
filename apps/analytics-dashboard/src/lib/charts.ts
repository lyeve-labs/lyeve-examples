/**
 * Chart geometry, computed rather than delegated.
 *
 * The CSP in svelte.config.js allows scripts from self only, so no chart
 * library can be pulled from a CDN. Every chart on this dashboard is inline SVG
 * whose coordinates come from these functions, which are pure and hold no
 * engine calls, so a component and a server load can both use them.
 *
 * Marks follow one set of specs everywhere: 2px lines, columns capped at 24px
 * with a 2px surface gap, 4px rounded data-ends, hairline solid gridlines, and
 * one axis per plot. Two measures on different scales get two plots, never a
 * second y-axis.
 */

/**
 * The one categorical hue this dashboard uses for a single-series plot.
 *
 * The dark step is the same hue restepped for a dark surface rather than an
 * automatic flip. This app renders light, like every other example here, so the
 * dark value is recorded for whoever themes it and not read yet.
 */
export const SERIES_1 = { light: '#2a78d6', dark: '#3987e5' };

export interface Column {
	label: string;
	value: number;
	/** Set when the point is a padded gap rather than a measurement. */
	absent?: boolean;
}

export interface ColumnGeometry {
	width: number;
	height: number;
	plot: { x: number; y: number; w: number; h: number };
	bars: { x: number; y: number; w: number; h: number; hit: { x: number; w: number }; column: Column }[];
	/** The component formats the value, because a count and a rate want different ticks. */
	gridlines: { y: number; value: number }[];
	ticks: { x: number; label: string }[];
	max: number;
}

const AXIS_LEFT = 52;
const AXIS_BOTTOM = 28;
const PAD_TOP = 14;
const PAD_RIGHT = 12;
const MAX_BAR = 24;
const GAP = 2;

/**
 * Lays out a column chart.
 *
 * The x-axis band is inside the returned height rather than added by the
 * caller, so a fixed-height card never crops the tick labels into a nested
 * scrollbar.
 */
export function columnChart(columns: Column[], width = 640, height = 200): ColumnGeometry {
	const plot = {
		x: AXIS_LEFT,
		y: PAD_TOP,
		w: Math.max(10, width - AXIS_LEFT - PAD_RIGHT),
		h: Math.max(10, height - PAD_TOP - AXIS_BOTTOM)
	};
	const max = niceCeiling(peakOf(columns.map((c) => c.value)));
	const band = columns.length > 0 ? plot.w / columns.length : plot.w;
	const barWidth = Math.max(1, Math.min(MAX_BAR, band - GAP));

	const bars = columns.map((column, i) => {
		const h = column.absent ? 0 : Math.max(column.value > 0 ? 2 : 0, (column.value / max) * plot.h);
		const bandX = plot.x + i * band;
		return {
			x: bandX + (band - barWidth) / 2,
			y: plot.y + plot.h - h,
			w: barWidth,
			h,
			// The hit area is the whole band, not the painted bar, so a reader
			// aims at a category rather than at a few pixels of fill.
			hit: { x: bandX, w: band },
			column
		};
	});

	// Every fourth label at most, so ticks never collide on a 24 hour series.
	const step = Math.max(1, Math.ceil(columns.length / 6));
	const ticks = columns
		.map((column, i) => ({ x: plot.x + i * band + band / 2, label: column.label, i }))
		.filter((t) => t.i % step === 0)
		.map(({ x, label }) => ({ x, label }));

	return { width, height, plot, bars, gridlines: gridlines(plot, max), ticks, max };
}

export interface Bar {
	label: string;
	value: number;
	/** A secondary figure shown in the tooltip and the table twin. */
	note?: string;
}

export interface BarGeometry {
	width: number;
	height: number;
	rowHeight: number;
	labelWidth: number;
	bars: { y: number; w: number; h: number; bar: Bar }[];
	max: number;
}

/**
 * Lays out a horizontal bar chart, which is the right form for endpoint paths:
 * the labels are long and a column chart would rotate them.
 */
export function barChart(bars: Bar[], width = 640, labelWidth = 260, rowHeight = 26): BarGeometry {
	const max = peakOf(bars.map((b) => b.value));
	const track = Math.max(10, width - labelWidth - 64);
	return {
		width,
		height: Math.max(rowHeight, bars.length * rowHeight),
		rowHeight,
		labelWidth,
		max,
		bars: bars.map((bar, i) => ({
			y: i * rowHeight + (rowHeight - MAX_BAR) / 2,
			w: Math.max(bar.value > 0 ? 2 : 0, (bar.value / max) * track),
			h: MAX_BAR - GAP,
			bar
		}))
	};
}

function gridlines(plot: { y: number; h: number }, max: number) {
	return [0, 0.5, 1].map((fraction) => ({
		y: plot.y + plot.h - fraction * plot.h,
		value: max * fraction
	}));
}

/**
 * The largest value in a series, falling back to 1 only when every value is
 * zero.
 *
 * Flooring the maximum at 1 unconditionally is the tempting version and it
 * silently ruins every fractional series: an error rate peaking at 0.0018 gets
 * a 0-to-1 axis and draws as a flat line along the baseline, which reads as no
 * errors rather than as a small number of them.
 */
function peakOf(values: number[]): number {
	const max = values.length > 0 ? Math.max(...values) : 0;
	return max > 0 ? max : 1;
}

/** Rounds an axis maximum up to a clean number so the ticks read 0 / 10k / 20k. */
function niceCeiling(value: number): number {
	if (value <= 0) return 1;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	for (const step of [1, 2, 2.5, 5, 10]) {
		const candidate = step * magnitude;
		if (candidate >= value) return candidate;
	}
	return 10 * magnitude;
}

/** 1,284 / 12.9K / 4.2M, for axis ticks and stat tiles alike. */
export function compact(value: number): string {
	const n = Math.abs(value);
	if (n >= 1_000_000) return `${trim(value / 1_000_000)}M`;
	if (n >= 10_000) return `${trim(value / 1_000)}K`;
	return Math.round(value).toLocaleString('en-US');
}

function trim(value: number): string {
	return value.toFixed(1).replace(/\.0$/, '');
}

export function bytes(value: number): string {
	if (value >= 1024 ** 3) return `${trim(value / 1024 ** 3)} GB`;
	if (value >= 1024 ** 2) return `${trim(value / 1024 ** 2)} MB`;
	if (value >= 1024) return `${trim(value / 1024)} kB`;
	return `${Math.round(value)} B`;
}

export function millis(value: number): string {
	if (value >= 1000) return `${trim(value / 1000)} s`;
	if (value >= 10) return `${Math.round(value)} ms`;
	return `${trim(value)} ms`;
}

export function percent(fraction: number, digits = 2): string {
	return `${(fraction * 100).toFixed(digits)}%`;
}

/**
 * Pads an hourly series so a quiet hour is a visible gap rather than a missing
 * column.
 *
 * The trend route returns only the hours that saw traffic, so plotting its rows
 * side by side draws a continuous line across a dead hour and makes an outage
 * look like ordinary traffic.
 */
export function padHours(points: { hour: string; value: number }[], hours = 24): Column[] {
	if (points.length === 0) return [];
	const byHour = new Map<string, number>();
	for (const point of points) byHour.set(new Date(point.hour).toISOString().slice(0, 13), point.value);

	const newest = points.reduce((a, b) => (a.hour > b.hour ? a : b)).hour;
	const end = new Date(newest);
	const out: Column[] = [];
	for (let i = hours - 1; i >= 0; i--) {
		const at = new Date(end.getTime() - i * 3_600_000);
		const key = at.toISOString().slice(0, 13);
		const value = byHour.get(key);
		out.push({
			label: `${String(at.getUTCHours()).padStart(2, '0')}:00`,
			value: value ?? 0,
			absent: value === undefined
		});
	}
	return out;
}
