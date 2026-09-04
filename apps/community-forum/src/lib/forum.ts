/**
 * Vocabulary and thread shaping shared by the pages and the server code.
 *
 * Nothing here touches the engine, so a component may import it. The engine
 * stores a topic's category as a plain text column and knows nothing about
 * threading, so this file is the only definition of what a valid category is
 * and the only place a tree is built.
 */

export const CATEGORIES = [
	{
		slug: 'announcements',
		label: 'Announcements',
		blurb: 'Releases and anything the maintainers need everyone to read.'
	},
	{
		slug: 'help',
		label: 'Help',
		blurb: 'Something is broken or slow and you want another pair of eyes on it.'
	},
	{
		slug: 'showcase',
		label: 'Show and tell',
		blurb: 'Racks, shelves, migrations that went well, scripts worth stealing.'
	},
	{
		slug: 'off-topic',
		label: 'Off topic',
		blurb: 'Adjacent enough to be interesting.'
	}
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
	CATEGORIES.map((c) => [c.slug, c.label])
);

export function isCategory(value: unknown): value is CategorySlug {
	return typeof value === 'string' && CATEGORIES.some((c) => c.slug === value);
}

/**
 * The decisions a moderator can make. Each writes one value of the comments
 * preset's status enum. The enum refuses anything else with a 422.
 */
export const MODERATION_ACTIONS = ['approve', 'spam', 'reject'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const ACTION_LABEL: Record<ModerationAction, string> = {
	approve: 'Approve',
	spam: 'Mark as spam',
	reject: 'Reject'
};

export function isModerationAction(value: unknown): value is ModerationAction {
	return typeof value === 'string' && (MODERATION_ACTIONS as readonly string[]).includes(value);
}

export interface TreeComment {
	id: string;
	parentId: string | null;
}

export interface ThreadNode<T extends TreeComment> {
	comment: T;
	children: ThreadNode<T>[];
	/** True when this reply names a parent the thread read did not return. */
	detached: boolean;
}

/**
 * Builds the reply tree.
 *
 * The engine returns a list, not a tree, so nesting is the client's job. It is
 * also the client's job to survive the input. `parent` is a relation with a
 * foreign key, so a parent always names a real comment, but nothing checks
 * that it is in the same thread or that a chain of edits has not made one
 * reply its own ancestor. Two shapes have to be handled rather than trusted:
 *
 * - A parent that is not in the list. Thread reads return approved comments
 *   only, so a reply whose parent is still pending arrives with a parent that
 *   is not there. It is shown at the top level and flagged, because dropping it
 *   would lose a comment a moderator has already approved.
 * - A cycle. Walking up from an unchecked parent would not terminate, so any
 *   parent whose ancestry reaches this comment is treated as absent.
 */
export function buildThreadTree<T extends TreeComment>(comments: T[]): ThreadNode<T>[] {
	const nodes = new Map<string, ThreadNode<T>>();
	const parents = new Map<string, string | null>();
	for (const comment of comments) {
		nodes.set(comment.id, { comment, children: [], detached: false });
		parents.set(comment.id, comment.parentId);
	}

	const roots: ThreadNode<T>[] = [];
	for (const comment of comments) {
		const node = nodes.get(comment.id)!;
		const parentId = comment.parentId;
		if (!parentId) {
			roots.push(node);
			continue;
		}

		const parent = nodes.get(parentId);
		if (!parent || parent === node || reachesSelf(parents, comment.id, parentId)) {
			node.detached = true;
			roots.push(node);
			continue;
		}
		parent.children.push(node);
	}
	return roots;
}

/** True when following parent links up from `from` arrives back at `id`. */
function reachesSelf(parents: Map<string, string | null>, id: string, from: string): boolean {
	const seen = new Set<string>();
	let cursor: string | null | undefined = from;
	while (cursor && !seen.has(cursor)) {
		if (cursor === id) return true;
		seen.add(cursor);
		cursor = parents.get(cursor) ?? null;
	}
	return false;
}

export interface FlatComment<T extends TreeComment> {
	comment: T;
	depth: number;
	detached: boolean;
}

/**
 * Walks the tree into the order a page renders it, carrying each reply's depth.
 *
 * A flat list with a depth number renders as a plain loop. The alternative is a
 * component that recurses, which is more code and, with a parent chain nothing
 * checks for cycles, one more place a malformed thread could not terminate.
 */
export function flattenThread<T extends TreeComment>(nodes: ThreadNode<T>[]): FlatComment<T>[] {
	const out: FlatComment<T>[] = [];
	const walk = (level: ThreadNode<T>[], depth: number) => {
		for (const node of level) {
			out.push({ comment: node.comment, depth, detached: node.detached });
			walk(node.children, depth + 1);
		}
	};
	walk(nodes, 0);
	return out;
}

/**
 * Indentation stops here. The engine imposes no depth limit, so a long chain of
 * replies would otherwise push the last one off the page.
 */
export const INDENT = ['', 'ml-6', 'ml-12', 'ml-16', 'ml-20', 'ml-24'] as const;

export function indentFor(depth: number): string {
	return INDENT[Math.min(depth, INDENT.length - 1)];
}

export function formatWhen(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Slugs are unique per tenant across every content type rather than per type,
 * and every example in this repo shares one engine and one tenant. The prefix
 * keeps the forum clear of the other apps, and the suffix keeps two topics with
 * the same title apart.
 */
export function topicSlug(title: string): string {
	const base =
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'topic';
	const prefixed = base.startsWith('forum-') ? base : `forum-${base}`;
	return `${prefixed}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Splits plain text into paragraphs on blank lines, for rendering as text. */
export function paragraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}
