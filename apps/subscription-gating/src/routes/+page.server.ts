import { listArticles } from '$lib/server/articles';
import { canRead } from '$lib/server/tiers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { reader } = await parent();
	const articles = await listArticles();

	return {
		// Excerpts are safe to show to everyone: they are written as the pitch
		// for the paid body, not as a slice of it.
		articles: articles.map((article) => ({
			id: article.id,
			title: article.title,
			slug: article.slug,
			excerpt: article.excerpt,
			tier: article.tier,
			publishedAt: article.publishedAt,
			unlocked: canRead(article.tier, reader)
		}))
	};
};
