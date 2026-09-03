/**
 * Creates the marketplace content types, uploads a cover for every product and
 * seeds the catalog.
 *
 * Safe to run repeatedly. Applying a content type that already exists is
 * accepted, and every row is created only when its slug is missing, so a run
 * that dies halfway resumes where it stopped rather than writing a second copy
 * of everything before it.
 */
import {
	lyeveFromEnv, applySchemas, belongsTo, listContent, createContent, uploadMedia
} from '../src/lib/lyeve/index.ts';
import { PALETTE, coverPng } from './cover-image.ts';
import { categories, products, reviews, sellers } from './data.ts';
import type { ProductSeed } from './data.ts';

const client = lyeveFromEnv();

// Set once, at the first refused upload. Declared here because the seeding
// below runs at module top level, before the helpers further down are reached.
let coversAvailable = true;

const SELLERS = 'shop_sellers';
const CATEGORIES = 'shop_categories';
const PRODUCTS = 'shop_products';
const REVIEWS = 'shop_reviews';

// Order matters: a relation emits a foreign key against the target's generated
// table, so sellers and categories have to exist before products point at them,
// and products before reviews.
await applySchemas(client, [
	{
		name: SELLERS,
		display_name: 'Sellers',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'bio', field_type: 'text' },
			{ name: 'rating', field_type: 'number' }
		]
	},
	{
		name: CATEGORIES,
		display_name: 'Categories',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true }
		]
	},
	{
		name: PRODUCTS,
		display_name: 'Products',
		fields: [
			{ name: 'title', field_type: 'text', required: true },
			{ name: 'slug', field_type: 'text', required: true, indexed: true },
			{ name: 'description', field_type: 'text' },
			// Money is stored in whole cents. A number field is NUMERIC, which
			// would hold 19.989 without complaint, and nothing downstream would
			// know which way to round it.
			{ name: 'price_cents', field_type: 'number' },
			{ name: 'stock', field_type: 'number' },
			{ name: 'cover_media_id', field_type: 'text' },
			belongsTo('seller', SELLERS),
			belongsTo('category', CATEGORIES)
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
			belongsTo('product', PRODUCTS)
		]
	}
]);
console.log('content types ready');

const sellerIds = await ensure(SELLERS, sellers, (seller) => ({
	bio: seller.bio,
	rating: seller.rating
}));

const categoryIds = await ensure(CATEGORIES, categories, () => ({}));

const productIds = await ensure(PRODUCTS, products, async (product) => ({
	description: product.description,
	price_cents: product.priceCents,
	stock: product.stock,
	cover_media_id: await uploadCover(product),
	// A relation is written under its field name and read back under
	// `<field>_id`, which is also the name to filter on.
	seller: sellerIds.get(product.seller),
	category: categoryIds.get(product.category)
}));

await ensure(REVIEWS, reviews, (review) => ({
	body: review.body,
	rating: review.rating,
	product: productIds.get(review.product)
}));

console.log(
	`catalog ready: ${sellers.length} sellers, ${categories.length} categories, ` +
		`${products.length} products, ${reviews.length} reviews`
);

type Seed = { slug: string; title: string };

/**
 * Creates the rows whose slugs are missing and returns slug to id for every
 * seed, created here or already present.
 *
 * Writes go through the admin route. The public v1 write endpoint would land
 * the row in the generated table only, where search and the admin UI never see
 * it, and nothing reports that at the time.
 */
async function ensure<T extends Seed>(
	schema: string,
	seeds: T[],
	body: (seed: T) => Record<string, unknown> | Promise<Record<string, unknown>>
): Promise<Map<string, string>> {
	const index = await slugIndex(schema);
	let created = 0;

	for (const seed of seeds) {
		if (index.has(seed.slug)) continue;
		const { id } = await createContent(client, {
			schema,
			slug: seed.slug,
			title: seed.title,
			body: { slug: seed.slug, ...(await body(seed)) }
		});
		index.set(seed.slug, id);
		created++;
	}

	console.log(`${schema}: ${created} created, ${seeds.length - created} already there`);
	return index;
}

/** One page covers this catalog. The engine will not return more than 200 rows. */
async function slugIndex(schema: string): Promise<Map<string, string>> {
	const rows = await listContent<{ slug?: string }>(client, schema, { limit: 200 });
	const index = new Map<string, string>();
	for (const row of rows) {
		if (typeof row.data.slug === 'string') index.set(row.data.slug, row.id);
	}
	return index;
}

/**
 * Uploads a generated cover and returns the media id to store on the product.
 *
 * A cover is decoration. If the upload is refused the seed says so once and
 * carries on, because a catalog with no pictures is a better outcome than a
 * catalog that is half written.
 */
async function uploadCover(product: ProductSeed): Promise<string | null> {
	if (!coversAvailable) return null;
	try {
		const png = coverPng(PALETTE[product.category] ?? PALETTE.ceramics, product.slug);
		const file = new Blob([new Uint8Array(png)], { type: 'image/png' });
		const record = await uploadMedia(client, file, `${product.slug}.png`);
		return record.id;
	} catch (err) {
		coversAvailable = false;
		console.warn(`covers unavailable, seeding without them: ${(err as Error).message}`);
		return null;
	}
}
