import { fail, redirect } from '@sveltejs/kit';
import { LyeveError } from '$lib/lyeve';
import { createRequest } from '$lib/server/requests';
import { classifyIdentifier } from '$lib/server/dsar';
import { isRequestType, RESPONSE_DAYS } from '$lib/desk';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { responseDays: RESPONSE_DAYS };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const values = {
			subjectName: String(form.get('subject_name') ?? '').trim(),
			subjectEmail: String(form.get('subject_email') ?? '').trim(),
			subjectAccountId: String(form.get('subject_account_id') ?? '').trim(),
			type: String(form.get('request_type') ?? 'access'),
			details: String(form.get('details') ?? '').trim()
		};

		if (!isRequestType(values.type)) {
			return fail(400, { ...values, message: 'Choose one of the four request types.' });
		}
		if (!values.subjectEmail && !values.subjectAccountId) {
			return fail(400, {
				...values,
				message: 'Give an email address or an account id, or there is nobody to answer.'
			});
		}

		// The identifier is checked here even though nothing is sent to the
		// engine yet. A request whose identifier the DSAR routes would refuse is
		// a request the desk cannot action, and finding that out a month later
		// is worse than saying so now.
		for (const candidate of [values.subjectEmail, values.subjectAccountId]) {
			if (!candidate) continue;
			const verdict = classifyIdentifier(candidate);
			if (verdict.problem) return fail(400, { ...values, message: verdict.problem });
		}
		if (values.subjectEmail && classifyIdentifier(values.subjectEmail).kind !== 'email') {
			return fail(400, { ...values, message: 'That email address does not look right.' });
		}
		if (
			values.subjectAccountId &&
			classifyIdentifier(values.subjectAccountId).kind !== 'account_id'
		) {
			return fail(400, {
				...values,
				message: 'An account id is a UUID. Leave it blank if you do not have one.'
			});
		}
		if (!values.details) {
			return fail(400, { ...values, message: 'Say what you are asking for.' });
		}

		let slug: string;
		try {
			slug = await createRequest({
				subjectName: values.subjectName,
				subjectEmail: values.subjectEmail.toLowerCase(),
				subjectAccountId: values.subjectAccountId.toLowerCase(),
				type: values.type,
				details: values.details
			});
		} catch (err) {
			const message =
				err instanceof LyeveError
					? (err.fieldErrors[0]?.message ?? err.message)
					: 'The request was not filed. Nothing was sent to the engine.';
			return fail(502, { ...values, message });
		}

		// The receipt says the request was filed and nothing else. It does not
		// report whether the address matched an account: an unauthenticated form
		// that answered that question is an account enumeration oracle, and this
		// app holds a super_admin credential.
		redirect(303, `/request/filed?ref=${slug}`);
	}
};
