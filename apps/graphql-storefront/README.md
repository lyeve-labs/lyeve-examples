# GraphQL Storefront

A small bicycle parts shop driven entirely through `POST /api/v1/graphql`. Every
other example in this repository reads through the REST content API. This is the
one that does not. It exists to show what this GraphQL surface really offers
rather than what a GraphQL endpoint is usually assumed to offer.

Read the next section before the rest. The gaps are not small.

## What REST does here that GraphQL cannot

**Relations are unreachable.** This is the one that decides the architecture of
the app. A `belongsTo` relation named `collection` puts two columns on the
generated table: a dead `collection` and the real `collection_id`. The GraphQL
type carries `collection`, typed `String`, and it reads back null for every row.
`collection_id` is on no GraphQL type at all, so it cannot be selected, and it is
absent from every `FilterInput`, so it cannot be filtered. There is no nested
object, no `populate`, no `depth`, and no way to reach a related record.

Over REST, the same read is `?populate=collection` for the object and
`?filters[collection_id]=<uuid>` for the list. Over GraphQL there is no
equivalent, and no combination of arguments builds one.

So `gql_products` carries `collection_slug` as ordinary text beside the
relation, and `gql_reviews` carries `product_slug`. Those two columns are the
only reason this storefront can render a collection page. They are
denormalization forced by the transport, not by the domain, and `/graphql` in
the running app points at them and says so.

**There is no search field.** `/api/admin/search` has no GraphQL counterpart on
either router. REST has no public search either, so both surfaces need the app
to proxy it, but a GraphQL client has nothing to proxy to. This example has no
search page for that reason.

**Draft status is invisible.** A content type declared `with_draft_publish` gets
a `_status` column, and the REST list adds `(_status = 'published' OR _status IS
NULL)` to its WHERE clause. The GraphQL resolver adds only the tenant predicate
and, on a soft-delete type, `deleted_at IS NULL`. It has no status clause, and
`_status` is on no GraphQL type, so a caller cannot select it, filter it, or tell
a draft from a published row.

Two qualifications, because the difference is narrower than it looks today. The
content types here are not `with_draft_publish`, so neither surface has a status
column to consult. And the admin write path never sets `_status` on the
generated table: the mirror writes `title`, `slug` and the body fields, so a
draft entry projects with the column at its `DEFAULT 'published'` and both
surfaces show it. The gap opens the moment something calls the publish or
unpublish route, which does update `_status`. From then on REST hides the row
and GraphQL keeps returning it. That half is read from the engine's source
rather than executed here.

**There is no total and no cursor.** A list field returns a bare list. Neither
surface offers a count, so neither can page against one.

**Ordering is worse, not merely absent.** Neither surface has a sort parameter.
REST always returns `created_at DESC`, which is at least an order. A GraphQL
list field is `ORDER BY id`, which on a UUID primary key is arbitrary. Every
list in this app is sorted in `src/lib/server/storefront.ts` for that reason.

**No media.** Media bytes come from `GET /api/admin/media/{id}/download`, which
wants a bearer token and has no GraphQL counterpart. This app has no images, so
it has no `/media/[id]` route to proxy them through.

**A mutation writes the wrong table.** `createGqlProducts` and its siblings
INSERT straight into the generated table and never touch
`sys_content_entries`. That is the same defect as the public v1 write route:
content created that way is invisible to search and to the admin UI, forever and
with no error. `setup/provision.ts` therefore seeds through
`POST /api/admin/content` like every other example, and this app performs no
mutations at all.

## What GraphQL does better

**Several root fields in one request.** This is the real win and it is worth
having. `/p/[slug]` is one POST that returns the product, its reviews and the
collection list. Over REST that page is three round trips, and the first two
cannot be collapsed: filtering reviews by their product needs the product's id,
and the id needs a slug lookup first, because the engine does not join and
`filters[product]` is a 400.

**The response carries what you asked for.** REST returns a fixed envelope,
`{id, schema_name, data: {...}, created_at, updated_at}`, with every field of
the row inside `data` and no `fields` parameter to narrow it. A GraphQL
selection set is the payload, flat and picked.

**A page smaller than 25 rows.** `limit` on a list field takes 1 to 500 and is
clamped into that range. The REST route clamps to 25..200, so `?limit=3` there
returns 25 rows and the shared client slices locally. `gql_products(limit: 3)`
returns three.

Everything else is a draw. `where` is exact equality ANDed across the fields
given, which is what `filters[]` is, and neither offers an operator, a range or
a text match. `where` covers a type's scalar fields plus `id`, and omits
every relation, media and json field. `filters[]` covers all of those and
`created_at`, `updated_at`, `deleted_at`, `_status` and any relation's foreign
key besides.

## The limits on the endpoint

Measured against the running engine, not read from the config reference. The
`/graphql` page trips each one live and shows the refusal.

| Limit | Value | Config key | Notes |
|---|---|---|---|
| Query depth | 7 | `graphql.max_query_depth` | Counted through inline fragments and named fragment spreads, so a fragment does not buy a level. |
| Query cost | 1000 | `graphql.max_query_cost` | A list field costs 10, an object field 2, a scalar 1. 60 list fields of 7 scalars each is 1020 and is refused. 58 is 986 and is served. |
| Field count | 500 | none | Total fields across the document, each alias counted separately. Catches the alias-batched query that stays under the cost. |
| Query timeout | 30s | `graphql.query_timeout` | Wall clock on one query. |
| Request body | 256 KiB | none | |
| Introspection | admin-only | `graphql.introspection` | Also `on` and `off`. `super_admin` counts as admin. |

