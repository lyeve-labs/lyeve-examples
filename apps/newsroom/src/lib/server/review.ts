import { lyeve, STORIES, REVIEW_NAME } from './lyeve';
import { isNotFound } from './stories';

/**
 * What the review plugin gives a newsroom, and what it leaves to the app.
 *
 * It gives an ordered set of stages per content type, one assignment per story
 * that walks those stages, a stage log of every move with its comment, per-stage
 * SLA tracking, and review comments. The state machine is real: the target stage
 * is derived from the stage order and never taken from the caller, and each
 * stage's `required_role` is enforced on top of the engine's permission rules.
 *
 * Three things shape the pages here.
 *
 * There is no submit action. Creating the assignment *is* the submission: the
 * store opens it at the first stage with status `pending_review` and writes a
 * `submit` row into the stage log itself.
 *
 * The last approval can publish the story, and this newsroom turns that off.
 * The plugin publishes by setting the public status column only, and the desk
 * status is a second column the plugin never writes. The desk would then call a
 * published story a draft, and reconciling would take it back down. So the
 * definition is created with `publish_on_approve: false`, an approved story is
 * published by the desk's own publish step, which writes both columns, and that
 * step then moves the assignment to `published` with the `publish` transition.
 *
 * `approved` and `published` are terminal for the stage actions. `publish` is
 * the one move from `approved`, and `unpublish` the one move back.
 */

export type ReviewStatus =
	| 'draft'
	| 'pending_review'
	| 'in_review'
	| 'changes_requested'
	| 'approved'
	| 'rejected'
	| 'published';

export type StageAction = 'approve' | 'reject' | 'request_changes';
export type TransitionAction = StageAction | 'publish' | 'unpublish';

export interface ReviewDefinition {
	id: string;
	name: string;
	slug: string;
	content_schema: string;
	publish_on_approve: boolean;
	created_at: string;
}

export interface ReviewStage {
	id: string;
	definition_id: string;
	name: string;
	position: number;
	required_role: string;
	sla_duration_seconds: number;
}

export interface Assignment {
	id: string;
	entry_id: string;
	definition_id: string;
	current_stage_id: string;
	assignee_id: string;
	assigned_by: string;
	assigned_at: string;
	status: ReviewStatus;
	due_at?: string;
	overdue: boolean;
	updated_at: string;
}

export interface StageLog {
	id: string;
	assignment_id: string;
	stage_id: string;
	from_stage_id?: string;
	action: string;
	actor_id: string;
	comment?: string;
	created_at: string;
}

export interface SlaStatus {
	stage_id: string;
	stage_name: string;
	sla_duration_seconds: number;
	entry_time: string;
	exit_time?: string;
	exceeded: boolean;
	over_seconds: number;
}

export interface ReviewComment {
	id: string;
	entry_id: string;
	stage_id: string;
	author_id: string;
	body: string;
	created_at: string;
}

interface Paginated<T> {
	data: T[];
	total_count: number;
}

/**
 * Finds this newsroom's review definition and its stages.
 *
 * Two requests, because the list route returns definitions without their
 * stages. Only `GET /api/admin/review/definitions/{id}` carries them, under
 * `{definition, stages}`.
 */
export async function readDefinition(): Promise<{
	definition: ReviewDefinition;
	stages: ReviewStage[];
} | null> {
	const list = await lyeve.request<Paginated<ReviewDefinition>>(
		'admin',
		`/api/admin/review/definitions?content_schema=${STORIES}&limit=50`
	);
	const found = (list.data ?? []).find((d) => d.name === REVIEW_NAME) ?? list.data?.[0];
	if (!found) return null;

	const full = await lyeve.request<{ definition: ReviewDefinition; stages: ReviewStage[] }>(
		'admin',
		`/api/admin/review/definitions/${found.id}`
	);
	return {
		definition: full.definition,
		stages: [...(full.stages ?? [])].sort((a, b) => a.position - b.position)
	};
}

/**
 * The assignment for one story, or null when it has never been submitted.
 *
 * The route returns the most recent assignment for the entry rather than an
 * open one, so a story sent round twice reports its second pass.
 */
