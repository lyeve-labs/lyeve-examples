/**
 * Creates the newsroom's content types, its review definition, and a desk with
 * stories at every stage of the lifecycle.
 *
 * Safe to run more than once. Applying a schema that exists is accepted, the
 * story seed stops if the desk already holds anything, the review definition is
 * created only when none of that name exists for this content type, and the
 * public-status sweep at the end is idempotent by construction.
 */
import {
	lyeveFromEnv,
	applySchemas,
	belongsTo,
	createContent,
	type LyeveClient
} from '../src/lib/lyeve/index.ts';

const client = lyeveFromEnv();

const DESKS = 'news_desks';
const REPORTERS = 'news_reporters';
const STORIES = 'news_stories';
const REVIEW_NAME = 'Newsroom review';

const IN_REVIEW_SLUG = 'night-buses-return-to-the-eastern-line';
const EMBARGOED_SLUG = 'ferry-operator-drops-the-late-crossing';

interface DeskEntry {
	id: string;
	slug: string;
	title: string;
	status: 'draft' | 'published' | 'archived';
	scheduled_publish_at?: string;
	current_rev: number;
}

interface Paginated<T> {
	data: T[];
	total_count: number;
}

interface StoryEdit {
	note: string;
	body: string;
	title?: string;
	standfirst?: string;
}

interface StorySeed {
	slug: string;
	title: string;
	desk: string;
	reporter: string;
	dateline: string;
	standfirst: string;
	body: string;
	status: 'draft' | 'published' | 'archived';
	edits?: StoryEdit[];
}

// Order matters: a relation emits a foreign key against the target's generated
// table, so the desks and the reporters must exist before the stories point at
// them.
await applySchemas(client, [
	{
		name: DESKS,
		display_name: 'Desks',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true }
		]
	},
	{
		name: REPORTERS,
		display_name: 'Reporters',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'beat', field_type: 'text' },
			{ name: 'bio', field_type: 'text' }
		]
	},
	{
		name: STORIES,
		display_name: 'Stories',
		// This flag is the reason the public read routes hide anything. It adds a
		// `_status` column to the generated table, defaulting to 'published', and
		// the list and slug reads then narrow to published rows unless the caller
		// filters on `_status` itself. Without it every draft is on the front page.
		with_draft_publish: true,
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'standfirst', field_type: 'text' },
			{ name: 'body', field_type: 'text' },
			{ name: 'dateline', field_type: 'text' },
			{ name: 'cover_media_id', field_type: 'text' },
			belongsTo('desk', DESKS),
			belongsTo('reporter', REPORTERS)
		]
	}
]);
console.log('content types ready');

/** The admin content route is the only list that sees every status. */
async function listStories(c: LyeveClient): Promise<DeskEntry[]> {
	const res = await c.request<Paginated<DeskEntry>>(
		'admin',
		`/api/admin/content?schema=${STORIES}&limit=500`
	);
	return Array.isArray(res.data) ? res.data : [];
}

async function ensureReviewDefinition(c: LyeveClient): Promise<string> {
	const existing = await c.request<Paginated<{ id: string; name: string }>>(
		'admin',
		`/api/admin/review/definitions?content_schema=${STORIES}&limit=50`
	);
	const found = (existing.data ?? []).find((d) => d.name === REVIEW_NAME);
	if (found) return found.id;

	// The stage order is the machine: an approve moves to the next stage by
	// position, and the last approve marks the assignment approved. Each
	// required role is enforced after the permission rules admit the caller.
	// An admin or super admin satisfies any of them.
	//
	// publish_on_approve is off because the plugin publishes the public status
	// column only, and the desk status is a second column it never writes. The
	// desk's publish step writes both and then moves the review to published.
	const created = await c.request<{ id: string }>('admin', '/api/admin/review/definitions', {
		method: 'POST',
		body: JSON.stringify({
			name: REVIEW_NAME,
			content_schema: STORIES,
			publish_on_approve: false,
			stages: [
				{ name: 'Desk edit', required_role: 'editor', sla_duration_seconds: 14400 },
				{ name: 'Copy desk', required_role: 'editor', sla_duration_seconds: 7200 },
				{ name: 'Managing editor', required_role: 'admin', sla_duration_seconds: 3600 }
			]
		})
	});
	console.log('review definition created with three stages');
	return created.id;
}

