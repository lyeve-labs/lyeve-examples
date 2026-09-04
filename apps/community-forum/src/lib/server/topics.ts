/**
 * The content half of the forum: topics are ordinary content entries.
 *
 * A topic carries the opening post and the moderator-set flags. Everything
 * below it is a plugin comment, which is why this file is short and
 * comments.ts is not.
 */
import { createContent, getContentBySlug, listContent, type ContentEntry } from '$lib/lyeve';
import { isCategory, topicSlug, type CategorySlug } from '$lib/forum';
import { lyeve, TOPICS } from './lyeve';

interface TopicFields {
	title: string;
	slug: string;
	body?: string;
	category?: string;
	author_name?: string;
	pinned?: boolean;
	locked?: boolean;
}

export interface Topic {
	id: string;
	slug: string;
	title: string;
	body: string;
	category: CategorySlug;
	authorName: string;
	pinned: boolean;
	locked: boolean;
	startedAt: string;
}

/** A content list is clamped to 25..200 rows, so this is the largest useful ask. */
const PAGE = 200;

export async function loadTopics(): Promise<Topic[]> {
	const rows: ContentEntry<TopicFields>[] = [];
	for (let offset = 0; ; offset += PAGE) {
		// A list response is a bare array with no total and no has_more, so a
		// short page is the only signal that the data ran out.
		const page = await listContent<TopicFields>(lyeve, TOPICS, { limit: PAGE, offset });
		rows.push(...page);
		if (page.length < PAGE) break;
	}
	return rows.map(toTopic);
}

export async function loadTopic(slug: string): Promise<Topic | null> {
	// There is no get-by-slug route, so a slug lookup is a filtered list of one.
	const row = await getContentBySlug<TopicFields>(lyeve, TOPICS, slug);
	return row ? toTopic(row) : null;
}

export interface NewTopic {
	title: string;
	body: string;
	category: CategorySlug;
	authorName: string;
}

export async function createTopic(input: NewTopic): Promise<string> {
	const slug = topicSlug(input.title);
	await createContent(lyeve, {
		schema: TOPICS,
		slug,
		title: input.title,
		body: {
			slug,
			body: input.body,
			category: input.category,
			author_name: input.authorName,
			// The engine accepts a field default and then never emits one, so
			// every value a row should start with is written here.
			pinned: false,
			locked: false
		}
	});
	return slug;
}

/**
 * Newest first inside each category, with pinned topics held at the top.
 *
 * The engine has no sort parameter: rows arrive created_at DESC and that is the
 * only order on offer, so anything else is applied here.
 */
export function sortForBoard(topics: Topic[]): Topic[] {
	return [...topics].sort(
		(a, b) =>
			Number(b.pinned) - Number(a.pinned) || Date.parse(b.startedAt) - Date.parse(a.startedAt)
	);
}

function toTopic(row: ContentEntry<TopicFields>): Topic {
	const d = row.data;
	return {
		id: row.id,
		slug: d.slug,
		title: d.title,
		body: d.body ?? '',
		category: isCategory(d.category) ? d.category : 'off-topic',
		authorName: d.author_name || 'A member',
		pinned: d.pinned === true,
		locked: d.locked === true,
		startedAt: row.created_at
	};
}
