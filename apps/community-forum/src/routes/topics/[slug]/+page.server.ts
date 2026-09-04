import { error, fail } from '@sveltejs/kit';
import { buildThreadTree, flattenThread } from '$lib/forum';
import {
	MAX_BODY,
	pendingCount,
	readThread,
	readableError,
	submitReply,
	vote
} from '$lib/server/comments';
import { loadTopic } from '$lib/server/topics';
import { visitorId } from '$lib/server/visitor';
import type { Actions, PageServerLoad } from './$types';

/**
 * One shape for both actions, so the page reads `form?.message` without
 * narrowing a union of two unrelated payloads first.
 */
interface ForumForm {
	message?: string;
	voteMessage?: string;
	posted?: boolean;
	authorName?: string;
	authorEmail?: string;
	body?: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params }) => {
	const topic = await loadTopic(params.slug);
	if (!topic) error(404, 'No such topic');

	const [replies, awaiting] = await Promise.all([readThread(topic.id), pendingCount(topic.id)]);
	// The thread arrives flat and oldest-first. Nesting is entirely the
	// client's job, and so is surviving a parent link the engine never checked.
	const thread = flattenThread(buildThreadTree(replies));

	return {
		topic: {
			title: topic.title,
			body: topic.body,
			category: topic.category,
			authorName: topic.authorName,
			pinned: topic.pinned,
			locked: topic.locked,
			startedAt: topic.startedAt
		},
		thread,
		replyCount: thread.length,
		awaiting,
		maxBody: MAX_BODY
	};
};

export const actions: Actions = {
	/**
	 * Takes a reply and stores it, pending.
	 *
	 * The form posts here rather than to the engine because the browser holds
	 * no credential and has no business holding one, and because the checks
	 * worth making are the ones the engine does not make: a closed topic, a
	 * parent that is not in this thread, an address that is not an address.
	 */
	reply: async ({ request, params }) => {
		const form = await request.formData();
		const authorName = String(form.get('author_name') ?? '').trim();
		const authorEmail = String(form.get('author_email') ?? '').trim();
		const body = String(form.get('body') ?? '').trim();
		const parentField = String(form.get('parent_id') ?? '').trim();
		// Whatever the outcome, the form comes back filled in.
		const values: ForumForm = { authorName, authorEmail, body };

		if (!authorName) {
			return rejected(400, { ...values, message: 'Tell the thread who you are.' });
		}
		if (authorEmail && !EMAIL.test(authorEmail)) {
			return rejected(400, { ...values, message: 'That email address does not look right.' });
		}
		if (!body) return rejected(400, { ...values, message: 'A reply needs some text.' });

		const topic = await loadTopic(params.slug);
		if (!topic) error(404, 'No such topic');

		// The engine has never heard of a closed topic. A comment names its
		// topic in a text column, so this is the only place the rule holds,
		// and a reply written straight to the engine would be accepted.
		if (topic.locked) {
			return rejected(403, { ...values, message: 'This topic is closed to replies.' });
		}

		// The parent relation's foreign key proves the parent is a comment,
		// not that it is in this thread or approved. An id that arrived in a
		// form is checked against this thread before it is passed on.
		let parentId: string | null = null;
		if (parentField) {
			if (!UUID.test(parentField)) {
				return rejected(400, { ...values, message: 'That reply is no longer on the page.' });
			}
			const thread = await readThread(topic.id);
			if (!thread.some((reply) => reply.id === parentField)) {
				return rejected(400, { ...values, message: 'That reply is no longer on the page.' });
			}
			parentId = parentField;
		}

		const result = await submitReply({
			topicId: topic.id,
			parentId,
			authorName,
			authorEmail,
			body
		});
		if (!result.ok) {
			return rejected(result.status === 429 ? 429 : 400, { ...values, message: result.message });
		}

		// Nothing new to show. submitReply always writes pending, so the reply
		// is real and invisible until a moderator approves it.
		return accepted({ posted: true });
	},

	/**
	 * Records a vote for the browser that sent it.
	 *
	 * The score is summed from the vote records on the next thread load, so
	 * this returns the outcome and nothing else.
	 */
	vote: async ({ request, params, cookies }) => {
		const form = await request.formData();
		const commentId = String(form.get('comment_id') ?? '');
		// The route takes exactly 1 or -1 and rejects anything else, so the
		// button's value is turned into one of those two here or not at all.
		const raw = String(form.get('direction') ?? '');
		const direction: 1 | -1 | null = raw === '1' ? 1 : raw === '-1' ? -1 : null;

		if (!UUID.test(commentId) || direction === null) {
			return rejected(400, { voteMessage: 'That vote made no sense.' });
		}

		const topic = await loadTopic(params.slug);
		if (!topic) error(404, 'No such topic');

		// Same reason as the parent check above: the id came off a page, and a
		// vote record may name any comment in the tenant, including another
		// example's.
		const thread = await readThread(topic.id);
		if (!thread.some((reply) => reply.id === commentId)) {
			return rejected(400, { voteMessage: 'That reply is no longer on the page.' });
		}

		try {
			await vote(commentId, visitorId(cookies), direction);
		} catch (err) {
			return rejected(502, { voteMessage: readableError(err, 'The vote was not recorded.') });
		}
		return accepted({});
	}
};

const accepted = (result: ForumForm): ForumForm => result;
const rejected = (status: number, result: ForumForm) => fail(status, result);
