/**
 * Every call this forum makes for its replies.
 *
 * Replies are content records in the `comments` type that the schema plugin's
 * comments preset creates, and votes are records in `comment_votes`. That
 * gives a reply everything a content record has: validation against the
 * type, the per-type table the read routes serve, search, and the admin UI.
 * What the preset does not carry is behavior. There is no moderation route,
 * no vote route and no anonymous submit route, so the state machine, the vote
 * upsert and the rule that a visitor's reply starts pending all live here.
 */
import { LyeveError, createContent, listContent, type ContentEntry } from '$lib/lyeve';
import { lyeve } from './lyeve';
import type { ModerationAction } from '$lib/forum';

/**
 * The type every reply names as its target.
 *
 * The comments table is shared by every app on this engine, so a reply says
 * which content type it belongs to as well as which record. The topic id
 * rather than its slug is the target, so renaming a topic cannot orphan its
 * replies. Nothing enforces the link: `target_id` is a text column with no
 * foreign key.
 */
export const TARGET_SCHEMA = 'forum_topics';

const COMMENTS = 'comments';
const VOTES = 'comment_votes';

export type CommentStatus = 'pending' | 'approved' | 'spam' | 'rejected';

/** A comment record as the read routes return its data. */
export interface CommentData {
	target_schema: string;
	target_id: string;
	parent_id: string | null;
	author_name: string | null;
	author_email: string | null;
	body: string;
	status: CommentStatus;
}

export type EngineComment = ContentEntry<CommentData>;

interface VoteData {
	comment_id: string;
	voter_key: string;
	value: number;
}

export interface Reply {
	id: string;
	parentId: string | null;
	authorName: string;
	body: string;
	score: number;
	postedAt: string;
}

/**
 * The content list ceiling. Lists clamp to 25..200, return a bare array with
 * no total, and always order newest first, so a full read pages until a short
 * page comes back.
 */
const PAGE = 200;

async function readAll<T>(schema: string, filters: Record<string, string>): Promise<ContentEntry<T>[]> {
	const rows: ContentEntry<T>[] = [];
	for (let offset = 0; ; offset += PAGE) {
		const page = await listContent<T>(lyeve, schema, { filters, limit: PAGE, offset });
		rows.push(...page);
		if (page.length < PAGE) return rows;
	}
}

const oldestFirst = (a: { created_at: string }, b: { created_at: string }) =>
	a.created_at.localeCompare(b.created_at);

/**
 * Reads one topic's approved replies, oldest first.
 *
 * Three exact-equality filters read the whole thread, with no thread route.
 * The same read with `status=pending` would show a moderator a pending reply
 * in context. This page does not, because the thread is the public view.
 */
export async function readThread(topicId: string): Promise<Reply[]> {
	const [rows, scores] = await Promise.all([
		readAll<CommentData>(COMMENTS, {
			target_schema: TARGET_SCHEMA,
			target_id: topicId,
			status: 'approved'
		}),
		readScores()
	]);
	return rows.sort(oldestFirst).map((row) => toReply(row, scores.get(row.id) ?? 0));
}

/** Every reply this forum owns, at every status. */
export async function readForumComments(): Promise<EngineComment[]> {
	return readAll<CommentData>(COMMENTS, { target_schema: TARGET_SCHEMA });
}

export interface ThreadCounts {
	approved: number;
	pending: number;
	lastPostedAt: string | null;
}

/**
 * Groups this forum's replies by topic id. Topics with no replies are absent.
 *
 * There is no count or group-by route, so a per-topic reply count is one read
 * of every reply grouped in memory. A board with real volume would keep
 * counters on the topic instead.
 */
export function countByTopic(comments: EngineComment[]): Record<string, ThreadCounts> {
	const counts: Record<string, ThreadCounts> = {};
	for (const comment of comments) {
		const topicId = comment.data.target_id;
		const entry = (counts[topicId] ??= { approved: 0, pending: 0, lastPostedAt: null });
		if (comment.data.status === 'approved') {
			entry.approved++;
			if (!entry.lastPostedAt || comment.created_at > entry.lastPostedAt) {
				entry.lastPostedAt = comment.created_at;
			}
		} else if (comment.data.status === 'pending') {
			entry.pending++;
		}
	}
	return counts;
}

/** The moderation queue: this forum's pending replies, oldest first. */
export async function moderationQueue(): Promise<EngineComment[]> {
	const rows = await readAll<CommentData>(COMMENTS, {
		target_schema: TARGET_SCHEMA,
		status: 'pending'
	});
	return rows.sort(oldestFirst);
}

/** How many replies to one topic are waiting for a moderator. */
export async function pendingCount(topicId: string): Promise<number> {
	const rows = await readAll<CommentData>(COMMENTS, {
		target_schema: TARGET_SCHEMA,
		target_id: topicId,
		status: 'pending'
	});
	return rows.length;
}

/** The status each decision writes. The preset's enum has no trashed state. */
const DECISION: Record<ModerationAction, CommentStatus> = {
	approve: 'approved',
	spam: 'spam',
	reject: 'rejected'
};

