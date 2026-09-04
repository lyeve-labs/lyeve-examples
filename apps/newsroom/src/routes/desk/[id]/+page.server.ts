import { error, fail } from '@sveltejs/kit';
import { LyeveError, listContent } from '$lib/lyeve';
import { lyeve, DESKS, REPORTERS } from '$lib/server/lyeve';
import {
	bodyField,
	expectedPublicStatus,
	getDeskStory,
	getStoryForPreview
} from '$lib/server/stories';
import {
	archiveStory,
	clearEmbargo,
	publishStory,
	restoreRevision,
	saveStory,
	setEmbargo,
	unpublishStory,
	type StoryDraft
} from '$lib/server/lifecycle';
import {
	countEngineRevisions,
	diffRevisions,
	listAudit,
	listRevisions
} from '$lib/server/revisions';
import {
	addComment,
	getAssignment,
	hasEntered,
	listComments,
	listStageLogs,
	readDefinition,
	readSla,
	stageProgress,
	startReview,
	transitionAssignment,
	type SlaStatus,
	type StageAction,
	type StageLog
} from '$lib/server/review';
import { currentUser, listUsers, userLabel } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

const TRANSITIONS: StageAction[] = ['approve', 'reject', 'request_changes'];

/**
 * One shape for every action result, so the page reads `form?.published`
 * without narrowing a union of eleven unrelated payloads first.
 */
interface StoryForm {
	error?: string;
	saved?: string;
	published?: boolean;
	unpublished?: boolean;
	archived?: boolean;
	restored?: number;
	submitted?: boolean;
	transitioned?: string;
	commented?: boolean;
	embargoed?: string;
	embargoCleared?: boolean;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const entry = await getDeskStory(params.id);
	if (!entry) error(404, 'No such story');

	const [
		revisions,
		audit,
		engineRevisions,
		preview,
		review,
		assignment,
		comments,
		users,
		desks,
		reporters
	] = await Promise.all([
		listRevisions(params.id),
		listAudit(params.id),
		countEngineRevisions(params.id),
		getStoryForPreview(params.id),
		readDefinition(),
		getAssignment(params.id),
		listComments(params.id),
		listUsers(),
		listContent<{ title: string }>(lyeve, DESKS, { limit: 200 }),
		listContent<{ title: string }>(lyeve, REPORTERS, { limit: 200 })
	]);

	const [logs, sla] = assignment
		? await Promise.all([listStageLogs(assignment.id), readSla(assignment.id)])
		: [[] as StageLog[], [] as SlaStatus[]];

	// A revision number out of the query is whatever someone typed, and NaN in
	// the diff request comes back as a 400 rather than a comparison.
	const to = revisionParam(url.searchParams.get('to'), entry.current_rev);
	const from = revisionParam(url.searchParams.get('from'), Math.max(1, entry.current_rev - 1));
	const diff = revisions.length > 1 && from !== to ? await diffRevisions(params.id, from, to) : null;

	const stageNames = new Map((review?.stages ?? []).map((s) => [s.id, s.name]));

	return {
		story: {
			id: entry.id,
			slug: entry.slug,
			title: entry.title,
			standfirst: bodyField(entry.body, 'standfirst'),
			body: bodyField(entry.body, 'body'),
			dateline: bodyField(entry.body, 'dateline'),
			desk: bodyField(entry.body, 'desk'),
			reporter: bodyField(entry.body, 'reporter'),
			coverMediaId: bodyField(entry.body, 'cover_media_id'),
			deskStatus: entry.status,
			publicStatus: preview?.publicStatus ?? 'missing',
			aligned: preview?.publicStatus === expectedPublicStatus(entry.status),
			currentRev: entry.current_rev,
			embargo: entry.scheduled_publish_at ?? null,
			publishedAt: entry.published_at ?? null,
			updatedAt: entry.updated_at
		},
		desks: desks.map((d) => ({ id: d.id, title: d.data.title })),
		reporters: reporters.map((r) => ({ id: r.id, title: r.data.title })),
		revisions: revisions.map((r) => ({
			num: r.revision_num,
			title: r.title,
			status: r.status,
			note: r.change_note,
			author: userLabel(users, r.created_by),
			at: r.created_at
		})),
		audit: audit.map((a) => ({
			id: a.id,
			action: a.action,
			revision: a.revision_num,
			actor: userLabel(users, a.actor_id),
			at: a.created_at
		})),
		engineRevisions,
		diff: diff && { from: diff.from_rev, to: diff.to_rev, text: diff.diff },
		diffRange: { from, to },
		review: review && {
			name: review.definition.name,
			stages: stageProgress(review.stages, assignment).map(({ stage, state }) => ({
				id: stage.id,
				name: stage.name,
				requiredRole: stage.required_role,
				slaSeconds: stage.sla_duration_seconds,
				state
			}))
		},
		assignment: assignment && {
			id: assignment.id,
			status: assignment.status,
			assignee: userLabel(users, assignment.assignee_id),
			stage: stageNames.get(assignment.current_stage_id) ?? 'unknown stage',
			stageId: assignment.current_stage_id,
			terminal: assignment.status === 'approved' || assignment.status === 'published',
			assignedAt: assignment.assigned_at
		},
		logs: logs.map((l) => ({
			id: l.id,
			action: l.action,
			stage: stageNames.get(l.stage_id) ?? 'unknown stage',
			actor: userLabel(users, l.actor_id),
			comment: l.comment ?? '',
			at: l.created_at
		})),
		sla: sla.map((s) => ({
			stage: s.stage_name,
			budgetSeconds: s.sla_duration_seconds,
			entered: hasEntered(s) ? s.entry_time : null,
			exited: s.exit_time ?? null,
			exceeded: s.exceeded,
			overSeconds: s.over_seconds
		})),
		comments: comments.map((c) => ({
			id: c.id,
			stage: stageNames.get(c.stage_id) ?? 'unknown stage',
			author: userLabel(users, c.author_id),
			body: c.body,
			at: c.created_at
		})),
		transitions: TRANSITIONS
	};
};

