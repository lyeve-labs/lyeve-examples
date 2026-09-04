<script lang="ts">
	/**
	 * The shape channel for a state, drawn rather than typed.
	 *
	 * The dataviz rule is that a state never rests on color alone, so every
	 * badge, severity and health tier pairs a color with a shape and a word. A
	 * shape also survives what a color does not: a colorblind reader, a
	 * grayscale print, and forced-colors mode.
	 *
	 * Drawn as SVG rather than set as a symbol character, because a character
	 * depends on the reader having the font for it and reads as decorative
	 * typography in a diff.
	 */
	interface Props {
		/** filled: good or live. hollow: real but empty. triangle: caution. cross: absent or failed. */
		shape: 'filled' | 'hollow' | 'triangle' | 'cross';
		/** Defaults to the surrounding text color. */
		color?: string;
	}

	let { shape, color = 'currentColor' }: Props = $props();
</script>

<svg viewBox="0 0 10 10" class="inline-block h-2.5 w-2.5 shrink-0 align-[-0.05em]" aria-hidden="true">
	{#if shape === 'filled'}
		<circle cx="5" cy="5" r="4" fill={color} />
	{:else if shape === 'hollow'}
		<circle cx="5" cy="5" r="3.2" fill="none" stroke={color} stroke-width="1.6" />
	{:else if shape === 'triangle'}
		<path d="M5 0.8 L9.4 8.6 H0.6 Z" fill={color} />
	{:else}
		<path
			d="M1.6 1.6 L8.4 8.4 M8.4 1.6 L1.6 8.4"
			stroke={color}
			stroke-width="1.8"
			stroke-linecap="round"
			fill="none"
		/>
	{/if}
</svg>
