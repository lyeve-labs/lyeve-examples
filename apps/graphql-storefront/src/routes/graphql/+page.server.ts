import { exchange, type Exchange } from '$lib/server/graphql';
import { CollectionIndex, CollectionPage, ProductPage } from '$lib/server/queries';
import { loadLimits, loadSurface } from '$lib/server/surface';
import type { PageServerLoad } from './$types';

/**
 * Sends every document the storefront sends, and shows each one beside the
 * answer it got.
 *
 * The documents are the exported constants the pages use, so the text on this
 * page is the text that went over the wire and not a description of it. The
 * responses are fresh: this page runs the same queries again rather than
 * recording what another request did, because a per-request log kept on the
 * server would be shared state between readers.
 *
 * It costs seven POSTs to render, three of which are refused on purpose. That
 * is fine for an example page and would not be fine on a product page.
 */
export const load: PageServerLoad = async () => {
	const index = await exchange(CollectionIndex);
	const data = index.response.data;

	// The page queries need real slugs, and the index has just returned them.
	// A hardcoded slug would go stale the first time the seed changed.
	const collectionSlug = data?.collections[0]?.slug ?? '';
	const productSlug = data?.products.find((p) => p.collection_slug === collectionSlug)?.slug
		?? data?.products[0]?.slug
		?? '';

	const [collection, product, surface, limits] = await Promise.all([
		exchange(CollectionPage, { slug: collectionSlug }),
		exchange(ProductPage, { slug: productSlug }),
		loadSurface(),
		loadLimits()
	]);

	return {
		pageQueries: [
			{ route: '/', exchange: flatten(index) },
			{ route: '/c/[slug]', exchange: flatten(collection) },
			{ route: '/p/[slug]', exchange: flatten(product) }
		],
		introspection: flatten(surface.exchange),
		rootFields: surface.rootFields,
		mutationNames: surface.mutationNames,
		types: surface.types,
		limits: limits.map((limit) => ({
			title: limit.title,
			limit: limit.limit,
			explanation: limit.explanation,
			exchange: flatten(limit.exchange, 6)
		}))
	};
};

type FlatExchange = {
	name: string;
	text: string;
	/** Set when the text shown is shorter than the text sent. */
	elided: string | null;
	variables: string | null;
	status: number;
	elapsedMs: number;
	response: string;
};

/**
 * Turns an exchange into strings the page can render.
 *
 * The probe documents are hundreds of lines of the same repeated selection, so
 * a document longer than `maxLines` is shown as its first lines plus a count of
 * what was left out. The response is always shown whole. A refusal is one line.
 */
function flatten<T>(result: Exchange<T>, maxLines = 0): FlatExchange {
	const lines = result.document.text.split('\n');
	const shown = maxLines > 0 && lines.length > maxLines ? lines.slice(0, maxLines) : lines;
	const hidden = lines.length - shown.length;

	return {
		name: result.document.name,
		text: shown.join('\n'),
		elided: hidden > 0 ? `${hidden} more lines of the same shape` : null,
		variables: Object.keys(result.variables).length > 0
			? JSON.stringify(result.variables, null, 2)
			: null,
		status: result.status,
		elapsedMs: Math.round(result.elapsedMs * 10) / 10,
		response: JSON.stringify(result.response, null, 2)
	};
}