function revisionParam(raw: string | null, fallback: number): number {
	const n = Number(raw);
	return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Rebuilds the whole field set, because an update replaces the body rather than merging it. */
function draftFromForm(form: FormData): StoryDraft {
	return {
		title: String(form.get('title') ?? '').trim(),
		slug: String(form.get('slug') ?? '').trim(),
		standfirst: String(form.get('standfirst') ?? '').trim(),
		body: String(form.get('body') ?? ''),
		dateline: String(form.get('dateline') ?? '').trim(),
		desk: String(form.get('desk') ?? '') || undefined,
		reporter: String(form.get('reporter') ?? '') || undefined,
		cover_media_id: String(form.get('cover_media_id') ?? '') || undefined
	};
}

const accepted = (result: StoryForm): StoryForm => result;
const rejected = (status: number, result: StoryForm) => fail(status, result);

/**
 * A rejected write comes back as a 422 carrying field errors and no top-level
 * message, and everything else as a message with a request id. The field error
 * names the field an editor can fix, so it wins when there is one.
 */
function message(err: unknown): string {
	if (!(err instanceof LyeveError)) return 'the engine refused the request';
	return err.fieldErrors[0]?.message || err.message;
}

export const actions: Actions = {
	save: async ({ params, request }) => {
		const form = await request.formData();
		const draft = draftFromForm(form);
		if (!draft.title) return rejected(400, { error: 'A story needs a headline.' });
		if (!draft.slug) return rejected(400, { error: 'A story needs a slug.' });

		const note = String(form.get('change_note') ?? '').trim() || 'desk edit';
		try {
			await saveStory(params.id, draft, note);
		} catch (err) {
			return rejected(422, { error: message(err) });
		}
		return accepted({ saved: note });
	},

	publish: async ({ params }) => {
		try {
			await publishStory(params.id, 'published from the desk');
			// An approved review moves to published with the story, so the
			// assignment says what happened. The transition sets the public
			// status again, which the line above has already done.
			const assignment = await getAssignment(params.id);
			if (assignment?.status === 'approved') {
				await transitionAssignment(assignment.id, 'publish', 'published from the desk');
			}
		} catch (err) {
			return rejected(502, { error: message(err) });
		}
		return accepted({ published: true });
	},

	unpublish: async ({ params }) => {
		try {
			await unpublishStory(params.id);
		} catch (err) {
			return rejected(502, { error: message(err) });
		}
		return accepted({ unpublished: true });
	},

	archive: async ({ params }) => {
		try {
			await archiveStory(params.id);
		} catch (err) {
			return rejected(502, { error: message(err) });
		}
		return accepted({ archived: true });
	},

	restore: async ({ params, request }) => {
		const num = Number((await request.formData()).get('revision_num'));
		if (!Number.isInteger(num) || num < 1) {
			return rejected(400, { error: 'Pick a revision.' });
		}
		try {
			await restoreRevision(params.id, num);
		} catch (err) {
			return rejected(422, { error: message(err) });
		}
		return accepted({ restored: num });
	},

	submit: async ({ params, request }) => {
		const form = await request.formData();
		const review = await readDefinition();
		if (!review) {
			return rejected(409, { error: 'No review is defined. Run `pnpm run setup`.' });
		}

		const assignee = String(form.get('assignee_id') ?? '') || (await currentUser()).id;
		try {
			await startReview(params.id, review.definition.id, assignee);
		} catch (err) {
			return rejected(502, { error: message(err) });
		}
		return accepted({ submitted: true });
	},

	transition: async ({ request }) => {
		const form = await request.formData();
		const action = String(form.get('action') ?? '') as StageAction;
		const assignmentId = String(form.get('assignment_id') ?? '');
		if (!TRANSITIONS.includes(action)) {
			return rejected(400, { error: `Unknown action ${action}.` });
		}

		try {
			await transitionAssignment(assignmentId, action, String(form.get('comment') ?? '').trim());
		} catch (err) {
			// A 409 here means the assignment reached approved or published and no
			// further stage action is accepted. A 403 names a role the caller lacks.
			return rejected(409, { error: message(err) });
		}
		return accepted({ transitioned: action });
	},

	comment: async ({ params, request }) => {
		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();
		const stageId = String(form.get('stage_id') ?? '');
		if (!body) return rejected(400, { error: 'A comment needs a body.' });

		try {
			await addComment(params.id, stageId, body);
		} catch (err) {
			return rejected(502, { error: message(err) });
		}
		return accepted({ commented: true });
	},

	embargo: async ({ params, request }) => {
		const at = String((await request.formData()).get('publish_at') ?? '');
		if (!at) return rejected(400, { error: 'Pick a date and time.' });

		const when = new Date(at);
		if (Number.isNaN(when.getTime())) {
			return rejected(400, { error: 'That is not a valid time.' });
		}
		if (when.getTime() <= Date.now()) {
			// The route enforces this too, with a 400. Catching it here says which
			// field is wrong instead of relaying a generic refusal.
			return rejected(400, { error: 'An embargo has to be in the future.' });
		}

		try {
			await setEmbargo(params.id, when.toISOString());
		} catch (err) {
			return rejected(422, { error: message(err) });
		}
		return accepted({ embargoed: when.toISOString() });
	},

	clearEmbargo: async ({ params }) => {
		try {
			await clearEmbargo(params.id);
		} catch (err) {
			return rejected(502, { error: message(err) });
		}
		return accepted({ embargoCleared: true });
	}
};
