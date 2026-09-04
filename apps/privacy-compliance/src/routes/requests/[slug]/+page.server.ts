import { error, fail } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import {
	assignHandler,
	fileAction,
	loadActions,
	loadOfficers,
	loadRequest,
	redactRequestSubject,
	requestIdentifier,
	setRequestState
} from '$lib/server/requests';
import {
	bundleSections,
	classifyIdentifier,
	runErase,
	runExport,
	subjectDigest
} from '$lib/server/dsar';
import { guardErase } from '$lib/server/operator';
import { isRequestState } from '$lib/desk';
import type { Actions, PageServerLoad } from './$types';

/** How much of a bundle the page renders. A large subject would otherwise fill it. */
const PREVIEW_CHARS = 6000;

export const load: PageServerLoad = async ({ params, url }) => {
	const request = await loadRequest(params.slug);
	if (!request) error(404, 'No such request');

	const [officers, actions] = await Promise.all([loadOfficers(), loadActions(request.id)]);

	const identifier = requestIdentifier(request);
	const verdict = classifyIdentifier(identifier.raw);
	const digest = verdict.value ? await subjectDigest(verdict.value) : '';

	// An erasure is only offered once an export has been run for this exact
	// subject. The digest is what makes "this exact subject" checkable: if the
	// address on the record was edited after the export, the earlier bundle no
	// longer describes what erasure would destroy, and the gate closes again.
	const priorExport = actions.find((a) => a.kind === 'export' && a.subjectDigest === digest);

	// The guard runs on the confirm step and again in the action below. This
	// call is what fills the panel. The one in the action is what decides.
	const guard = url.searchParams.get('confirm') === 'erase' ? await guardErase(verdict) : null;

	return {
		request,
		officers: officers.map((o) => ({ id: o.id, name: o.name, remit: o.remit })),
		actions,
		identifier: {
			value: verdict.value,
			source: identifier.source,
			kind: verdict.kind,
			problem: verdict.problem,
			eraseBlock: verdict.eraseBlock,
			digest
		},
		priorExport: priorExport
			? { ranAt: priorExport.ranAt, records: priorExport.recordCount, sections: priorExport.sections }
			: null,
		confirming: url.searchParams.get('confirm') === 'erase',
		guard
	};
};

