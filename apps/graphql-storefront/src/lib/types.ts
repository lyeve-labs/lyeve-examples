/**
 * What the loads hand to the pages. These are view models, not engine rows: a
 * GraphQL row arrives flat and snake_cased, with a dead relation field beside
 * the denormalized slug that stands in for it, and no page should have to know
 * about any of that.
 */

export type ProductCard = {
	id: string;
	slug: string;
	title: string;
	priceCents: number;
	stock: number;
	collectionSlug: string | null;
	collectionTitle: string | null;
};

export type CollectionCard = {
	id: string;
	slug: string;
	title: string;
	description: string;
	productCount: number;
	/** Null when the collection holds nothing. */
	fromPriceCents: number | null;
};

export type Review = {
	id: string;
	title: string;
	body: string;
	rating: number;
	postedAt: string | null;
};

export type ProductDetail = {
	product: ProductCard;
	description: string;
	reviews: Review[];
	/** Averaged over the rows returned, because the engine returns no aggregate. */
	averageRating: number | null;
};
