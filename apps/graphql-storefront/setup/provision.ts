/**
 * Creates the storefront's content types and seeds them.
 *
 * Safe to run more than once: applying a schema that exists is accepted, and
 * seeding stops if the storefront already has products.
 *
 * The seed goes in through the admin content route, which is the only write
 * path that records an entry in `sys_content_entries` as well as the generated
 * table. The GraphQL mutations this plugin generates write the generated table
 * only, so seeding through them would leave a catalog that this app can read
 * and that search and the admin UI cannot see.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent
} from '../src/lib/lyeve/index.ts';
import { collections, products, reviews } from './data.ts';

const client = lyeveFromEnv();

const COLLECTIONS = 'gql_collections';
const PRODUCTS = 'gql_products';
const REVIEWS = 'gql_reviews';

/**
 * Every entry slug carries the app's prefix. The uniqueness constraint on
 * `sys_content_entries` spans the whole tenant with no content type in it, so
 * a bare `drivetrain` would collide with another example's.
 */
function entrySlug(slug: string): string {
	return `gql-${slug}`;
}

// Order matters: a relation emits a foreign key against the target's generated
// table, so a collection must exist before a product references it.
await applySchemas(client, [
	{
		name: COLLECTIONS,
		display_name: 'Collections',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'description', field_type: 'text' }
		]
	},
	{
		name: PRODUCTS,
		display_name: 'Products',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'description', field_type: 'text' },
			{ name: 'price_cents', field_type: 'number' },
			{ name: 'stock', field_type: 'number' },
			// The real relation. REST reads it back as `collection_id` and can
			// filter on that column. The GraphQL surface exposes neither.
			belongsTo('collection', COLLECTIONS),
			// So the collection's slug is stored again, as ordinary text, and
			// that is the only column the GraphQL surface can filter a product
			// by its collection on. See the README.
			{ name: 'collection_slug', field_type: 'text', indexed: true }
		]
	},
	{
		name: REVIEWS,
		display_name: 'Reviews',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'body', field_type: 'text' },
			{ name: 'rating', field_type: 'number' },
			belongsTo('product', PRODUCTS),
			{ name: 'product_slug', field_type: 'text', indexed: true }
		]
	}
]);
console.log('content types ready');

if ((await listContent(client, PRODUCTS, { limit: 25 })).length > 0) {
	console.log('catalog already seeded, nothing to do');
	process.exit(0);
}

const collectionIds: Record<string, string> = {};
for (const collection of collections) {
	const { id } = await createContent(client, {
		schema: COLLECTIONS,
		slug: entrySlug(collection.slug),
		title: collection.title,
		body: { slug: collection.slug, description: collection.description }
	});
	collectionIds[collection.slug] = id;
}

const productIds: Record<string, string> = {};
for (const product of products) {
	const { id } = await createContent(client, {
		schema: PRODUCTS,
		slug: entrySlug(product.slug),
		title: product.title,
		body: {
			slug: product.slug,
			description: product.description,
			price_cents: product.priceCents,
			stock: product.stock,
			// A relation is written under the field name and read back as
			// `<field>_id`. Written here so the model is honest, even though
			// this app cannot read it over GraphQL.
			collection: collectionIds[product.collection],
			collection_slug: product.collection
		}
	});
	productIds[product.slug] = id;
}

for (const review of reviews) {
	await createContent(client, {
		schema: REVIEWS,
		slug: entrySlug(review.slug),
		title: review.title,
		body: {
			slug: review.slug,
			body: review.body,
			rating: review.rating,
			product: productIds[review.product],
			product_slug: review.product
		}
	});
}

console.log(
	`seeded ${collections.length} collections, ${products.length} products, ${reviews.length} reviews`
);
