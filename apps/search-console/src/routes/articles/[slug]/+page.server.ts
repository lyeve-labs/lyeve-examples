import { error } from '@sveltejs/kit';
import { articleBySlug, listCategories } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const article = await articleBySlug(params.slug);
	if (!article) error(404, 'No such article');

	const categories = await listCategories();
	const category = categories.find((row) => row.id === article.categoryId) ?? null;

	return {
		article: {
			title: article.title,
			summary: article.summary,
			paragraphs: article.body.split('\n\n').filter(Boolean),
			keywords: article.keywords
				.split(',')
				.map((keyword) => keyword.trim())
				.filter(Boolean)
		},
		category: category ? { slug: category.slug, title: category.title } : null
	};
};