async function seedCollection(
	c: LyeveClient,
	schema: string,
	rows: { slug: string; title: string; [key: string]: string }[]
): Promise<Record<string, string>> {
	const ids: Record<string, string> = {};
	for (const row of rows) {
		const { title, ...body } = row;
		const created = await createContent(c, { schema, slug: row.slug, title, body });
		ids[row.slug] = created.id;
	}
	return ids;
}

async function seedStories(c: LyeveClient): Promise<void> {
	if ((await listStories(c)).length > 0) {
		console.log('stories already seeded, nothing to do');
		return;
	}

	const deskIds = await seedCollection(c, DESKS, [
		{ slug: 'politics', title: 'Politics' },
		{ slug: 'science', title: 'Science' },
		{ slug: 'business', title: 'Business' }
	]);

	const reporterIds = await seedCollection(c, REPORTERS, [
		{
			slug: 'mireille-okonjo',
			title: 'Mireille Okonjo',
			beat: 'City hall',
			bio: 'Covers the council, its committees, and the parts of the budget nobody reads.'
		},
		{
			slug: 'tomas-halvorsen',
			title: 'Tomas Halvorsen',
			beat: 'Transport and infrastructure',
			bio: 'Followed the harbour tunnel through four cost revisions and two contractors.'
		},
		{
			slug: 'ruth-anand',
			title: 'Ruth Anand',
			beat: 'Coastal science',
			bio: 'Reports on the estuary, the tide gauges, and what the long records show.'
		}
	]);

	for (const story of STORY_SEED) {
		const { id } = await createContent(c, {
			schema: STORIES,
			slug: story.slug,
			title: story.title,
			status: story.status,
			body: {
				slug: story.slug,
				standfirst: story.standfirst,
				body: story.body,
				dateline: story.dateline,
				// Relations are written under the field name and read back as
				// `<field>_id`.
				desk: deskIds[story.desk],
				reporter: reporterIds[story.reporter]
			}
		});

		// Two of the stories are given a working history so the timeline and the
		// diff have something to show. Every save is a numbered revision carrying
		// its own note, and the body is replaced rather than merged, so each edit
		// posts the whole field set.
		for (const edit of story.edits ?? []) {
			const title = edit.title ?? story.title;
			await c.request('admin', `/api/admin/content/${id}`, {
				method: 'PUT',
				body: JSON.stringify({
					schema: STORIES,
					slug: story.slug,
					title,
					change_note: edit.note,
					body: {
						title,
						slug: story.slug,
						standfirst: edit.standfirst ?? story.standfirst,
						body: edit.body,
						dateline: story.dateline,
						desk: deskIds[story.desk],
						reporter: reporterIds[story.reporter]
					}
				})
			});
		}
	}

	const edits = STORY_SEED.reduce((n, s) => n + (s.edits?.length ?? 0), 0);
	console.log(
		`seeded 3 desks, 3 reporters, ${STORY_SEED.length} stories, ${edits} further revisions`
	);
}

async function ensureReview(c: LyeveClient): Promise<void> {
	const story = (await listStories(c)).find((s) => s.slug === IN_REVIEW_SLUG);
	if (!story) return;

	const existing = await c
		.request<{ id: string }>('admin', `/api/admin/review/entries/${story.id}/assignment`)
		.catch(() => null);
	if (existing) {
		console.log('story already in review');
		return;
	}

	const definitionId = await ensureReviewDefinition(c);
	const me = await c.request<{ id: string }>('admin', '/api/admin/auth/me');

	// Creating the assignment is the submission. The plugin opens it at the first
	// stage with status pending_review and writes its own `submit` row into the
	// stage log. There is no submit action to call.
	const opened = await c.request<{ id: string }>('admin', '/api/admin/review/assignments', {
		method: 'POST',
		body: JSON.stringify({ entry_id: story.id, definition_id: definitionId, assignee_id: me.id })
	});

	await c.request('admin', `/api/admin/review/assignments/${opened.id}/transition`, {
		method: 'POST',
		body: JSON.stringify({
			action: 'approve',
			comment: 'Desk edit done. Ridership figures check out against the committee papers.'
		})
	});

	const current = await c.request<{ current_stage_id: string }>(
		'admin',
		`/api/admin/review/assignments/${opened.id}`
	);
	await c.request(
		'admin',
		`/api/admin/review/entries/${story.id}/stages/${current.current_stage_id}/comments`,
		{
			method: 'POST',
			body: JSON.stringify({
				body: 'Second paragraph needs the route number spelled out. Otherwise ready.'
			})
		}
	);

	console.log('one story submitted, approved once, and commented on');
}

