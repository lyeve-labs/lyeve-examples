import { error } from '@sveltejs/kit';
import { findArticle, previewOf } from '$lib/server/articles';
import { canRead, refusalFor } from '$lib/server/tiers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { reader } = await parent();
	const article = await findArticle(params.slug);
	if (!article) error(404, 'No such article');

	const unlocked = canRead(article.tier, reader);
	const preview = previewOf(article.body);

	return {
		article: {
			title: article.title,
			tier: article.tier,
			excerpt: article.excerpt,
			publishedAt: article.publishedAt,
			// The full body is attached only when the reader is entitled to it.
			// Everything returned from a server load is serialized into the page,
			// so a locked article that carried its body here would be readable
			// from view-source no matter what the markup did with it.
			body: unlocked ? article.body : preview.text,
			hiddenParagraphs: unlocked ? 0 : preview.hidden
		},
		unlocked,
		refusal: unlocked ? null : refusalFor(reader)
	};
};
