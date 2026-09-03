import { fail } from '@sveltejs/kit';
import {
	CONTACT_FORM,
	HONEYPOT_FIELD,
	formDefinition,
	submitForm,
	validate
} from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const def = await formDefinition(CONTACT_FORM);
	if (!def || !def.active) return { contactForm: null };

	return {
		contactForm: {
			title: def.name,
			description: def.layout.description,
			submitText: def.layout.submit_text,
			fields: def.layout.fields,
			honeypot: def.layout.honeypot
		}
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		// Re-read the definition rather than trusting the posted field names,
		// so a page rendered before an edit is checked against the form as it
		// is now.
		const def = await formDefinition(CONTACT_FORM);
		if (!def || !def.active) {
			return fail(503, {
				success: false,
				message: 'The contact form has not been provisioned yet. Run pnpm run setup.',
				values: {} as Record<string, string>
			});
		}

		const posted = await request.formData();
		const values: Record<string, string> = {};
		for (const field of def.layout.fields) {
			const raw = posted.get(field.name);
			if (typeof raw !== 'string') continue;
			const value = raw.trim();
			// An empty optional field is omitted rather than stored as "".
			if (value) values[field.name] = value;
		}

		// A filled trap is a bot. It gets the answer a person gets, and
		// nothing is written.
		const trap = posted.get(HONEYPOT_FIELD);
		if (def.layout.honeypot && typeof trap === 'string' && trap !== '') {
			return { success: true, message: def.layout.success_message, values: {} as Record<string, string> };
		}

		const problem = validate(def, values);
		if (problem) return fail(422, { success: false, message: problem, values });

		const result = await submitForm(def, values);
		if (!result.ok) return fail(result.status, { success: false, message: result.message, values });

		return { success: true, message: result.message, values: {} as Record<string, string> };
	}
};
