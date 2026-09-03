import { error, fail } from '@sveltejs/kit';
import { createContent, getContentBySlug, listContent, LyeveError } from '$lib/lyeve';
import { lyeve, COURSES, ENROLLMENTS } from '$lib/server/lyeve';
import { enrollmentCount, loadOutline, totalMinutes } from '$lib/server/outline';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const course = await loadOutline(params.slug);
	if (!course) error(404, 'No such course');

	return {
		course: {
			title: course.title,
			slug: course.slug,
			summary: course.summary,
			body: course.body,
			level: course.level,
			coverId: course.coverId
		},
		modules: course.modules.map((module) => ({
			id: module.id,
			title: module.title,
			lessons: module.lessons.map((lesson) => ({
				id: lesson.id,
				title: lesson.title,
				slug: lesson.slug,
				durationMinutes: lesson.durationMinutes
			}))
		})),
		minutes: totalMinutes(course),
		enrolled: await enrollmentCount(course.id)
	};
};

export const actions: Actions = {
	enroll: async ({ request, params }) => {
		const form = await request.formData();
		const name = String(form.get('student_name') ?? '').trim();
		const email = String(form.get('student_email') ?? '')
			.trim()
			.toLowerCase();

		if (name.length < 2) return rejected(422, name, email, 'Enter the student name.');
		if (!email) return rejected(422, name, email, 'Enter an email address.');

		const course = await getContentBySlug<{ title: string }>(lyeve, COURSES, params.slug);
		if (!course) error(404, 'No such course');

		// filters are exact equality, and several of them are combined with AND,
		// which is enough to ask whether this student already holds a place.
		const existing = await listContent(lyeve, ENROLLMENTS, {
			limit: 25,
			filters: { course_id: course.id, student_email: email }
		});
		if (existing.length > 0) {
			return rejected(409, name, email, 'That address is already enrolled on this course.');
		}

		// Two people can post the form in the same moment and the check above
		// cannot see the other one, so the slug carries a timestamp rather than
		// relying on the address alone to keep entries distinct.
		const slug = enrollmentSlug(params.slug, email);

		try {
			await createContent(lyeve, {
				schema: ENROLLMENTS,
				slug,
				title: name,
				body: {
					slug,
					student_name: name,
					// The engine validates an email field and answers a bad address
					// with a 422 carrying the field name, which is caught below.
					student_email: email,
					progress: 0,
					course: course.id
				}
			});
		} catch (err) {
			if (err instanceof LyeveError) {
				const message = err.fieldErrors.length
					? err.fieldErrors.map((fieldError) => fieldError.message).join('. ')
					: 'Could not record the enrollment. Try again shortly.';
				return rejected(err.status === 422 ? 422 : 502, name, email, message);
			}
			throw err;
		}

		return { enrolled: true, name, email, message: '' };
	}
};

// Both outcomes carry the same keys so the page can read form.message and
// form.email without narrowing a union on every access.
function rejected(status: number, name: string, email: string, message: string) {
	return fail(status, { enrolled: false, name, email, message });
}

function enrollmentSlug(courseSlug: string, email: string): string {
	const local = email
		.split('@')[0]
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `${courseSlug}-${local || 'student'}-${Date.now().toString(36)}`;
}
