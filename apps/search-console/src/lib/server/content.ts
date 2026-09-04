/**
 * The content reads this app needs, which are the ones search cannot do.
 *
 * Search answers questions about words. It cannot list a category, it cannot
 * fetch one article by slug without matching that slug as text, and it has no
 * public route, so the ordinary content router is still doing most of the work
 * behind these pages.
 */
import { listContent, getContentBySlug, relationId } from '$lib/lyeve';
import { ARTICLES, CATEGORIES, lyeve } from './lyeve';

export interface CategoryRow {
	id: string;
	slug: string;
	title: string;
}

export interface ArticleRow {
	id: string;
	slug: string;
	title: string;
	summary: string;
	body: string;
	keywords: string;
	categoryId: string | null;
	createdAt: string;
}

export async function listCategories(): Promise<CategoryRow[]> {
	const rows = await listContent<{ title: string; slug: string }>(lyeve, CATEGORIES, {
		limit: 25
	});
	return rows
		.map((row) => ({ id: row.id, slug: row.data.slug, title: row.data.title }))
		.sort((a, b) => a.title.localeCompare(b.title));
}

export async function articleBySlug(slug: string): Promise<ArticleRow | null> {
	const row = await getContentBySlug<{
		title: string;
		slug: string;
		summary?: string;
		body?: string;
		keywords?: string;
	}>(lyeve, ARTICLES, slug);
	if (!row) return null;
	return {
		id: row.id,
		slug: row.data.slug,
		title: row.data.title,
		summary: row.data.summary ?? '',
		body: row.data.body ?? '',
		keywords: row.data.keywords ?? '',
		// A plain read hands the relation back as `category_id`, unlike a search
		// hit, which carries the document as written and so holds `category`.
		categoryId: relationId(row.data, 'category'),
		createdAt: row.created_at
	};
}