export const actions: Actions = {
	assign: async ({ params, request }) => {
		const form = await request.formData();
		const officerId = String(form.get('officer_id') ?? '');
		if (!officerId) return fail(400, { op: 'assign', message: 'Pick an officer.' });

		const record = await loadRequest(params.slug);
		if (!record) return fail(404, { op: 'assign', message: 'No such request.' });

		await assignHandler(record, officerId);
		return { op: 'assign', message: 'Handler assigned.' };
	},

	state: async ({ params, request }) => {
		const form = await request.formData();
		const next = String(form.get('state') ?? '');
		const note = String(form.get('resolution_note') ?? '').trim();
		if (!isRequestState(next)) return fail(400, { op: 'state', message: 'Not a state.' });

		const record = await loadRequest(params.slug);
		if (!record) return fail(404, { op: 'state', message: 'No such request.' });

		await setRequestState(record, next, note || undefined);
		return { op: 'state', message: `Moved to ${next}.` };
	},

	/**
	 * Runs an Art. 15 export.
	 *
	 * The identifier comes from the stored record and never from the form. The
	 * form carries no identifier field at all, so there is no request shape that
	 * makes this desk export an address of the caller's choosing.
	 */
	export: async ({ params }) => {
		const record = await loadRequest(params.slug);
		if (!record) return fail(404, { op: 'export', message: 'No such request.' });

		const verdict = classifyIdentifier(requestIdentifier(record).raw);
		if (verdict.problem) return fail(400, { op: 'export', message: verdict.problem });

		let bundle;
		try {
			bundle = await runExport(verdict.value);
		} catch (err) {
			const message =
				err instanceof LyeveError ? err.message : 'The export did not run. See the server log.';
			return fail(502, { op: 'export', message });
		}

		const sections = bundleSections(bundle);
		const digest = await subjectDigest(verdict.value);

		await fileAction({
			requestId: record.id,
			requestSlug: record.slug,
			kind: 'export',
			outcome: bundle.incomplete ? 'incomplete' : 'complete',
			subjectDigest: digest,
			identifierKind: verdict.kind,
			recordCount: bundle.summary.total_records,
			sections: sections.map((s) => `${s.name}:${s.rows}`).join(' '),
			notes: bundle.incomplete
				? `${bundle.errors.length} exporter(s) failed; the bundle is short`
				: `${bundle.summary.plugins_with_data} of ${bundle.summary.plugins_queried} exporters held data`
		});

		return {
			op: 'export' as const,
			message: bundle.incomplete
				? 'The bundle is incomplete. At least one exporter failed.'
				: 'Export complete.',
			bundle: {
				identifier: bundle.identifier,
				records: bundle.summary.total_records,
				queried: bundle.summary.plugins_queried,
				withData: bundle.summary.plugins_with_data,
				incomplete: bundle.incomplete,
				scope: bundle.scope,
				matchedTenants: bundle.matched_tenants ?? [],
				errors: bundle.errors,
				sections,
				// Pretty-printed and clipped. The engine will hand over whatever
				// the subject has, and a busy account is more than a page.
				json: JSON.stringify(bundle.plugins, null, 2).slice(0, PREVIEW_CHARS)
			}
		};
	},

	/**
	 * Runs an Art. 17 erasure.
	 *
	 * Every gate is checked here, not on the page that rendered the button. The
	 * confirm panel is a URL anybody can skip, so this action re-derives the
	 * identifier from the record, re-runs the guard, and requires the operator
	 * to have typed the identifier back and to have exported it first.
	 */
	erase: async ({ params, request }) => {
		const form = await request.formData();
		const typed = String(form.get('confirm_identifier') ?? '').trim();
		const verified = form.get('identity_verified') === 'yes';

		const record = await loadRequest(params.slug);
		if (!record) return fail(404, { op: 'erase', message: 'No such request.' });

		const verdict = classifyIdentifier(requestIdentifier(record).raw);
		if (verdict.problem) return fail(400, { op: 'erase', message: verdict.problem });

		const digest = await subjectDigest(verdict.value);
		const guard = await guardErase(verdict);
		if (!guard.allowed) {
			return fail(403, { op: 'erase', message: guard.refusals.join(' ') });
		}
		if (!verified) {
			return fail(400, {
				op: 'erase',
				message: 'Confirm that the subject identity was verified. Art. 12(6) exists for this.'
			});
		}
		if (typed.toLowerCase() !== verdict.value.toLowerCase()) {
			return fail(400, {
				op: 'erase',
				message: 'The typed identifier does not match the one on the record.'
			});
		}

		const actionsFiled = await loadActions(record.id);
		if (!actionsFiled.some((a) => a.kind === 'export' && a.subjectDigest === digest)) {
			return fail(400, {
				op: 'erase',
				message:
					'Run the export first. Erasure is not reversible and nothing here records what it destroyed, so this desk will not run one against a subject whose data has never been read.'
			});
		}

		const result = await runErase(verdict.value);

		const outcome =
			result.state === 'erased'
				? 'erased'
				: result.state === 'held'
					? 'held'
					: result.state === 'partial'
						? 'partial'
						: 'not run';

		await fileAction({
			requestId: record.id,
			requestSlug: record.slug,
			kind: result.state === 'held' || result.state === 'unavailable' ? 'refusal' : 'erase',
			outcome,
			subjectDigest: digest,
			identifierKind: verdict.kind,
			rowsAffected: 'rows' in result ? result.rows : 0,
			notes:
				result.state === 'held'
					? `stopped by ${result.holds.length} legal hold(s): ${result.holds
							.map((h) => h.id)
							.join(', ')}`
					: 'message' in result
						? result.message
						: ''
		});

		// A held or unavailable run is not a completed request. Only a finished
		// erasure closes it, and a partial one stays open because the subject
		// has to be told what did not go.
		//
		// Closing it also blanks the subject on the register entry. The engine
		// erasing its own tables does nothing about the row this app wrote, and
		// a register of erasure requests is the last place a subject would
		// expect to still be named.
		if (result.state === 'erased') {
			await redactRequestSubject(
				record,
				digest,
				`erased ${result.rows} row(s); subject blanked on this record`
			);
		}

		return {
			op: 'erase' as const,
			state: result.state,
			message:
				result.state === 'erased'
					? `Erased. ${result.rows} row(s) affected.`
					: result.state === 'held'
						? `Nothing was erased. ${result.holds.length} active legal hold(s) cover this subject.`
						: result.state === 'partial'
							? `Incomplete. ${result.rows} row(s) went, and at least one eraser failed.`
							: result.message,
			rows: 'rows' in result ? result.rows : 0,
			holds: result.state === 'held' ? result.holds : []
		};
	}
};
