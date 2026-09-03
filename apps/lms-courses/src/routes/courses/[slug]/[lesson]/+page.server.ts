import { error } from '@sveltejs/kit';
import { loadOutline, readingOrder } from '$lib/server/outline';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// The whole course is loaded for a single lesson on purpose. Previous and
	// next cross module boundaries, so the neighbors of a lesson are not
	// knowable from its own module, and the engine offers no way to ask for a
	// lesson's position within a course.
	const course = await loadOutline(params.slug);
	if (!course) error(404, 'No such course');

	const lessons = readingOrder(course);
	const index = lessons.findIndex((lesson) => lesson.slug === params.lesson);
	if (index === -1) error(404, 'No such lesson');

	const lesson = lessons[index];
	const step = (offset: number) => {
		const neighbor = lessons[index + offset];
		return neighbor ? { title: neighbor.title, slug: neighbor.slug } : null;
	};

	return {
		course: { title: course.title, slug: course.slug, coverId: course.coverId },
		lesson: {
			title: lesson.title,
			body: lesson.body,
			durationMinutes: lesson.durationMinutes,
			moduleTitle: lesson.moduleTitle
		},
		position: { index: index + 1, total: lessons.length },
		previous: step(-1),
		next: step(1)
	};
};
