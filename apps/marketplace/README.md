# Marketplace

A multi-seller product catalog. Four workshops, five categories, 24 products
with cover images, and 31 reviews.

This is the example for relations, filtering and media. It is deliberately the
awkward shape: products point at two different content types, reviews point back
at products, and the browse page needs a filter the engine can do and an order
it cannot.

## What it proves

- Four content types, three `belongs_to` relations, and a page that reads all of
  them without an N+1.
- Filtering runs in the engine, so a category page fetches only its own rows.
- Ordering, stock filtering and every total run in the app, because the engine
  offers none of them.
- Images are stored in the engine and served by this app, which is the only way
  a browser can see them.
- The seed can be run again on a database that already has the catalog in it
  and writes nothing twice.

## Content types

| Type | Fields |
|---|---|
| `shop_sellers` | title, slug, bio, rating |
| `shop_categories` | title, slug |
| `shop_products` | title, slug, description, price_cents, stock, cover_media_id, seller, category |
| `shop_reviews` | title, slug, body, rating, product |

Every name carries the `shop_` prefix because all the examples share one engine.

Prices are whole cents. A number field becomes a `NUMERIC` column, which would
hold `19.989` without complaint, and nothing downstream would know which way to
round it.

## Engine features exercised

| Feature | Where |
|---|---|
| Content types with relations | `setup/provision.ts` |
| Admin content writes | `setup/provision.ts`, through `createContent` |
| `filters[]` exact equality | `src/routes/+page.server.ts`, `src/routes/sellers/[slug]/+page.server.ts`, `loadReviews` |
| `populate` on a list read | `loadProducts` in `src/lib/server/catalog.ts` |
| Media upload | `setup/provision.ts`, through `uploadMedia` |
| Media download behind a token | `src/routes/media/[id]/+server.ts` |

## Relations, in four names

A `belongs_to` field called `seller` answers to a different name at every step.

| Step | Name | Worth knowing |
|---|---|---|
| Write | `seller` | The value is the target row's id, never its slug |
| Read | `seller_id` | `row.data.seller` is there too, and null unless the request populated it |
| Filter | `filters[seller_id]` | `filters[seller]` names no column and is rejected with a 400 |
| Populate | `populate=seller` | The whole related record lands under `seller`, its id included |

The shared client hides that asymmetry behind two functions: `related()` returns
the populated record or null, and `relationId()` returns the stored id whether or
not the request populated. This app reads with `related()`, because every read
here populates. A list that does not populate has only the id to work with.

Every relation is declared with `belongsTo()`, which makes it optional. A
required relation generates a second, dead column that the write path never
fills, and then every insert fails with a 422 that names nothing. Requirements
are enforced in the app instead: the seed writes no product without a seller.

## What the engine does not do

Everything in this list is done in the app instead, and the code says so where
it happens.

- **Sorting.** There is no `sort` or `order` parameter. Rows always come back
  `created_at DESC`. Price sorting happens in the browser, category names are
  alphabetised in the load, and sellers are ordered by rating in the load.
- **Ranges and comparisons.** `filters[]` is exact equality and nothing else.
  "In stock" means `stock > 0`, which is not an equality, so the browse page
  filters that in the browser. A price band would be the same problem.
- **Text matching.** No `LIKE`, no prefix match. Full-text search exists, but
  only on the admin router, so a public search box has to be proxied by the app.
  This example does not have one.
- **Aggregates.** No counts, no averages, no minimums. The average review score,
  the in-stock count and the "from $X" price on a seller page are all computed
  over rows the app already fetched.
- **Small pages.** `limit` is clamped to 25 at the bottom and 200 at the top,
  and a list response carries no total and no has-more flag.
- **Anonymous reads.** Every content route needs a token, so the browser never
  talks to the engine. This app is the credential boundary.
- **Public image URLs.** A media record has no URL a browser can use, and the
  engine's download route 401s without a bearer token. `/media/[id]` in this app
  fetches the bytes server-side and streams them back.

## What this example is not

- The covers are generated at seed time, not photographs. The repo ships no
  binary assets, and the point being made is the upload and the proxy in front
  of it. PNG rather than SVG because the engine refuses an SVG upload outright.
- There is no cart, no checkout and no stock decrement. Nothing here writes at
  request time.
- It reads the whole catalog in one page because 24 products fit in one page.
  At a few hundred products, sorting and totals stop being the app's to do:
  either denormalize the sort key into a column and page through it, or keep an
  index outside the engine and use the engine as the record of truth.

## Running it

From the repository root:

    make up                 # postgres, engine, first admin
    pnpm install
    make setup              # content types, covers and catalog, for every example
    make dev-marketplace    # http://localhost:5176

To seed this example on its own, export the root environment first. The seed
script reads plain environment variables and loads no `.env` of its own:

    set -a; . ./.env; set +a
    cd apps/marketplace && pnpm run setup

The seed is safe to run again. It creates only the rows whose slugs are missing,
so a run that is interrupted resumes rather than duplicating what it wrote.

If the media plugin is not available the seed says so once and carries on. The
catalog works without covers.
