import { run } from './graphql';
import {
	CollectionIndex, CollectionPage, ProductPage,
	type ProductRow, type ReviewRow
} from './queries';
import type { CollectionCard, ProductCard, ProductDetail, Review } from '$lib/types';

/**
 * The reads behind each page, one GraphQL document apiece.
 *
 * Sorting happens here. A list field always comes back `ORDER BY id`, which on
 * a UUID primary key is an arbitrary order, and there is no sort argument to
 * ask for another. The REST route is at least `created_at DESC`, so this is one
 * of the places where the GraphQL surface is behind it.
 */

export async function loadCollectionIndex(): Promise<CollectionCard[]> {
	const data = await run(CollectionIndex);

	const byCollection = new Map<string, ProductRow[]>();
	for (const product of data.products) {
		const slug = product.collection_slug;
		if (!slug) continue;
		const bucket = byCollection.get(slug);
		if (bucket) bucket.push(product);
		else byCollection.set(slug, [product]);
	}

	return data.collections
		.map((collection) => {
			const products = byCollection.get(collection.slug) ?? [];
			const prices = products.map((p) => Number(p.price_cents ?? 0)).filter((p) => p > 0);
			return {
				id: collection.id,
				slug: collection.slug,
				title: collection.title,
				description: collection.description ?? '',
				productCount: products.length,
				fromPriceCents: prices.length > 0 ? Math.min(...prices) : null
			};
		})
		.sort((a, b) => a.title.localeCompare(b.title));
}

export type CollectionView = {
	collection: CollectionCard;
	products: ProductCard[];
};

export async function loadCollection(slug: string): Promise<CollectionView | null> {
	const data = await run(CollectionPage, { slug });
	const [collection] = data.collection;
	if (!collection) return null;

	const products = data.products
		.map((row) => toProductCard(row, collection.title))
		.sort((a, b) => a.priceCents - b.priceCents);
	const prices = products.map((p) => p.priceCents).filter((p) => p > 0);

	return {
		collection: {
			id: collection.id,
			slug: collection.slug,
			title: collection.title,
			description: collection.description ?? '',
			productCount: products.length,
			fromPriceCents: prices.length > 0 ? Math.min(...prices) : null
		},
		products
	};
}

export async function loadProduct(slug: string): Promise<ProductDetail | null> {
	const data = await run(ProductPage, { slug });
	const [product] = data.product;
	if (!product) return null;

	// The product's collection is matched here, on the slug the schema carries
	// beside the relation. The relation itself is invisible to this transport.
	const collection = data.collections.find((c) => c.slug === product.collection_slug) ?? null;
	const reviews = data.reviews.map(toReview).sort((a, b) => b.rating - a.rating);
	const rated = reviews.filter((r) => r.rating > 0);

	return {
		product: toProductCard(product, collection?.title ?? null),
		description: product.description ?? '',
		reviews,
		averageRating: rated.length > 0
			? rated.reduce((total, r) => total + r.rating, 0) / rated.length
			: null
	};
}

function toProductCard(row: ProductRow, collectionTitle: string | null): ProductCard {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		priceCents: Number(row.price_cents ?? 0),
		stock: Number(row.stock ?? 0),
		collectionSlug: row.collection_slug,
		collectionTitle
	};
}

function toReview(row: ReviewRow): Review {
	return {
		id: row.id,
		title: row.title,
		body: row.body ?? '',
		rating: Number(row.rating ?? 0),
		postedAt: row.created_at
	};
}
