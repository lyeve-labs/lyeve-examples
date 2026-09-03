import { getContentBySlug, listContent, relationId, type ContentEntry } from '$lib/lyeve';
import { lyeve, COURSES, MODULES, LESSONS, ENROLLMENTS } from './lyeve';

/**
 * Assembling a course outline is the one hard thing this example demonstrates,
 * so it is worth being precise about why it takes several requests.
 *
 * The engine resolves relations from the record that stores them. A lesson
 * holds module_id, so a lesson can be asked for its module with populate, and
 * depth applies the same inflation to every relation a record holds. Nothing
 * walks the other way: a course record holds no reference to its modules, so
 * no combination of populate and depth returns them.
 *
 * The other direction is reachable, just not through populate. filters[col]
 * does exact equality on any column, module_id included, so the children of a
 * parent are one filtered list away. What is missing is a set filter: a comma
 * separated list of ids returns 422 and filters[module_id][in] returns 400, so
 * the lessons of twelve modules are twelve requests, issued together.
 */

export interface Lesson {
	id: string;
	title: string;
	slug: string;
	body: string;
	order: number;
	durationMinutes: number;
	moduleId: string | null;
}

export interface Module {
	id: string;
	title: string;
	slug: string;
	order: number;
	lessons: Lesson[];
}

export interface Course {
	id: string;
	title: string;
	slug: string;
	summary: string;
	body: string;
	level: string;
	coverId: string | null;
	modules: Module[];
}

// These row shapes are type aliases rather than interfaces because an interface
// carries no index signature, and the relation helpers take a Record.
type CourseData = {
	title: string;
	slug: string;
	summary?: string;
	body?: string;
	level?: string;
	cover_media_id?: string;
};

type ModuleData = {
	title: string;
	slug: string;
	sort_order?: number;
};

type LessonData = {
	title: string;
	slug: string;
	body?: string;
	sort_order?: number;
	duration_minutes?: number;
};

// The engine clamps limit to 25..200, so 200 is the largest page any of these
// reads can ask for. A course with more than 200 modules, or a module with more
// than 200 lessons, would need paging through offset.
const PAGE = 200;

/** Loads one course with every module and lesson beneath it, in curriculum order. */
export async function loadOutline(slug: string): Promise<Course | null> {
	const courseRow = await getContentBySlug<CourseData>(lyeve, COURSES, slug);
	if (!courseRow) return null;

	const moduleRows = await listContent<ModuleData>(lyeve, MODULES, {
		limit: PAGE,
		filters: { course_id: courseRow.id }
	});

	// One request per module, in parallel. Sequential awaits here would turn a
	// twelve module course into twelve round trips end to end.
	const lessonPages = await Promise.all(
		moduleRows.map((module) =>
			listContent<LessonData>(lyeve, LESSONS, {
				limit: PAGE,
				filters: { module_id: module.id }
			})
		)
	);

	const modules = moduleRows
		.map((module, index) => toModule(module, lessonPages[index]))
		.sort(byOrder);

	return { ...toCourse(courseRow), modules };
}

/**
 * Loads the catalog.
 *
 * This is the same shape of problem as loadOutline and takes the opposite
 * approach: three requests total regardless of how many courses there are,
 * grouped in memory afterwards. It is the better trade while every module and
 * lesson fits in one page, and the wrong one the moment they do not, because a
 * truncated page here silently understates a course rather than failing.
 */
export async function loadCatalog(): Promise<Course[]> {
	const [courseRows, moduleRows, lessonRows] = await Promise.all([
		listContent<CourseData>(lyeve, COURSES, { limit: PAGE }),
		listContent<ModuleData>(lyeve, MODULES, { limit: PAGE }),
		listContent<LessonData>(lyeve, LESSONS, { limit: PAGE })
	]);

	const lessonsByModule = new Map<string, ContentEntry<LessonData>[]>();
	for (const row of lessonRows) {
		const moduleId = relationId(row.data, 'module');
		if (!moduleId) continue;
		const bucket = lessonsByModule.get(moduleId);
		if (bucket) bucket.push(row);
		else lessonsByModule.set(moduleId, [row]);
	}

	const modulesByCourse = new Map<string, Module[]>();
	for (const row of moduleRows) {
		const courseId = relationId(row.data, 'course');
		if (!courseId) continue;
		const module = toModule(row, lessonsByModule.get(row.id) ?? []);
		const bucket = modulesByCourse.get(courseId);
		if (bucket) bucket.push(module);
		else modulesByCourse.set(courseId, [module]);
	}

	return courseRows.map((row) => ({
		...toCourse(row),
		modules: (modulesByCourse.get(row.id) ?? []).sort(byOrder)
	}));
}

/**
 * Counts enrollments for a course.
 *
 * There is no count endpoint, so this is the length of a page, and a page tops
 * out at 200 rows. Only the total ever reaches a page, never the students.
 */
export async function enrollmentCount(courseId: string): Promise<number> {
	const rows = await listContent(lyeve, ENROLLMENTS, {
		limit: PAGE,
		filters: { course_id: courseId }
	});
	return rows.length;
}

export interface LessonStop extends Lesson {
	moduleTitle: string;
}

/**
 * Flattens the outline into reading order.
 *
 * Previous and next navigation crosses module boundaries, so it cannot be
 * derived from a single module. The whole course has to be in hand first, which
 * is why the lesson page loads the same outline the course page does.
 */
export function readingOrder(course: Course): LessonStop[] {
	return course.modules.flatMap((module) =>
		module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title }))
	);
}

export function totalMinutes(course: Course): number {
	return readingOrder(course).reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
}

function toCourse(row: ContentEntry<CourseData>): Omit<Course, 'modules'> {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		summary: row.data.summary ?? '',
		body: row.data.body ?? '',
		level: row.data.level ?? 'All levels',
		coverId: row.data.cover_media_id ?? null
	};
}

function toModule(row: ContentEntry<ModuleData>, lessonRows: ContentEntry<LessonData>[]): Module {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		order: row.data.sort_order ?? 0,
		lessons: lessonRows
			.map((lesson) => ({
				id: lesson.id,
				title: lesson.data.title,
				slug: lesson.data.slug,
				body: lesson.data.body ?? '',
				order: lesson.data.sort_order ?? 0,
				durationMinutes: lesson.data.duration_minutes ?? 0,
				moduleId: relationId(lesson.data, 'module')
			}))
			.sort(byOrder)
	};
}

// Rows arrive created_at DESC and the engine has no sort parameter, so
// curriculum order is restored here rather than asked for.
function byOrder(a: { order: number }, b: { order: number }): number {
	return a.order - b.order;
}