export async function getAssignment(entryId: string): Promise<Assignment | null> {
	try {
		return await lyeve.request<Assignment>(
			'admin',
			`/api/admin/review/entries/${entryId}/assignment`
		);
	} catch (err) {
		if (isNotFound(err)) return null;
		throw err;
	}
}

/** The review queue. Filtering by status is exact, and an unknown value matches nothing. */
export async function listAssignments(status?: ReviewStatus): Promise<Assignment[]> {
	const q = new URLSearchParams({ limit: '100' });
	if (status) q.set('status', status);
	const res = await lyeve.request<Paginated<Assignment>>(
		'admin',
		`/api/admin/review/assignments?${q}`
	);
	return Array.isArray(res.data) ? res.data : [];
}

/** Opens a review at the first stage. The stage log records it as `submit`. */
export async function startReview(
	entryId: string,
	definitionId: string,
	assigneeId: string
): Promise<Assignment> {
	return lyeve.request<Assignment>('admin', '/api/admin/review/assignments', {
		method: 'POST',
		body: JSON.stringify({ entry_id: entryId, definition_id: definitionId, assignee_id: assigneeId })
	});
}

/**
 * Applies a transition. A stage action answers to the permission rules and then
 * to the current stage's required role. This app's credential is a super
 * admin, which satisfies both.
 */
export async function transitionAssignment(
	assignmentId: string,
	action: TransitionAction,
	comment: string
): Promise<Assignment> {
	return lyeve.request<Assignment>(
		'admin',
		`/api/admin/review/assignments/${assignmentId}/transition`,
		{ method: 'POST', body: JSON.stringify({ action, comment }) }
	);
}

/** Bare array, not a paginated envelope. */
export async function listStageLogs(assignmentId: string): Promise<StageLog[]> {
	const rows = await lyeve.request<StageLog[]>(
		'admin',
		`/api/admin/review/assignments/${assignmentId}/logs`
	);
	return Array.isArray(rows) ? rows : [];
}

/**
 * SLA per stage, computed from the stage log on every read.
 *
 * Every stage in the definition comes back, entered or not, and a stage the
 * story has not reached carries the zero time in `entry_time`. `hasEntered` is
 * the guard for that.
 */
export async function readSla(assignmentId: string): Promise<SlaStatus[]> {
	const rows = await lyeve.request<SlaStatus[]>(
		'admin',
		`/api/admin/review/assignments/${assignmentId}/sla`
	);
	return Array.isArray(rows) ? rows : [];
}

export function hasEntered(sla: SlaStatus): boolean {
	return new Date(sla.entry_time).getUTCFullYear() > 1970;
}

/**
 * Review comments on a story.
 *
 * Both comment routes are gated on the entry having an assignment, so a story
 * that has never been submitted answers 404 rather than an empty list. That is
 * an absent conversation, not a missing story, so it reads as no comments.
 */
export async function listComments(entryId: string): Promise<ReviewComment[]> {
	try {
		const rows = await lyeve.request<ReviewComment[]>(
			'admin',
			`/api/admin/review/entries/${entryId}/comments`
		);
		return Array.isArray(rows) ? rows : [];
	} catch (err) {
		if (isNotFound(err)) return [];
		throw err;
	}
}

/**
 * Files a review comment against a stage.
 *
 * The store refuses a comment on an entry with no assignment in the caller's
 * tenant, so this only works after the story has been submitted.
 */
export async function addComment(
	entryId: string,
	stageId: string,
	body: string
): Promise<ReviewComment> {
	return lyeve.request<ReviewComment>(
		'admin',
		`/api/admin/review/entries/${entryId}/stages/${stageId}/comments`,
		{ method: 'POST', body: JSON.stringify({ body }) }
	);
}

/** Names the stages an assignment has and has not reached, for the timeline. */
export function stageProgress(
	stages: ReviewStage[],
	assignment: Assignment | null
): { stage: ReviewStage; state: 'done' | 'current' | 'ahead' }[] {
	const currentIndex = assignment
		? stages.findIndex((s) => s.id === assignment.current_stage_id)
		: -1;
	return stages.map((stage, i) => ({
		stage,
		state: currentIndex < 0 || i > currentIndex ? 'ahead' : i < currentIndex ? 'done' : 'current'
	}));
}