async function ensureEmbargo(c: LyeveClient): Promise<void> {
	const story = (await listStories(c)).find((s) => s.slug === EMBARGOED_SLUG);
	if (!story) return;
	if (story.scheduled_publish_at) {
		console.log('embargo already set');
		return;
	}

	// The route refuses a time in the past with a 400, so this is well clear of
	// now. A background worker in the content plugin polls every thirty seconds
	// and moves the desk status when the time passes.
	const at = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
	await c.request('admin', `/api/admin/content/${story.id}/entry-schedule`, {
		method: 'PUT',
		body: JSON.stringify({ scheduled_publish_at: at, timezone: 'UTC' })
	});
	console.log(`embargo set on ${story.slug} for ${at}`);
}

/**
 * Puts each story's public status in step with its desk status.
 *
 * A story's status is two columns in two tables. The desk status lives in
 * `sys_content_entries` and is what the writes above set. The status the public
 * read routes filter on is `_status` on the generated table, and the admin write
 * mirrors the title, the slug and the body into that table without ever
 * touching it, so a story created as a draft arrives at the column default,
 * which is 'published'.
 *
 * Skipping this step leaves every seeded draft on the front page.
 */
async function alignPublicStatuses(c: LyeveClient): Promise<void> {
	const stories = await listStories(c);
	for (const story of stories) {
		const route = story.status === 'published' ? 'publish' : 'unpublish';
		await c.request('api', `/api/v1/content/${STORIES}/${story.id}/${route}`, { method: 'PUT' });
	}
	const hidden = stories.filter((s) => s.status !== 'published').length;
	console.log(
		`public status aligned for ${stories.length} stories ` +
			`(${stories.length - hidden} published, ${hidden} hidden)`
	);
}

