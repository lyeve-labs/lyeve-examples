import { countByTopic, readForumComments } from '$lib/server/comments';
import { loadTopics, sortForBoard } from '$lib/server/topics';
import { CATEGORIES } from '$lib/forum';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Two reads, not one per topic. There is no aggregate and no count route, so
	// every reply count on this page comes out of one pass over the forum's
	// replies grouped in memory. A forum with real volume would keep the
	// counters somewhere that can answer without it.
	const [topics, comments] = await Promise.all([loadTopics(), readForumComments()]);
	const counts = countByTopic(comments);

	const rows = sortForBoard(topics).map((topic) => ({
		slug: topic.slug,
		title: topic.title,
		category: topic.category,
		authorName: topic.authorName,
		pinned: topic.pinned,
		locked: topic.locked,
		startedAt: topic.startedAt,
		excerpt: topic.body.split('\n\n')[0]?.slice(0, 180) ?? '',
		replies: counts[topic.id]?.approved ?? 0,
		pending: counts[topic.id]?.pending ?? 0,
		lastPostedAt: counts[topic.id]?.lastPostedAt ?? null
	}));

	// Grouping is the app's job: category is a text column and the engine
	// neither groups nor sorts.
	return {
		groups: CATEGORIES.map((category) => ({
			...category,
			topics: rows.filter((row) => row.category === category.slug)
		})).filter((group) => group.topics.length > 0),
		total: rows.length
	};
};
