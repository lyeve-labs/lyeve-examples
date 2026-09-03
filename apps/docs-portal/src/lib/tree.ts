/**
 * Turns a flat list of pages into the nested navigation a documentation site
 * needs. Nothing here talks to the engine, which is why it lives outside
 * `src/lib/server`.
 */

export interface DocPage {
	id: string;
	title: string;
	slug: string;
	order: number;
	parentId: string | null;
}

export interface DocNode extends DocPage {
	depth: number;
	children: DocNode[];
}

/**
 * Builds the page tree.
 *
 * The engine has no tree query and no sort parameter. A list request returns
 * one flat page of rows in created_at DESC order, so both the nesting and the
 * ordering are the application's job. Every parent link is resolved against
 * the rows already in hand, which keeps this to a single read instead of one
 * request per level.
 *
 * A parent id that is not in the list becomes a root. That covers a page whose
 * parent sits in another space and a page whose parent was deleted, and it is
 * what stops a broken link from hiding a page from navigation entirely.
 */
export function buildTree(pages: DocPage[]): DocNode[] {
	const byId = new Map<string, DocNode>();
	for (const page of pages) byId.set(page.id, { ...page, depth: 0, children: [] });

	const roots: DocNode[] = [];
	for (const node of byId.values()) {
		const parent = node.parentId ? byId.get(node.parentId) : undefined;
		// The self-relation is a plain nullable foreign key, so the database
		// will happily accept a page that is its own ancestor. Walking such a
		// cycle would recurse until the render gives out, so the edge that
		// closes it is dropped and the page is shown at the top level.
		if (parent && !descendsFrom(parent, node.id, byId)) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	sortBranch(roots, 0);
	return roots;
}

/** Depth-first reading order, which is what previous and next links follow. */
export function flattenTree(nodes: DocNode[]): DocNode[] {
	const out: DocNode[] = [];
	for (const node of nodes) {
		out.push(node);
		out.push(...flattenTree(node.children));
	}
	return out;
}

/** The chain from a root down to the page with this slug, inclusive. */
export function pathTo(nodes: DocNode[], slug: string): DocNode[] {
	for (const node of nodes) {
		if (node.slug === slug) return [node];
		const rest = pathTo(node.children, slug);
		if (rest.length > 0) return [node, ...rest];
	}
	return [];
}

export function neighbors(
	nodes: DocNode[],
	slug: string
): { prev: DocNode | null; next: DocNode | null } {
	const reading = flattenTree(nodes);
	const at = reading.findIndex((node) => node.slug === slug);
	if (at < 0) return { prev: null, next: null };
	return { prev: reading[at - 1] ?? null, next: reading[at + 1] ?? null };
}

function descendsFrom(node: DocNode, ancestorId: string, byId: Map<string, DocNode>): boolean {
	const seen = new Set<string>();
	let current: DocNode | undefined = node;
	while (current && !seen.has(current.id)) {
		if (current.id === ancestorId) return true;
		seen.add(current.id);
		current = current.parentId ? byId.get(current.parentId) : undefined;
	}
	return false;
}

function sortBranch(nodes: DocNode[], depth: number): void {
	nodes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
	for (const node of nodes) {
		node.depth = depth;
		sortBranch(node.children, depth + 1);
	}
}