/**
 * Applies a moderation decision by rewriting the comment's status.
 *
 * The admin update replaces the record's body rather than merging into it,
 * so the write carries every field the type requires. It leaves out the
 * author's address on purpose. A read on an install running the PII masking
 * plugin returns `[redacted-email]`, which the email field refuses, and a
 * field left out of the write keeps the value its column already holds.
 */
export async function moderate(commentId: string, action: ModerationAction): Promise<void> {
	const current = await lyeve.request<EngineComment>('api', `/api/v1/content/${COMMENTS}/${commentId}`);
	const data = current.data;
	if (data.target_schema !== TARGET_SCHEMA) {
		throw new LyeveError(404, { error: 'That comment is not one of this forum.' }, 'not found');
	}
	await lyeve.request('admin', `/api/admin/content/${commentId}`, {
		method: 'PUT',
		body: JSON.stringify({
			body: {
				target_schema: data.target_schema,
				target_id: data.target_id,
				parent: data.parent_id ?? undefined,
				author_name: data.author_name ?? undefined,
				body: data.body,
				status: DECISION[action]
			}
		})
	});
}

/** Sums every vote on this engine by comment id. */
async function readScores(): Promise<Map<string, number>> {
	const votes = await readAll<VoteData>(VOTES, {});
	const scores = new Map<string, number>();
	for (const vote of votes) {
		const id = vote.data.comment_id;
		scores.set(id, (scores.get(id) ?? 0) + Number(vote.data.value ?? 0));
	}
	return scores;
}

/**
 * Casts a vote on behalf of a visitor.
 *
 * `comment_votes` stores a voter key, which is any string the caller chooses:
 * here the id in the visitor's cookie. The preset has no unique index on the
 * pair, so one vote per visitor is this function's job. It looks for the
 * visitor's earlier vote on the comment and rewrites it rather than adding a
 * second row.
 */
export async function vote(commentId: string, voterKey: string, direction: 1 | -1): Promise<void> {
	const [existing] = await listContent<VoteData>(lyeve, VOTES, {
		filters: { comment_id: commentId, voter_key: voterKey },
		limit: 25
	});
	const body = { comment: commentId, voter_key: voterKey, value: direction };
	if (existing) {
		await lyeve.request('admin', `/api/admin/content/${existing.id}`, {
			method: 'PUT',
			body: JSON.stringify({ body })
		});
		return;
	}
	await createContent(lyeve, {
		schema: VOTES,
		// A content slug is unique across every type in the tenant, so it names
		// the pair rather than being left to chance.
		slug: `forum-vote-${commentId}-${voterKey}`,
		title: 'Forum vote',
		body
	});
}

export interface SubmitReply {
	topicId: string;
	parentId: string | null;
	authorName: string;
	authorEmail: string;
	body: string;
}

export type SubmitResult = { ok: true } | { ok: false; status: number; message: string };

/** The longest reply this app accepts. The preset's body column sets no limit. */
export const MAX_BODY = 10_000;

/**
 * Stores a visitor's reply, pending.
 *
 * There is no anonymous submit route any more, so the reply is written with
 * this app's credential through the admin content route, and it is this
 * function that decides the status. It always writes `pending`: a visitor's
 * form cannot choose to be approved because nothing from the form reaches the
 * status field. The record's author in the engine is this app's administrator,
 * and `author_name` is what the visitor typed.
 */
export async function submitReply(input: SubmitReply): Promise<SubmitResult> {
	const body = input.body.trim();
	if (!body) return { ok: false, status: 400, message: 'A reply needs some text.' };
	if (body.length > MAX_BODY) {
		return { ok: false, status: 400, message: `A reply is limited to ${MAX_BODY} characters.` };
	}

	try {
		await createContent(lyeve, {
			schema: COMMENTS,
			slug: `forum-reply-${crypto.randomUUID()}`,
			title: `Reply to ${input.topicId}`,
			body: {
				target_schema: TARGET_SCHEMA,
				target_id: input.topicId,
				parent: input.parentId ?? undefined,
				author_name: input.authorName,
				author_email: input.authorEmail || undefined,
				body,
				// Required, and the preset's default is not applied to a write
				// that leaves it out: the write is refused instead.
				status: 'pending'
			}
		});
	} catch (err) {
		return {
			ok: false,
			status: err instanceof LyeveError ? err.status : 502,
			message: readableError(err, 'The reply was not accepted.')
		};
	}
	return { ok: true };
}

/** Turns a LyeveError into something a page can show without leaking driver text. */
export function readableError(err: unknown, fallback: string): string {
	if (err instanceof LyeveError) return err.fieldErrors[0]?.message ?? err.message;
	return fallback;
}

function toReply(row: EngineComment, score: number): Reply {
	return {
		id: row.id,
		parentId: row.data.parent_id ?? null,
		authorName: row.data.author_name || 'Anonymous',
		body: row.data.body,
		score,
		postedAt: row.created_at
	};
}
