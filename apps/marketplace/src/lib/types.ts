/**
 * What the loads hand to the pages. These are view models, not engine rows: the
 * engine's shape leaks relation columns and snake case, and the pages should
 * not have to know about either.
 */

export type ProductCard = {
	id: string;
	slug: string;
	title: string;
	priceCents: number;
	stock: number;
	coverId: string | null;
	sellerName: string | null;
	sellerSlug: string | null;
	categoryName: string | null;
	categorySlug: string | null;
};

export type CategoryLink = {
	id: string;
	slug: string;
	title: string;
};

export type SellerSummary = {
	slug: string;
	title: string;
	bio: string;
	rating: number;
};

/** A seller with its id, which the pages need to filter that seller's products. */
export type SellerCard = SellerSummary & { id: string };

export type ProductReview = {
	id: string;
	title: string;
	body: string;
	rating: number;
	postedAt: string;
};
