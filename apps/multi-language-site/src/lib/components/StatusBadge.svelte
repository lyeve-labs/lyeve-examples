<script lang="ts">
	/**
	 * The four states the plugin stores, plus the two the site adds: `missing`
	 * for a locale with no row, and `source` for text taken from the content
	 * entry because the fallback chain found nothing.
	 */
	interface Props {
		status: 'translated' | 'draft' | 'outdated' | 'source' | 'missing';
		label?: string;
	}

	let { status, label }: Props = $props();

	const styles: Record<Props['status'], string> = {
		translated: 'border-emerald-200 bg-emerald-50 text-emerald-700',
		draft: 'border-amber-200 bg-amber-50 text-amber-700',
		outdated: 'border-rose-200 bg-rose-50 text-rose-700',
		source: 'border-slate-200 bg-slate-100 text-slate-600',
		missing: 'border-dashed border-slate-300 bg-white text-slate-400'
	};
</script>

<span
	class="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium {styles[status]}"
>
	{label ?? status}
</span>
