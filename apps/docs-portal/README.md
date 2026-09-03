# Documentation portal

A two space documentation site: nested pages, a navigation tree, previous and
next links in reading order, and a search box.

## What this example proves

Hierarchical content works on an engine that has no concept of a hierarchy.

A page belongs to a space and, optionally, to another page. Both links are
plain `belongs_to` relations, and the second one points `docs_pages` at itself.
The engine stores those edges and nothing more. It cannot return a tree, it
cannot order a response by anything but the row creation time, and it cannot
say how many rows matched. Everything a documentation site needs from a
hierarchy is assembled in the SvelteKit server after one flat read.

That work is deliberately visible. `src/lib/tree.ts` holds all of it, a hundred
lines including the comments, and the note above `buildTree` says which engine
limitation each part is answering.

## Content types

| Type | Fields |
|------|--------|
| `docs_spaces` | `title`, `slug`, `summary`, `order_index` |
| `docs_pages` | `title`, `slug`, `body`, `order_index`, `space` (relation to `docs_spaces`), `parent` (relation to `docs_pages`) |

Both names are prefixed with the app slug because every example in this
repository shares one engine.

## Engine features exercised

- **Schemas** with a self referencing relation. `docs_pages.parent` points at
  `docs_pages`. The engine creates the table first and adds the foreign key
  afterwards, so a self relation needs no special ordering, unlike a relation
  to another type.
- **Relations, read as ids.** The portal never populates. It reads
  `parent_id` and `space_id` through `relationId()`, which is all a tree needs,
  and resolves the links in memory rather than paying a query per node.
- **Filtered lists.** `filters[space_id]` scopes the page read to one space,
  and `filters[slug]` stands in for the get by slug route the engine does not
  have.
- **Offset paging** to read past the 200 row cap, in `readAll()`.
- **Search**, scoped to `docs_pages` and proxied through the app because the
  route exists on the admin router only.
- **Media**, proxied at `/media/[id]`. The portal seeds no images, but a
  documentation site grows diagrams and screenshots, and the engine download route
  answers 401 to a browser, so the route is here and wired.

## What the product does not do

Every item here is a limitation of the engine, not a shortcut taken by the
example.

1. **No tree query.** A list request returns a flat page of rows. Nesting is
   built in `buildTree`.
2. **No sort parameter.** Rows always arrive newest first. `order_index` is
   applied in the application, so it can only order the rows a response
   happened to contain. That is why the space read pulls every page through
   `readAll` before the tree is built.
3. **No count and no total.** A list response is a bare JSON array. The page
   count on the landing page is the length of a response, not an aggregate.
4. **No field projection.** There is no `fields` parameter, so reading the
   pages of a space returns every body whether the view renders one or not.
   The page view turns that into an advantage and builds the navigation and
   the article from a single read. A space with a thousand long pages would
   want the opposite, and the engine offers no way to ask for it.
5. **Limit is clamped to 25..200.** Smaller requests are served larger, so a
   short list is a slice. Deeper paging is offset paging with no total, and
   the only signal that a page was the last one is that it came back short.
6. **A relation cannot be required.** A `required: true` belongs_to generates
   a second, unused NOT NULL column that the write path never fills, and every
   insert against the type then fails with a 422. So "a page belongs to a
   space" is a rule this application keeps, not one the database enforces.
7. **Nothing stops a cycle.** The parent relation is a nullable foreign key
   pointing at the same table, so a page can be made its own ancestor through
   the admin interface. `buildTree` drops the edge that closes a cycle and
   shows the page at the top level, because the alternative is a render that
   recurses until the stack gives out.
8. **Search scopes to a type, not to a space.** The search route filters by
   content type, status and tags. There is no filter on an arbitrary field, so
   a per space search box means filtering hits after they arrive.
9. **No anonymous read.** Every content route needs a token, so the browser
   never talks to the engine. All engine access lives in `src/lib/server/`,
   and the pages are backend for frontend.
10. **Media needs a token.** Pointing an image tag at the engine download
    route yields 401 and a broken image, which is why `/media/[id]` exists.

## Where the work happens

| Path | Purpose |
|------|---------|
| `src/lib/tree.ts` | Flat rows to nested tree, reading order, breadcrumbs. No engine access. |
| `src/lib/prose.ts` | Splits a stored body into paragraphs and code blocks. |
| `src/lib/server/lyeve.ts` | The client singleton and the two schema names. |
| `src/lib/server/docs.ts` | Every engine read the portal makes. |
| `src/routes/+page.svelte` | Space list with page counts. |
| `src/routes/docs/[space]/` | Space outline with the navigation tree. |
| `src/routes/docs/[space]/[page]/` | Article, breadcrumbs, previous and next. |
| `src/routes/search/` | Search proxied through the server. |
| `setup/provision.ts` | Content types and the seeded guide. |

## Running it

From the repository root:

    make up
    pnpm install
    pnpm --filter @lyeve-examples/docs-portal run setup
    pnpm --filter @lyeve-examples/docs-portal dev

The portal is on http://localhost:5174.

`setup` reads `LYEVE_API_URL`, `LYEVE_ADMIN_URL`, `LYEVE_EMAIL` and
`LYEVE_PASSWORD` from the environment. If your shell does not already carry
them, load the file `make up` wrote:

    set -a; . .env; set +a

Running `setup` again is safe. Applying a content type that exists is accepted,
and the seed stops as soon as it finds a space.
