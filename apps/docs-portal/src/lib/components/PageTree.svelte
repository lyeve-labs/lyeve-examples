<script lang="ts">
	import type { DocNode } from '$lib/tree';

	let {
		nodes,
		spaceSlug,
		activeSlug = null
	}: { nodes: DocNode[]; spaceSlug: string; activeSlug?: string | null } = $props();
</script>

{#snippet branch(items: DocNode[])}
	<ul class="space-y-1">
		{#each items as node (node.id)}
			<li>
				<a
					href="/docs/{spaceSlug}/{node.slug}"
					class="block rounded px-2 py-1 text-sm hover:bg-slate-100 {node.slug === activeSlug
						? 'bg-slate-100 font-medium text-slate-900'
						: 'text-slate-600'}"
				>
					{node.title}
				</a>
				{#if node.children.length > 0}
					<div class="mt-1 ml-3 border-l border-slate-200 pl-2">
						{@render branch(node.children)}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{@render branch(nodes)}
