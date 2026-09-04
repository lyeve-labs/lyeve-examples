import { listContent, related, relationId, search } from '$lib/lyeve';
import type { ContentEntry } from '$lib/lyeve';
import { lyeve, AUTHORS, PAGES, POSTS } from '$lib/server/lyeve';
import {
	readRun, readCheckpoint, readStageText, parseDryRun, parseMigration
} from '$lib/server/reports';
import type { Checkpoint, MigrationSummary } from '$lib/server/reports';
import type { PageServerLoad } from './$types';

interface PostRow {
	title: string;
	slug: string;
	legacy_id?: string;
	standfirst?: string;
	section?: string;
	published_at?: string;
}

interface PageRow {
	title: string;
	slug: string;
	legacy_id?: string;
}

/** The list route has no total, so a count is a walk until a short page. */
async function countAll<T>(schema: string, populate?: string[]): Promise<ContentEntry<T>[]> {
	const all: ContentEntry<T>[] = [];
	for (let offset = 0; ; offset += 200) {
		const rows = await listContent<T>(lyeve, schema, { limit: 200, offset, populate });
		all.push(...rows);
		if (rows.length < 200) break;
	}
	return all;
}

// A word from a migrated body, and a word from the one page written through the
// admin route. The pair is the whole demonstration: same index, same query
// shape, and only one of them is findable.
const MIGRATED_QUERY = 'bus lanes';
const CONTROL_QUERY = 'migration notes';

export const load: PageServerLoad = async () => {
	const [run, posts, pages, authors] = await Promise.all([
		readRun(),
		countAll<PostRow>(POSTS, ['author']),
		countAll<PageRow>(PAGES),
		countAll<{ title: string; slug: string; role?: string; legacy_id?: string }>(AUTHORS)
	]);

	const dryRunText = await readStageText('dry-run.txt');
	const stageFiles = [
		{ name: 'authors-and-pages', label: 'Authors and pages', file: 'migrate-authors-and-pages.txt' },
		{ name: 'posts', label: 'Posts, with resolved bylines', file: 'migrate-posts.txt' }
	];

	const stages: {
		name: string;
		label: string;
		file: string;
		text: string | null;
		summary: MigrationSummary | null;
		checkpoint: Checkpoint | null;
	}[] = [];
	for (const stage of stageFiles) {
		const text = await readStageText(stage.file);
		stages.push({
			...stage,
			text,
			summary: text ? parseMigration(text) : null,
			checkpoint: await readCheckpoint(`checkpoint-${stage.name}.json`)
		});
	}

	const [migratedHits, controlHits] = await Promise.all([
		search(lyeve, MIGRATED_QUERY, { schema: POSTS, limit: 20 }),
		search(lyeve, CONTROL_QUERY, { schema: PAGES, limit: 20 })
	]);

	return {
		run,
		dryRun: dryRunText ? { text: dryRunText, summary: parseDryRun(dryRunText) } : null,
		stages,
		counts: {
			authors: authors.length,
			posts: posts.length,
			pagesFromExport: pages.filter((p) => p.data.legacy_id).length,
			pagesAuthoredInLyeve: pages.filter((p) => !p.data.legacy_id).length,
			postsWithoutAuthor: posts.filter((p) => !relationId(p.data, 'author')).length
		},
		visibility: {
			migratedQuery: MIGRATED_QUERY,
			migratedTotal: migratedHits.total,
			controlQuery: CONTROL_QUERY,
			controlTotal: controlHits.total
		},
		posts: posts
			.map((row) => ({
				id: row.id,
				legacyId: row.data.legacy_id ?? null,
				title: row.data.title,
				slug: row.data.slug,
				section: row.data.section ?? null,
				standfirst: row.data.standfirst ?? '',
				publishedAt: row.data.published_at ?? null,
				author: related<{ title: string }>(row.data, 'author')?.title ?? null
			}))
			// Sorted here because the engine offers no sort parameter and always
			// answers created_at DESC, which is insertion order, not publication
			// order.
			.sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '')),
		authors: authors.map((row) => ({
			id: row.id,
			legacyId: row.data.legacy_id ?? null,
			name: row.data.title,
			role: row.data.role ?? null
		}))
	};
};
