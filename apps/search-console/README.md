# Search console

A knowledge base of 433 operations articles with a search box in front of it,
and a console for the rest of the search plugin: synonyms, ranking rules,
instant search, reindexing and analytics. Six other examples call
`GET /api/admin/search?q=` and render the hits. This one uses everything else,
and most of what it found is a limit rather than a feature.

## Read this first

**Search has no public route.** `/api/admin/search` is on the admin router
behind auth, and there is no `/api/v1` equivalent. Every query on the public
knowledge base page was made by the SvelteKit server with a credential the
browser never sees. A public search box is necessarily a proxy, and that is
architecture rather than preference.

**Search only sees content written through the admin route.** It reads
`sys_content_entries`, and only `POST /api/admin/content` puts a row there. An
article written to `POST /api/v1/content/kb_articles` lands in the generated
table, is readable through the content router, and is invisible to every search
in this app permanently, with `total: 0` and no error anywhere. This is why
`setup/provision.ts` writes with `createContent` and why that is not negotiable.

**A synonym group changes nothing in the engine.** The plugin stores groups,
serves four routes for managing them, and has a query-expansion helper that
rewrites `p99` into `p99 OR latency OR percentile`. Nothing calls that helper.
The native search builds its SQL from the request text alone, so a group can be
created, listed, updated and deleted without ever moving a result. This app
therefore reads the groups and does the rewrite itself, in
`src/lib/server/expand.ts`, which is the only reason the front page can show a
synonym working. Applying a stored group is the caller's job.

**A ranking config changes nothing either, and no reindex will help.** The
config keys on `(tenant_id, schema_name)` and holds a title weight, a body
weight, a tag weight and a list of boost rules. Nothing reads it. A hit's score
comes from `ts_rank` over a tsvector whose weights are compiled into a database
trigger: title `A`, body `B`, `meta.tags` `C`. Changing a weight cannot affect
that, and a reindex rewrites the vector with the same compiled weights, so the
answer to "does a ranking change need a reindex" is that it needs one no more
than it needs anything else. This app applies the stored weights itself, in
`src/lib/server/rank.ts`, and says so on every page that shows a score.

**Nothing records a search.** There are two POST routes under
`/analytics`, and that is the tell: the caller reports its own analytics. The
search handler runs the query, answers, and writes nothing. An application that
never posts to `/api/admin/search/analytics/log` has a summary of zeroes
forever, and no part of the product says so. An engine that six other examples
have been searching against for a day still reports `total_searches: 0`.
Everything on this app's analytics tab was written by its own front page.

**A click-through rate cannot be computed from this API.** The click endpoint
writes `clicked_entry_id` onto an analytics row. The summary returns total
searches, unique queries, average result count, average duration, the top twenty
queries and the zero-result percentage, and there is no route that lists raw
rows. So the clicks this app reports go in and cannot come back out. The console
says "not available" rather than showing a number it cannot obtain.

**Reindex is not scoped to this app.** A super_admin with no tenant header
resolves to the implicit `default` tenant, which the handler maps to the whole
corpus. Pressing the button rebuilds every example's content on the shared
engine.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/search-console && pnpm run setup && pnpm dev

Then open http://localhost:5194. Provisioning writes 433 articles, one request
per article with six in flight, because there is no bulk write route.

## What it demonstrates

### The corpus is the point

Search cannot be judged on three rows, so `setup/corpus.ts` composes 420
articles from ten subjects, ten failure modes each, six operating contexts and
six paragraphs of diagnosis, plus thirteen written by hand to make one synonym
and one ranking rule visible. It is deterministic, so the numbers below stay
true.

### A synonym, applied by the app

`p99` appears in exactly three of this app's 433 articles and none of them uses
the word latency. Provisioning creates a group with base term `p99` and synonyms
`latency, percentile`.

