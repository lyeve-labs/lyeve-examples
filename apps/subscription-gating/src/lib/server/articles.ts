import { listContent, getContentBySlug, type ContentEntry } from '$lib/lyeve';
import { lyeve, ARTICLES } from './lyeve';
import { isTier, type Tier } from './tiers';

interface ArticleData {
	title: string;
	slug: string;
	excerpt?: string;
	body?: string;
	tier?: string;
}

export interface Article {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	body: string;
	tier: Tier;
	publishedAt: string;
}

export async function listArticles(): Promise<Article[]> {
	const rows = await listContent<ArticleData>(lyeve, ARTICLES, { limit: 25 });

	// The engine takes no sort parameter and returns created_at DESC. The order
	// is applied here anyway: an ordering the API does not promise is not one to
	// build a page on, and this is the only place it would have to change.
	return rows
		.map(toArticle)
		.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export async function findArticle(slug: string): Promise<Article | null> {
	const row = await getContentBySlug<ArticleData>(lyeve, ARTICLES, slug);
	return row ? toArticle(row) : null;
}

/**
 * Cuts a paid article down to the part a non-member is allowed to see.
 *
 * This runs on the server and the trimmed text is what leaves it. Sending the
 * whole body and hiding the rest with CSS or a blur is the usual way a paywall
 * gets defeated, because the full text is sitting in the page source.
 */
export function previewOf(body: string, paragraphs = 2): { text: string; hidden: number } {
	const all = body.split('\n\n').filter((p) => p.trim() !== '');
	return {
		text: all.slice(0, paragraphs).join('\n\n'),
		hidden: Math.max(all.length - paragraphs, 0)
	};
}

function toArticle(row: ContentEntry<ArticleData>): Article {
	return {
		id: row.id,
		title: row.data.title,
		slug: row.data.slug,
		excerpt: row.data.excerpt ?? '',
		body: row.data.body ?? '',
		tier: isTier(row.data.tier) ? row.data.tier : 'free',
		publishedAt: row.created_at
	};
}
