/**
 * Creates the course platform's content types and seeds the catalog.
 *
 * Safe to run more than once: applying a schema that already exists is
 * accepted, and the seed stops as soon as it finds a course.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent, uploadMedia
} from '../src/lib/lyeve/index.ts';
import { coverPng } from './cover.ts';
import { CURRICULUM } from './curriculum.ts';

const client = lyeveFromEnv();

const COURSES = 'lms_courses';
const MODULES = 'lms_modules';
const LESSONS = 'lms_lessons';
const ENROLLMENTS = 'lms_enrollments';

// Order matters twice over. A relation emits a foreign key against the target's
// generated table, so the target has to exist first, and the chain here is three
// deep: lessons reference modules, which reference courses.
//
// The position field is called sort_order rather than order because order is a
// reserved word in every dialect the engine targets. The DDL generator quotes
// identifiers, so a column named order would in fact be created, but every
// hand-written query against it afterwards becomes a quoting puzzle.
await applySchemas(client, [
	{
		name: COURSES,
		display_name: 'Courses',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'summary', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			{ name: 'level', field_type: 'text' },
			{ name: 'cover_media_id', field_type: 'text' }
		]
	},
	{
		name: MODULES,
		display_name: 'Modules',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'sort_order', field_type: 'number' },
			belongsTo('course', COURSES)
		]
	},
	{
		name: LESSONS,
		display_name: 'Lessons',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'body', field_type: 'text' },
			{ name: 'sort_order', field_type: 'number' },
			{ name: 'duration_minutes', field_type: 'number' },
			belongsTo('module', MODULES)
		]
	},
	{
		name: ENROLLMENTS,
		display_name: 'Enrollments',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'student_name', field_type: 'text' },
			{ name: 'student_email', field_type: 'email', indexed: true },
			{ name: 'progress', field_type: 'number' },
			belongsTo('course', COURSES)
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, COURSES, { limit: 25 })).length > 0) {
	console.log('catalog already seeded, nothing to do');
	process.exit(0);
}

const courseIds = new Map<string, string>();
let moduleCount = 0;
let lessonCount = 0;

for (const course of CURRICULUM) {
	const png = coverPng(960, 540, course.cover.from, course.cover.to);
	const cover = await uploadMedia(
		client,
		new Blob([new Uint8Array(png)], { type: 'image/png' }),
		`${course.slug}-cover.png`
	);

	const { id: courseId } = await createContent(client, {
		schema: COURSES,
		slug: course.slug,
		title: course.title,
		body: {
			slug: course.slug,
			summary: course.summary,
			body: course.body,
			level: course.level,
			cover_media_id: cover.id
		}
	});
	courseIds.set(course.slug, courseId);

	for (const [moduleIndex, module] of course.modules.entries()) {
		const { id: moduleId } = await createContent(client, {
			schema: MODULES,
			slug: module.slug,
			title: module.title,
			body: {
				slug: module.slug,
				sort_order: moduleIndex + 1,
				// A relation is written under its field name and read back under
				// <field>_id. See docs/VERIFIED-RECIPE.md section 6.
				course: courseId
			}
		});
		moduleCount++;

		for (const [lessonIndex, lesson] of module.lessons.entries()) {
			await createContent(client, {
				schema: LESSONS,
				slug: lesson.slug,
				title: lesson.title,
				body: {
					slug: lesson.slug,
					body: lesson.body,
					sort_order: lessonIndex + 1,
					duration_minutes: lesson.durationMinutes,
					module: moduleId
				}
			});
			lessonCount++;
		}
	}
}

// A handful of enrollments so the course page shows a real count before anyone
// uses the form. The pages only ever display the total, never the names.
const enrollments = [
	{
		course: 'relational-modeling',
		name: 'Priya Raghunathan',
		email: 'priya.raghunathan@northgate.example',
		progress: 45
	},
	{
		course: 'content-api-design',
		name: 'Tomas Lindqvist',
		email: 'tomas.lindqvist@northgate.example',
		progress: 20
	},
	{
		course: 'content-api-design',
		name: 'Amara Okonjo',
		email: 'amara.okonjo@harborline.example',
		progress: 80
	}
];

for (const enrollment of enrollments) {
	const courseId = courseIds.get(enrollment.course);
	if (!courseId) continue;
	const slug = `${enrollment.course}-${enrollment.email.split('@')[0].replace(/[^a-z0-9]+/g, '-')}`;
	await createContent(client, {
		schema: ENROLLMENTS,
		slug,
		title: enrollment.name,
		body: {
			slug,
			student_name: enrollment.name,
			student_email: enrollment.email,
			progress: enrollment.progress,
			course: courseId
		}
	});
}

console.log(
	`seeded ${CURRICULUM.length} courses, ${moduleCount} modules, ${lessonCount} lessons, ${enrollments.length} enrollments`
);
