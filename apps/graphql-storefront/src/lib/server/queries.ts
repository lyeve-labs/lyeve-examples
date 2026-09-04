import { gql } from './graphql';

/**
 * Every document this storefront sends.
 *
 * They live together and are exported because /graphql renders them verbatim.
 * A reader should be able to compare the string on that page with the string a
 * page actually sent, and find no difference.
 *
 * Two things about their shape are forced by the engine rather than chosen.
 *
 * A root field is the content type's own name, so the list field is
 * `gql_products` and the by-id field is `gql_product`. The singular name is the
 * plural with a trailing `s` removed, unless the name ends in `ss`, `us`, `is`
 * or `ws`, in which case `_one` is appended instead. `gql_reviews` ends in `ws`,
 * so its by-id field is `gql_reviews_one`, not `gql_review`. Nothing here uses
 * the by-id fields, because a storefront addresses things by slug.
 *
 * There is no relation traversal. A `belongsTo` relation is typed `String` on
 * the generated GraphQL type and reads back null, and the foreign key the engine
 * really stores is not on the type at all, so a product cannot reach its
 * collection through the graph. Each of these documents therefore joins in the
 * application, on the `collection_slug` and `product_slug` columns the schemas
 * carry for exactly that reason. See the README.
 */

export interface CollectionRow {
	id: string;
	title: string;
	slug: string;
	description: string | null;
}

export interface ProductRow {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	price_cents: number | null;
	stock: number | null;
	collection_slug: string | null;
	created_at: string | null;
}

export interface ReviewRow {
	id: string;
	title: string;
	body: string | null;
	rating: number | null;
	product_slug: string | null;
	created_at: string | null;
}

/**
 * The index: every collection, and every product, in one request.
 *
 * The whole product list is fetched because the counts and the cheapest price
 * on each card are worked out here. GraphQL offers no aggregate and no group,
 * exactly as REST offers no aggregate and no group. What it does offer is both
 * lists in a single round trip, which is the one thing this page could not have
 * over REST.
 *
 * `limit` on a list field accepts 1 to 500 and is clamped into that range. The
 * REST route clamps to 25..200 instead, so this is the rare place where the
 * GraphQL surface is the more capable of the two.
 */
export const CollectionIndex = gql<
	Record<string, never>,
	{ collections: CollectionRow[]; products: ProductRow[] }
>(
	'CollectionIndex',
	`
query CollectionIndex {
  collections: gql_collections(limit: 100) {
    id
    title
    slug
    description
  }
  products: gql_products(limit: 500) {
    id
    title
    slug
    price_cents
    stock
    collection_slug
  }
}
`
);

/**
 * One collection and the products in it.
 *
 * `where` is equality, ANDed across the fields given, and it is the only
 * predicate the surface has: no operators, no ranges, no text match. The filter
 * input for a type carries its scalar fields and `id`, and omits every relation,
 * which is why the products are narrowed on `collection_slug` rather than on the
 * relation.
 */
export const CollectionPage = gql<
	{ slug: string },
	{ collection: CollectionRow[]; products: ProductRow[] }
>(
	'CollectionPage',
	`
query CollectionPage($slug: String!) {
  collection: gql_collections(where: { slug: $slug }, limit: 1) {
    id
    title
    slug
    description
  }
  products: gql_products(where: { collection_slug: $slug }, limit: 200) {
    id
    title
    slug
    description
    price_cents
    stock
    collection_slug
  }
}
`
);

/**
 * One product, its reviews, and the collections it might belong to.
 *
 * The collections are fetched whole rather than by slug because the product's
 * collection is not known until the product comes back, and a second request to
 * resolve it would give away the only advantage this transport has here. Four
 * collections is cheap to over-fetch. A thousand would not be, and then this
 * page would be two requests. That trade is the honest version of "GraphQL
 * fetches a page in one request" for a server that cannot join.
 */
export const ProductPage = gql<
	{ slug: string },
	{ product: ProductRow[]; reviews: ReviewRow[]; collections: CollectionRow[] }
>(
	'ProductPage',
	`
query ProductPage($slug: String!) {
  product: gql_products(where: { slug: $slug }, limit: 1) {
    id
    title
    slug
    description
    price_cents
    stock
    collection_slug
    created_at
  }
  reviews: gql_reviews(where: { product_slug: $slug }, limit: 200) {
    id
    title
    body
    rating
    product_slug
    created_at
  }
  collections: gql_collections(limit: 100) {
    id
    title
    slug
    description
  }
}
`
);
