import { fail } from '@sveltejs/kit';
import { isModerationAction } from '$lib/forum';
import { moderate, moderationQueue, readableError } from '$lib/server/comments';
import { loadTopics } from '$lib/server/topics';
import type { Actions, PageServerLoad } from './$types';

/** One shape for every outcome, so the page reads `form?.done` without narrowing. */
interface QueueForm {
	message?: string;
	done?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async () => {
	const [queue, topics] = await Promise.all([moderationQueue(), loadTopics()]);

	// target_id is a text column with no foreign key, so the topic a reply
	// belongs to is resolved here rather than by the engine.
	const titles = new Map(topics.map((topic) => [topic.id, { title: topic.title, slug: topic.slug }]));

	return {
		queue: queue.map((comment) => {
			const topic = titles.get(comment.data.target_id);
			return {
				id: comment.id,
				authorName: comment.data.author_name ?? 'Anonymous',
				// Shown because deciding whether a comment is spam is most of
				// what the address is for. With the PII masking plugin enabled
				// every response carries [redacted-email] here instead.
				authorEmail: comment.data.author_email,
				body: comment.data.body,
				postedAt: comment.created_at,
				isReply: Boolean(comment.data.parent_id),
				topicTitle: topic?.title ?? 'A topic that no longer exists',
				topicSlug: topic?.slug ?? null
			};
		})
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const commentId = String(form.get('comment_id') ?? '');
		const action = form.get('action');

		if (!UUID.test(commentId)) return rejected(400, { message: 'That comment id is not an id.' });
		if (!isModerationAction(action)) {
			return rejected(400, { message: 'A decision is approve, spam or reject.' });
		}

		try {
			await moderate(commentId, action);
		} catch (err) {
			return rejected(502, { message: readableError(err, 'The decision was not recorded.') });
		}

		return accepted({
			done:
				action === 'approve'
					? 'Approved. It is now visible in its thread.'
					: `Recorded as ${action === 'spam' ? 'spam' : 'rejected'}. It stays out of every thread and stays in the comments table until someone deletes it.`
		});
	}
};

const accepted = (result: QueueForm): QueueForm => result;
const rejected = (status: number, result: QueueForm) => fail(status, result);
