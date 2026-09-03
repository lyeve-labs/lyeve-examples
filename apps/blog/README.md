# Blog

The reference implementation. Every other example follows its shape, so this is
the one to read first.

A small publication: a post list, a post page with its author and category
inflated from relations, and a search box. Roughly two hundred lines of
application code.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/blog && pnpm run setup && pnpm dev

Then open http://localhost:5173.

## What it demonstrates

**Relations, written one way and read another.** A post declares `author` and
`category` through `belongsTo()`. You write `author`, the engine stores
`author_id`, and a plain read hands back both `author_id` and a dead `author:
null`. Asking for `?populate=author` replaces that null with the whole author
record, which is what turns two round trips into one. `src/routes/+page.server.ts`
does this for the list, and `relationId()` and `related()` in the shared client
hide the asymmetry.

**Search, which is not where you would look for it.** `/api/admin/search` is on
the admin router, and there is no public equivalent, so `src/routes/search/`
proxies it. It also only ever sees content written through the admin route,
which is why `setup/provision.ts` seeds with `createContent` rather than the
public write endpoint.

**Media, which a browser cannot fetch.** The engine's download route wants a
bearer token and answers 401 without one, so an `<img>` pointed at it shows a
broken image. `src/routes/media/[id]/+server.ts` is the credential boundary: the
browser asks this app, and this app asks the engine.

**A slug lookup built out of a filter.** There is no get-by-slug route, so
`getContentBySlug` is a `filters[slug]=` list of one.

## What the engine does not do

- **No sorting.** Rows arrive `created_at DESC` and nothing else is offered. A
  blog wants that order anyway, which is the only reason this example gets away
  with it.
- **No page size below 25.** `?limit=3` returns 25 rows. The shared client asks
  for the floor and slices.
- **No total.** A list response is a bare array, so there is no count to page
  against. Pagination past the first screen is offset paging and a short
  response is how you learn you reached the end.
- **No required relation.** A post with no author is a shape the database will
  accept, because declaring the relation required makes every insert fail. The
  application decides what to render for an unattributed post.

## Layout

    src/lib/server/lyeve.ts        the client, and this app's schema names
    src/routes/+page.server.ts     post list, with relations populated
    src/routes/posts/[slug]/       one post
    src/routes/search/             search, proxied to the admin router
    src/routes/media/[id]/         image bytes, proxied with the credential
    setup/provision.ts             content types and seed data

Nothing outside `src/lib/server/` and the `.server.ts` files ever touches the
engine. That is not a style preference: the credential lives in this process,
and SvelteKit refuses to bundle a `$lib/server` import into the browser.
