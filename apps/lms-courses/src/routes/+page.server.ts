import { loadCatalog, totalMinutes } from '$lib/server/outline';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Three requests for the whole catalog, grouped in memory. loadCatalog
	// explains why this page takes that route and the course page does not.
	const courses = await loadCatalog();

	return {
		courses: courses.map((course) => ({
			id: course.id,
			title: course.title,
			slug: course.slug,
			summary: course.summary,
			level: course.level,
			coverId: course.coverId,
			moduleCount: course.modules.length,
			lessonCount: course.modules.reduce((n, module) => n + module.lessons.length, 0),
			minutes: totalMinutes(course)
		}))
	};
};