- [`/?q=p99&raw=1`](http://localhost:5194/?q=p99&raw=1) searches the raw term
  and finds three.
- [`/?q=p99`](http://localhost:5194/?q=p99) rewrites it to `p99 OR latency OR
  percentile` and finds every latency article as well.

The page prints what it sent to the engine, so the rewrite is visible rather
than asserted. The matching rule is deliberately the one the unused helper
would have used: the whole query must equal the base term, because `base_term`
is a single indexed column with a unique constraint rather than a pattern.

`OR` and a leading `-` for exclusion work because Postgres parses the query
with `websearch_to_tsquery`. On MySQL and SQL Server search is a `LIKE` over the
whole phrase, so the rewritten string would match nothing. The expansion is an
application feature, not a portable one.

### A ranking rule, applied by the app

Twelve articles match "checkpoint". Four name it in the title and never use it
in the body. Eight discuss it in the body and never in the title.

- [`/?q=checkpoint`](http://localhost:5194/?q=checkpoint) is the engine's own
  order. The four title matches lead, because the vector weights the title `A`.
- [`/?q=checkpoint&rank=config`](http://localhost:5194/?q=checkpoint&rank=config)
  re-scores the same page with the stored config. At the defaults, title 1.0 and
  body 0.4, the same four still lead.
- Set the title weight to `0` and the body weight to `3` on the console's
  ranking tab, save, and the same link puts all eight body articles above the
  four titled ones. The unswitched search does not move.

The scoring this app defines is
`engine rank + title_weight * title hits + body_weight * body hits + tag_weight
* keyword hits + matched boosts`. Boost rules carry a free-text field name and
the engine attaches no meaning to it, so this app answers four of them:
`schema`, `status`, `keyword` and `title`. A rule with any other field name is
stored happily by the engine and reported as unmatchable here, because a rule
that will never fire should not look like one that works.

Two honest limits. The re-score runs over the page the engine returned, so it
can reorder twenty results and cannot promote the twenty-first into them. That
is the reason the page size here is twenty rather than ten: the checkpoint
example is twelve hits, and a page too small to hold the result set cannot show
a reordering at all. And the term counting uses a prefix match as a stand-in for
the database's stemming, which is close but not the same algorithm.

The third weight is called `tag_weight` and there are no tags: the engine reads
them from `meta.tags`, and the admin content write path never sets `meta`, so
the `C`-weighted third of every vector in this corpus is empty. This app maps
that weight onto its own `keywords` field so it does something.

### Instant search is a different feature

`/api/admin/search/instant` is not a small full-text search. It is
`LOWER(title) LIKE LOWER(q || '%')`: a prefix of the title, nothing else. No
body, no keywords, no stemming, published entries only, ordered by
`updated_at` rather than by relevance, capped at 50, and no total. It is the one
search route that reports its own timing, as `took_ms`.

The [`/instant`](http://localhost:5194/instant) page types into it through this
app's own `/api/instant` endpoint and shows the full-search total for the same
term beside it. `che` suggests the checkpoint titles. `point` suggests nothing
while the full search still finds them. `indexes` suggests nothing while the
full search treats it as `index`.

### Analytics, written by the caller

Every search on the front page posts to `/analytics/log` with the query the
reader typed, the result count, the round trip this app measured and a session
id from a cookie. Every result link goes through `/go/[id]`, which posts to
`/analytics/click` and then redirects, because the click has to be reported
server-side with the same session and the exact query text that was logged.

Preloading had to be narrowed for this. `app.html` turns on
`data-sveltekit-preload-data="hover"`, and the front page's `load` posts the
analytics write, so every link to a query would have logged a search nobody ran
as the pointer crossed it. The layout sets `tap` on `<main>` instead. A load
function with a side effect has to think about prefetching.

Three things about that matching are worth knowing. The click is attached to the
most recent logged search with the same query text and session id, so both have
to agree exactly. Only the first click on a logged search is kept, because the
update matches on `clicked_entry_id IS NULL`. And `duration_ms` is whatever the
caller says it is, so the average duration on the console is this app's round
trip and not an engine measurement.

### Reindex

Synchronous, super_admin only, and on this engine global. It streams every entry
in `sys_content_entries` in batches of five hundred keys, and for a row whose
stored index already matches its content it writes nothing and counts it as
indexed anyway. So on a current corpus it is a full read and no writes, and
`indexed` is the number of rows examined rather than rewritten. The console
measures the elapsed time itself, because the response carries none.

It takes no exclusive lock and rewrites nothing that is already current, so it is
safe to run while serving. It is synchronous, though, and on a corpus large
enough the pass can outlive the engine's write timeout and hand the caller a
dropped connection instead of a result.

What it is actually for is a row the trigger never saw: content that predates the
plugin's migration, or a row written while the plugin was unlicensed. It is not
needed after an ordinary write, because the trigger fires on insert and on any
update of the title, body or meta.

## The response shape, confirmed

    {
      "results": [ ... ],
      "total": 27,
      "limit": 10,
      "offset": 0,
      "query": "index",
      "facets": { "schema": [ { "value": "kb_articles", "count": 27 },
                              { "value": "blog_posts",  "count": 1 } ] }
    }

One hit carries `entry_id`, `schema`, `tenant_id`, `slug`, `title`, `body`,
`meta`, `status`, `published_at`, `created_by`, `created_at`, `updated_at` and
`rank`, plus `snippets` when `highlight=true` and `tags` when `meta.tags` is
set. Three details are easy to get wrong:

- **`body` is the document as written, not the row the content router returns.**
  A relation therefore appears under its own field name holding an id: this
  app's articles read back `body.category`, while the same relation from
  `/api/v1/content/kb_articles` is `category_id`. Writing `category` and reading
  `category` is specific to search.
- **`rank` is `ts_rank` on Postgres, `1.0` on MySQL and SQL Server for any match, and
  `0.0` everywhere for a search with no query text.**
- **`snippets` is Postgres only, and the body snippet is cut from the body's raw
  JSON**, so it contains field names and quotation marks. The markers are the
  literal strings `<mark>` and `</mark>` inside otherwise unescaped document
  text. `src/lib/highlight.ts` parses them rather than rendering the string as
  HTML.

## GET and POST

Both verbs run the same search and answer the same envelope. The console's
last tab runs them side by side. Where they differ:

| | `GET` | `POST` |
|---|---|---|
| Unknown parameter | ignored in silence | 400, because the body is decoded strictly |
| Unparseable date | dropped, search runs unfiltered | 400 |
| `facets` | comma split, deduplicated, capped at 3 | the array as given |
| `tags` | comma split | an array |
| `highlight` | the literal string `true` | a boolean |
| Null byte in the criteria | rejected explicitly | no check |

Both accept `q`, `schema`, `status`, `tags`, `facets`, `published_after`,
`published_before`, `limit`, `offset` and `highlight`, and nothing else. At
least one of `q`, `schema`, `status` and `tags` is required: all four empty is a
400 rather than a browse of everything. `limit` defaults to 20 and is capped at
200, with no floor, so unlike the content route a page of three is a page of
three. A `tenant_id` in the body is accepted by the decoder and then overwritten
with the tenant from the request context.

There is no fuzziness parameter, no field selector and no sort. POST is the
quickest way to establish that, because it says so with a 400 instead of
ignoring the parameter.

## What the product does not do

- **No public search route**, so a search box on a public site is a proxy.
- **No filter on a relation.** The criteria are `q`, `schema`, `status`, `tags`
  and a `published_at` range. The category filter on the front page runs in this
  process over the page that came back, which is why the total stays the
  unfiltered total and a filtered page can be short. The page says so.
- **Facets ignore every filter but the query and the tenant.** Asking for
  `schema=kb_articles&facets=schema` still returns a bucket per content type in
  the whole tenant, including the other examples'. Confirmed against a live
  engine.
- **Synonyms and ranking are stored, not applied.** Four routes and three routes
  respectively, for records nothing reads.
- **No automatic analytics**, and no way to read a click back out.
- **A duplicate synonym base term is a 409 whose body names no field**, so the
  caller has to know what the conflict was about. Provisioning reads the list
  first rather than relying on the status code to explain itself.
- **`GET /api/admin/search/ranking` answers 200 when nothing is stored**,
  returning the defaults with a nil id, so a 200 is not evidence that a record
  exists. This app reports `stored` separately.
- **The ranking route's default schema is the literal string `*`**, which is an
  ordinary key and not a wildcard.
- **Stopwords are real.** `?q=the` answers `total: 0`, because the English
  configuration drops it before the query is built.

## Layout

    setup/corpus.ts                the 433 articles, composed deterministically
    setup/provision.ts             content types, seed, and the demo synonym group
    src/lib/server/search.ts       every search route, with the shapes it returns
    src/lib/server/expand.ts       synonym expansion, because the engine does none
    src/lib/server/rank.ts         ranking applied, because the engine applies none
    src/lib/server/session.ts      the session id analytics are grouped by
    src/lib/server/clicks.ts       what this process reported, since it cannot read it back
    src/lib/highlight.ts           parsing an engine snippet without rendering HTML
    src/routes/+page.server.ts     the public knowledge base, and the analytics write
    src/routes/instant/            instant search as you type, proxied
    src/routes/console/            synonyms, ranking, analytics, reindex, verbs
    src/routes/go/[id]/            the click report, then a redirect
    src/routes/articles/[slug]/    one article, from the content router

Nothing outside `src/lib/server/` and the `.server.ts` and `+server.ts` files
touches the engine. `src/lib/highlight.ts` is deliberately outside that boundary
because it parses a string and calls nothing.