A document that crosses one of these comes back HTTP 400 with a GraphQL `errors`
array. A resolver error comes back HTTP 200 with the same array. The helper in
`src/lib/server/graphql.ts` flattens both, which is the only reason the pages do
not each have to know the difference.

Three more things worth knowing before they cost an afternoon.

The endpoint is on the public router only. `POST /api/v1/graphql` on port 4402
answers. The same path on the admin router, port 4401, is a 404. So
`src/lib/server/graphql.ts` sends through the client's `api` base and never the
`admin` one, which is the opposite of where search and content writes go.

A request whose `Content-Type` is not `application/json` is refused with a 415,
twice over. The engine's media-type middleware answers first, and the plugin
repeats the check behind it. The plugin's source calls it CSRF protection, on the
grounds that an HTML form can only send three content types and none of them
match.

And the endpoint requires a bearer token like every other route, so a browser
cannot call it and this app is a backend for frontend exactly like the others.

## The rest of the endpoint

Three things this example does not use.

`GET /api/v1/graphql/ws` upgrades to a graphql-ws subscription socket, serving
`contentChanged(schema:)` and `schemaChanged`. It validates
`Origin` against the `cors_origins` allowlist, and the local stack sets none, so
it answers `403 origin not allowed` to everything. Pointing it at a real origin
is a stack configuration change, not an app change.

`GET /api/admin/graphql/persisted-queries/` manages the persisted query
allowlist, and `graphql.require_persisted` turns the query endpoint into
allowlist-only mode. This one is on the admin router, and note the trailing
slash: the route is mounted as a wildcard pattern, so the path without it is a
404 and the path with it is a 200.

`GET /api/v1/graphql` is not a playground. It returns
`{"message": "GraphQL endpoint ready. POST a query to this URL.", ...}`.

## Naming, which is generated and slightly surprising

The schema is generated from the content types themselves, cached for 30 seconds
per tenant and rebuilt on the next request after a schema change. A root field is
therefore a content type's own name, with hyphens turned into underscores.

| Content type | List field | By-id field | GraphQL type |
|---|---|---|---|
| `gql_collections` | `gql_collections` | `gql_collection` | `GqlCollections` |
| `gql_products` | `gql_products` | `gql_product` | `GqlProducts` |
| `gql_reviews` | `gql_reviews` | `gql_reviews_one` | `GqlReviews` |

The singular name drops a trailing `s`, unless the name ends in `ss`, `us`, `is`
or `ws`, in which case `_one` is appended instead. `gql_reviews` ends in `ws`, so
it is `gql_reviews_one`. Mutation names use the type name verbatim, so they are
`createGqlProducts` rather than `createGqlProduct`.

None of the by-id fields are used here, because they take an id and a storefront
addresses things by slug. There is no by-slug field, so every read in this app is
a filtered list of one.

## Why there is a hand-written client

`@lyeve-labs/client-graphql` exists. Its `createGraphQLClient` takes an
`HttpClient` from `@lyeve-labs/client`, and that package's
`createClient(fetchFn, defaultHeaders)` carries no base URL and no way to obtain
a token. So the caller still supplies the origin, logs in, caches the token,
backs off the login rate limit and re-injects the header when it rotates, and
`defaultHeaders` is captured once at construction so a rotated token needs a new
client. The wrapper is the work either way, and `src/lib/server/graphql.ts` is
under a hundred lines of it.

The one thing the package adds over that file is `subscribe`, which needs a
browser `WebSocket` and derives its URL from a `baseUrl` that defaults to the
empty string. The browser is exactly where this app must never talk to the
engine.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/graphql-storefront && pnpm run setup && pnpm dev

Then open http://localhost:5192, and http://localhost:5192/graphql to see the
transport.

## Layout

    src/lib/server/graphql.ts      the transport: one POST, typed documents, flattened errors
    src/lib/server/queries.ts      every document the app sends, exported so /graphql can show them
    src/lib/server/surface.ts      live introspection and the limit probes
    src/lib/server/storefront.ts   the reads behind each page, and the sorting the engine will not do
    src/routes/+page.server.ts     collection index, one document
    src/routes/c/[slug]/           one collection and its products, one document
    src/routes/p/[slug]/           one product, its reviews and the collections, one document
    src/routes/graphql/            each document beside the answer it got
    setup/provision.ts             content types and seed data

`/graphql` sends seven requests to render, three of them refused on purpose.
That is acceptable on a page whose subject is the transport and would not be
acceptable anywhere else.

Nothing outside `src/lib/server/` and the `.server.ts` files touches the engine.
The credential lives in this process, and SvelteKit refuses to bundle a
`$lib/server` import into the browser.

## No benchmark profile

There is no `benchmark.json` here. The profile driver's POST branch does not send
a body from the manifest: it builds an admin content-write body from the entry's
`schema`, `relations` and `fields`, so a GraphQL query cannot be expressed as a
traffic entry. Posting that body to `/api/v1/graphql` would measure the
`query is required` path.
