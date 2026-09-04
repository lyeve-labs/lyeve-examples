import { fail } from '@sveltejs/kit';
import {
	expectedPublicStatus,
	findStatusDrift,
	listDeskStories,
	readPublicStatuses,
	bodyField,
	type DeskEntry
} from '$lib/server/stories';
import { alignPublicStatus } from '$lib/server/lifecycle';
import { listAssignments, type Assignment } from '$lib/server/review';
import type { Actions, PageServerLoad } from './$types';

const DESK_STATUSES = ['draft', 'published', 'archived'] as const;

/**
 * One shape for every action result, so the page reads `form?.reconciled`
 * without narrowing a union of unrelated payloads first.
 */
interface DeskListForm {
	error?: string;
	reconciled?: number;
}

export const load: PageServerLoad = async ({ url }) => {
	const wanted = url.searchParams.get('status');
	const status = DESK_STATUSES.includes(wanted as (typeof DESK_STATUSES)[number]) ? wanted : null;

	// The unfiltered page carries every story, which is what the status counts
	// are built from. The filtered request is made only when a status is chosen,
	// so the `?status=` the admin route offers is exercised rather than
	// reimplemented here.
	const [everything, publicStatuses, assignments] = await Promise.all([
		listDeskStories(null, 500),
		readPublicStatuses(),
		listAssignments()
	]);
	const shown = status ? await listDeskStories(status, 500) : everything;

	const byEntry = new Map<string, Assignment>();
	for (const a of assignments) byEntry.set(a.entry_id, a);

	const drift = findStatusDrift(everything.data, publicStatuses);

	return {
		status,
		total: everything.total_count,
		counts: DESK_STATUSES.map((s) => ({
			status: s,
			count: everything.data.filter((e) => e.status === s).length
		})),
		rows: shown.data.map((entry) =>
			row(entry, publicStatuses.get(entry.id), byEntry.get(entry.id))
		),
		drift: drift.map(({ entry, publicStatus }) => ({
			id: entry.id,
			title: entry.title,
			deskStatus: entry.status,
			publicStatus,
			shouldBe: expectedPublicStatus(entry.status)
		}))
	};
};

function row(
	entry: DeskEntry,
	publicStatus: string | undefined,
	assignment: Assignment | undefined
) {
	return {
		id: entry.id,
		title: entry.title,
		slug: entry.slug,
		standfirst: bodyField(entry.body, 'standfirst'),
		deskStatus: entry.status,
		publicStatus: publicStatus ?? 'missing',
		aligned: publicStatus === expectedPublicStatus(entry.status),
		revision: entry.current_rev,
		embargo: entry.scheduled_publish_at ?? null,
		updatedAt: entry.updated_at,
		review: assignment ? { id: assignment.id, status: assignment.status } : null
	};
}

export const actions: Actions = {
	/**
	 * Puts every story's public status back in step with its desk status.
	 *
	 * This exists because no engine route writes both, so the two drift whenever
	 * something moves one of them: a seed that creates a draft, a scheduled
	 * publish that fires, a status changed in the admin UI.
	 */
	reconcile: async () => {
		const [everything, publicStatuses] = await Promise.all([
			listDeskStories(null, 500),
			readPublicStatuses()
		]);
		const drifted = findStatusDrift(everything.data, publicStatuses);

		for (const { entry } of drifted) {
			try {
				await alignPublicStatus(entry);
			} catch (err) {
				const why = err instanceof Error ? err.message : 'the engine refused the request';
				return fail(502, { error: `could not align ${entry.slug}: ${why}` } satisfies DeskListForm);
			}
		}
		return { reconciled: drifted.length } satisfies DeskListForm;
	}
};