const STORY_SEED: StorySeed[] = [
	{
		slug: 'harbour-tunnel-costs-rise-a-fourth-time',
		title: 'Harbour tunnel costs rise a fourth time',
		desk: 'business',
		reporter: 'tomas-halvorsen',
		dateline: 'Meridian Harbour',
		standfirst:
			'The revised figure is the fourth since the contract was signed, and the first the city auditor has signed off on.',
		body: 'The harbour tunnel will cost 340 million more than the figure the council approved in March, according to a revision published on Tuesday by the transport authority.\n\nIt is the fourth upward revision since the contract was signed. The three before it were issued by the contractor and disputed; this one was produced by the city auditor, whose office has held the ground survey data since January.\n\nThe authority attributes 210 million of the increase to the eastern approach, where the survey found softer ground than the original bid assumed. The remainder is split between two years of delay and a change to the ventilation design that the fire service asked for in 2024.\n\nCouncillors will vote on the revised budget at the next full meeting. The transport committee has already recommended approval, with two members recorded against.',
		status: 'published',
		edits: [
			{
				note: 'attribute the split properly, the contractor figures were not the auditor figures',
				body: 'The harbour tunnel will cost 340 million more than the figure the council approved in March, according to a revision published on Tuesday by the transport authority.\n\nIt is the fourth upward revision since the contract was signed, and the first to come from the city auditor rather than the contractor. The auditor\'s office has held the ground survey data since January.\n\nOf the increase, 210 million is attributed to the eastern approach, where the survey found softer ground than the original bid assumed. The remaining 130 million covers two years of delay and a ventilation redesign the fire service asked for in 2024.\n\nCouncillors vote on the revised budget at the next full meeting. The transport committee has recommended approval, with two members recorded against.'
			},
			{
				note: 'add the director on the record',
				body: 'The harbour tunnel will cost 340 million more than the figure the council approved in March, according to a revision published on Tuesday by the transport authority.\n\nIt is the fourth upward revision since the contract was signed, and the first to come from the city auditor rather than the contractor. The auditor\'s office has held the ground survey data since January.\n\nOf the increase, 210 million is attributed to the eastern approach, where the survey found softer ground than the original bid assumed. The remaining 130 million covers two years of delay and a ventilation redesign the fire service asked for in 2024.\n\n"We are not disputing the arithmetic," the authority\'s director said on Tuesday. "We are disputing that anyone could have known it in 2021."\n\nCouncillors vote on the revised budget at the next full meeting. The transport committee has recommended approval, with two members recorded against.'
			},
			{
				note: 'tunnel length was wrong in the standfirst, and it belongs in the body',
				standfirst:
					'The revised figure is the fourth since the contract was signed, and the first produced by the city auditor rather than the contractor.',
				body: 'The harbour tunnel will cost 340 million more than the figure the council approved in March, according to a revision published on Tuesday by the transport authority.\n\nIt is the fourth upward revision since the contract was signed, and the first to come from the city auditor rather than the contractor. The auditor\'s office has held the ground survey data since January.\n\nOf the increase, 210 million is attributed to the eastern approach, where the survey found softer ground than the original bid assumed. The remaining 130 million covers two years of delay and a ventilation redesign the fire service asked for in 2024.\n\n"We are not disputing the arithmetic," the authority\'s director said on Tuesday. "We are disputing that anyone could have known it in 2021."\n\nThe tunnel runs 4.1 kilometres between the container terminal and the northern ring road. Councillors vote on the revised budget at the next full meeting; the transport committee has recommended approval, with two members recorded against.'
			}
		]
	},
	{
		slug: 'council-votes-to-open-its-committee-papers',
		title: 'Council votes to open its committee papers',
		desk: 'politics',
		reporter: 'mireille-okonjo',
		dateline: 'City Hall',
		standfirst:
			'Papers for eleven standing committees will be published seven days before each meeting, ending a practice that dated to 1974.',
		body: 'The council voted 41 to 12 on Wednesday to publish the papers of its eleven standing committees seven days before each meeting.\n\nUntil now, committee papers were circulated to members only and released afterwards on request. The rule dated to a 1974 standing order that predates every committee it currently applies to.\n\nThe change was proposed by the audit committee after a review found that four of the eleven committees had taken decisions with financial consequences that were never separately reported to the full council.\n\nThe first papers under the new rule are due at the end of the month. The exception the motion preserves covers personnel matters and live procurement, which stay confidential until a contract is awarded.',
		status: 'published'
	},
	{
		slug: 'the-tide-gauge-that-outlived-its-harbour',
		title: 'The tide gauge that outlived its harbour',
		desk: 'science',
		reporter: 'ruth-anand',
		dateline: 'Ostmark',
		standfirst:
			'A brass float in a stone well has recorded the estuary twice a day since 1878. The result is the longest tidal record in the region, and nobody planned it.',
		body: 'The gauge at Ostmark is a brass float in a stone well, connected to a pen and a clockwork drum. It has recorded the height of the estuary twice a day since October 1878.\n\nThe harbour it was installed to serve closed in 1931. The gauge stayed because the keeper\'s cottage came with the job and the readings took twenty minutes.\n\nWhat that accident produced is the longest continuous tidal record in the region: 148 years, with two gaps totaling nine weeks.\n\nThe record matters because the trend it shows is small. Over 148 years the mean level at Ostmark has risen 21 centimetres, a signal no ten-year record could separate from ordinary variation.',
		status: 'published',
		edits: [
			{
				note: 'the gaps are annotated, which is why they can be excluded rather than filled',
				body: 'The gauge at Ostmark is a brass float in a stone well, connected to a pen and a clockwork drum. It has recorded the height of the estuary twice a day since October 1878.\n\nThe harbour it was installed to serve closed in 1931. The gauge stayed because the keeper\'s cottage came with the job and the readings took twenty minutes.\n\nWhat that accident produced is the longest continuous tidal record in the region: 148 years, with two gaps totaling nine weeks. Both fall in the winter of 1944 and both are annotated in the log in the keeper\'s own hand, which is why they can be excluded rather than interpolated.\n\nThe record matters because the trend it shows is small. Over 148 years the mean level at Ostmark has risen 21 centimetres, a signal no ten-year record could separate from ordinary variation.'
			},
			{
				note: 'name the institute and add the sensor comparison',
				body: 'The gauge at Ostmark is a brass float in a stone well, connected to a pen and a clockwork drum. It has recorded the height of the estuary twice a day since October 1878.\n\nThe harbour it was installed to serve closed in 1931. The gauge stayed because the keeper\'s cottage came with the job and the readings took twenty minutes.\n\nWhat that accident produced is the longest continuous tidal record in the region: 148 years, with two gaps totaling nine weeks. Both fall in the winter of 1944 and both are annotated in the log in the keeper\'s own hand, which is why they can be excluded rather than interpolated.\n\nThe record matters because the trend it shows is small. Over 148 years the mean level at Ostmark has risen 21 centimetres, a signal no ten-year record could separate from ordinary variation.\n\nThe coastal institute took the gauge over in 1998 and set a pressure sensor beside it. The float and the drum were kept running, and the two series have not yet disagreed by more than four millimetres.'
			}
		]
	},
	{
		slug: 'budget-hearings-move-to-the-old-assembly-room',
		title: 'Budget hearings move to the old assembly room',
		desk: 'politics',
		reporter: 'mireille-okonjo',
		dateline: 'City Hall',
		standfirst:
			'The committee room seats 40. Last year 180 people came, and the overflow stood in the corridor.',
		body: 'Next month\'s budget hearings will be held in the old assembly room rather than committee room three, after last year\'s sessions drew an audience the room could not hold.\n\nThe assembly room seats 240 and has been used for full council meetings since the chamber\'s roof was found to be unsound in 2023.\n\nThe schedule is unchanged: four evening sessions, one for each spending block, with written submissions closing a week before the first.',
		status: 'draft'
	},
	{
		slug: 'ferry-operator-drops-the-late-crossing',
		title: 'Ferry operator drops the late crossing',
		desk: 'business',
		reporter: 'tomas-halvorsen',
		dateline: 'Meridian Harbour',
		standfirst:
			'The 23:40 sailing carried an average of nine passengers. Its replacement is a bus that takes two hours longer.',
		body: 'The estuary ferry will stop running its 23:40 crossing from the first of next month, the operator confirmed, ending the last scheduled sailing after midnight.\n\nThe crossing carried an average of nine passengers over the past year, against a break-even of 34. The operator says the sailing has not covered its crew cost since the timetable was rebuilt in 2022.\n\nThe replacement is an extension of the night bus, which reaches the same landing at 01:55 by way of the ring road. The operator and the transport authority disagree about whether that counts as a replacement service, which matters because the concession requires one.',
		status: 'draft'
	},
	{
		slug: 'night-buses-return-to-the-eastern-line',
		title: 'Night buses return to the eastern line',
		desk: 'politics',
		reporter: 'mireille-okonjo',
		dateline: 'Eastmarket',
		standfirst:
			'Three years after the eastern night service was cut, the transport committee has funded it for a twelve-month trial.',
		body: 'Night buses will run on the eastern line again from March, under a twelve-month trial funded by the transport committee at its meeting on Monday.\n\nThe service was cut in 2023 as part of a package that removed four night routes. The eastern line was the busiest of the four, carrying 1,100 passengers a week at the point it stopped.\n\nThe trial restores three departures an hour between 23:00 and 04:00, at the same fare as the daytime service. Funding comes from the concession reserve, which the committee can draw on for a trial without a full council vote.\n\nWhether the service continues past the trial depends on a ridership threshold the committee has not yet published.',
		status: 'draft'
	},
	{
		slug: 'the-fish-market-that-moved-and-came-back',
		title: 'The fish market that moved and came back',
		desk: 'business',
		reporter: 'ruth-anand',
		dateline: 'Meridian Harbour',
		standfirst:
			'Eighteen months at the container terminal cost the market a third of its buyers. The move back begins on Friday.',
		body: 'The fish market returns to the harbour steps on Friday, eighteen months after it was moved to the container terminal to make room for tunnel works.\n\nThe terminal site had cold storage, parking and a covered floor. It also had a gate that closed at 15:00 and no pedestrian access, and the market lost a third of its registered buyers in the first six months.\n\nThe harbour steps have none of the terminal\'s facilities. The traders\' association asked to go back anyway, and has agreed to fund a cold store from its own levy.',
		status: 'archived'
	}
];

await ensureReviewDefinition(client);
await seedStories(client);
await ensureReview(client);
await ensureEmbargo(client);
await alignPublicStatuses(client);
