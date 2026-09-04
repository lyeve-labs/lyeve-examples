import { fail, redirect } from '@sveltejs/kit';
import { isCategory, type CategorySlug } from '$lib/forum';
import { readableError } from '$lib/server/comments';
import { createTopic } from '$lib/server/topics';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const values = {
			authorName: String(form.get('author_name') ?? '').trim(),
			title: String(form.get('title') ?? '').trim(),
			body: String(form.get('body') ?? '').trim(),
			category: String(form.get('category') ?? 'help')
		};

		if (!values.authorName) return fail(400, { ...values, message: 'Say who is asking.' });
		if (!values.title) return fail(400, { ...values, message: 'A topic needs a title.' });
		if (!values.body) return fail(400, { ...values, message: 'Write the opening post.' });

		const category: CategorySlug = isCategory(values.category) ? values.category : 'help';

		// A topic is written through the admin content route, like every write
		// in these examples. The public content endpoint would land the row in
		// the generated table only, where search and the admin UI never see it.
		let slug: string;
		try {
			slug = await createTopic({ ...values, category });
		} catch (err) {
			return fail(502, { ...values, message: readableError(err, 'The topic was not saved.') });
		}

		redirect(303, `/topics/${slug}`);
	}
};
