import {
	getContentBySlug, listContent, related, type ContentEntry
} from '$lib/lyeve';
import { lyeve, CATEGORIES, PRODUCTS, REVIEWS, SELLERS } from './lyeve';
import type {
	CategoryLink, ProductCard, ProductReview, SellerCard, SellerSummary
} from '$lib/types';

// The engine clamps a list to 200 rows, and this catalog fits in one page.
// That is the only reason the app can sort and total it: see the README for
// what has to change when a catalog stops fitting.
const PAGE = 200;

type NamedRow = {
	title: string;
	slug: string;
};

type ProductRow = {
	title: string;
	slug: string;
	description?: string;
	price_cents?: number;
	stock?: number;
	cover_media_id?: string;
};

type SellerRow = {
	title: string;
	slug: string;
	bio?: string;
	rating?: number;
};

type ReviewRow = {
	title: string;
	slug: string;
	body?: string;
	rating?: number;
};

/** Categories arrive newest first, which is not an order anyone browses in. */
export async function loadCategories(): Promise<CategoryLink[]> {
	const rows = await listContent<NamedRow>(lyeve, CATEGORIES, { limit: 25 });
	return rows
		.map((row) => ({ id: row.id, slug: row.data.slug, title: row.data.title }))
		.sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadSellers(): Promise<SellerCard[]> {
	const rows = await listContent<SellerRow>(lyeve, SELLERS, { limit: 25 });
	return rows.map(toSellerCard).sort((a, b) => b.rating - a.rating);
}

export async function loadSeller(slug: string): Promise<SellerCard | null> {
	const row = await getContentBySlug<SellerRow>(lyeve, SELLERS, slug);
	return row ? toSellerCard(row) : null;
}

/**
 * Lists products, letting the engine apply whatever exact-equality filters the
 * caller has.
 *
 * `populate` inflates the seller and category ids into whole records in the
 * same round trip. Without it every card would need two more requests.
 */
export async function loadProducts(
	filters: Record<string, string> = {}
): Promise<ProductCard[]> {
	const rows = await listContent<ProductRow>(lyeve, PRODUCTS, {
		limit: PAGE,
		filters,
		populate: ['seller', 'category']
	});
	return rows.map(toProductCard);
}

export type ProductDetail = {
	product: ProductCard;
	description: string;
	seller: SellerSummary | null;
	reviews: ProductReview[];
	averageRating: number | null;
};

/**
 * Reads one product with everything its page shows.
 *
 * There is no get-by-slug route on the engine, so this is a filtered list of
 * one. Exact equality is all a slug lookup needs.
 */
export async function loadProductDetail(slug: string): Promise<ProductDetail | null> {
	const row = await getContentBySlug<ProductRow>(lyeve, PRODUCTS, slug, {
		populate: ['seller', 'category']
	});
	if (!row) return null;

	const product = toProductCard(row);
	const seller = related<SellerRow>(row.data, 'seller');
	const reviews = await loadReviews(product.id);

	// The engine returns rows and never an aggregate, so the average is worked
	// out here over the rows it returned.
	const averageRating = reviews.length
		? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
		: null;

	return {
		product,
		description: row.data.description ?? '',
		seller: seller
			? {
					slug: seller.slug,
					title: seller.title,
					bio: seller.bio ?? '',
					rating: Number(seller.rating ?? 0)
				}
			: null,
		reviews,
		averageRating
	};
}

/**
 * Reads one product's reviews.
 *
 * The filter key is the column the relation actually stores. A belongs_to field
 * named `product` writes to `product_id`, and that is the only name the engine
 * accepts here: `filters[product]` names no column and comes back 400.
 */
export async function loadReviews(productId: string): Promise<ProductReview[]> {
	const rows = await listContent<ReviewRow>(lyeve, REVIEWS, {
		limit: PAGE,
		filters: { product_id: productId }
	});
	return rows.map((row) => ({
		id: row.id,
		title: row.data.title,
		body: row.data.body ?? '',
		rating: Number(row.data.rating ?? 0),
		postedAt: row.created_at
	}));
}

export function toProductCard(row: ContentEntry<ProductRow>): ProductCard {
	// These rows are read with populate, so the whole record sits under the
	// field name. Unpopulated, a row carries only `seller_id` and a null
	// `seller` beside it, and `related` returns null rather than a broken card.
	const seller = related<NamedRow>(row.data, 'seller');
	const category = related<NamedRow>(row.data, 'category');

	return {
		id: row.id,
		slug: row.data.slug,
		title: row.data.title,
		priceCents: Number(row.data.price_cents ?? 0),
		stock: Number(row.data.stock ?? 0),
		coverId: row.data.cover_media_id ?? null,
		sellerName: seller?.title ?? null,
		sellerSlug: seller?.slug ?? null,
		categoryName: category?.title ?? null,
		categorySlug: category?.slug ?? null
	};
}

export function toSellerCard(row: ContentEntry<SellerRow>): SellerCard {
	return {
		id: row.id,
		slug: row.data.slug,
		title: row.data.title,
		bio: row.data.bio ?? '',
		rating: Number(row.data.rating ?? 0)
	};
}
