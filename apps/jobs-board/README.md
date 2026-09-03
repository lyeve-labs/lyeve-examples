# Job board

A public job board with a working application form. Fifteen roles from five
employers, a search box, a contract type filter, and an application that accepts
a CV file and stores it in the engine's media library.

## What this example proves

Two things the other examples do not cover together:

1. **Search that a member of the public can use.** Full-text search lives on the
   admin router. There is no public equivalent, so the search box on the index
   page is proxied by this app's server, which is the only party holding a
   credential the engine accepts.
2. **A public write path that carries a file.** An applicant uploads a CV, the
   app puts it in the media library, and the returned media id is recorded on
   the application. Nothing about the upload is anonymous from the engine's
   point of view, even though it is anonymous from the applicant's.

## The upload path, and why it is shaped this way

    browser  ->  SvelteKit form action  ->  POST /api/admin/media   (multipart)
                                        ->  POST /api/admin/content (media id)

The file goes to this app's server first. It never goes to the engine directly,
because `POST /api/admin/media` requires a bearer token, and the only ways to let
a browser post there are to ship the credential to the browser or to mint a
short-lived one per upload. The first hands every visitor the whole content API.
The second does not exist in the product: there are no scoped upload tokens and
no presigned upload URLs.

So the app reads the file, checks it, and passes it on. The same argument
applies in reverse for reading media back, which is what `src/routes/media/[id]`
is for.

## Engine features exercised

| Feature | Where |
|---|---|
| Three content types, applied in dependency order | `setup/provision.ts` |
| `belongs_to` relations (listing to employer, application to listing) | `setup/provision.ts` |
| `populate` to inflate a relation in one round trip | `src/routes/+page.server.ts` |
| `filters[]` exact-match filtering on an indexed column | `src/routes/+page.server.ts` |
| Full-text search on the admin router | `src/routes/+page.server.ts` |
| Writes through `POST /api/admin/content` | `setup/provision.ts`, the apply action |
| Multipart upload to `POST /api/admin/media` | `src/routes/jobs/[slug]/+page.server.ts` |
| Authenticated media download, proxied | `src/routes/media/[id]/+server.ts` |
| `number` fields and an `email` field, which becomes a CHECK constraint on PostgreSQL | `setup/provision.ts` |

## What the product does not do

Everything below is a limitation of the engine, not of this example. Each one
changed how the app is written.

- **No anonymous read.** Every page here is server rendered because a browser
  cannot authenticate to the engine at all.
- **No public search route.** `GET /api/admin/search` is admin-only, so a public
  search box always costs you a proxy.
- **`filters[]` is exact equality and nothing else.** No ranges, no `LIKE`, no
  OR. That is why the contract type filter works (the column stores a fixed
  token) and why there is no minimum salary filter (that would need `>=`).
- **No filter on search.** Search takes a query and a schema. When a visitor
  searches and filters at the same time, the contract filter is applied to the
  results after they come back.
- **No sort parameter.** Rows always arrive `created_at DESC`. Ordering by
  salary is done in the app, over the rows already fetched, so it is a sort of
  the page rather than of the table.
- **No totals and no pages.** A content read returns a bare JSON array with no
  `total` and no `has_more`, and `limit` is clamped to 25..200. The count on the
  index page is the number of rows fetched, not the number that exist.
- **Relations cannot be required.** A `required: true` relation makes every
  insert fail, so `jobs_listings.company` and `jobs_applications.listing` are
  optional in the schema and mandatory in the app. A row written by any other
  client can have no employer.
- **Relations are asymmetric.** You write `company` and read back `company_id`,
  and the bare `company` key reads as null unless you populated it.
- **There is no file field type.** A CV is a media record plus a text column
  holding its id. Nothing in the engine ties the two together: delete the media
  and the application keeps a dangling id.
- **Media has no per-record access control.** Any credential that can read one
  media record can read all of them, and media ids are not secret. That is why
  `/media/[id]` in this app serves images only and refuses everything else. An
  unguarded proxy would publish every applicant's CV to anyone who guesses a
  uuid.
- **Nothing notifies the employer.** The engine records the application and that
  is the end of it. No email is sent by this example.
- **No spam control.** The form has no rate limit and no captcha. A real board
  needs both, and neither is something the engine provides for a public form.

Applications are written with `status: draft` and are never read back by this
app, because there is no per-application access control to read them safely with.
Look at them in the admin UI.

## Running it

From the repo root:

    make up            # boot postgres and the engine
    make install
    make setup         # provisions and seeds every example, this one included
    make dev-jobs-board

Then open <http://localhost:5183>.

To provision only this example:

    set -a; . ./.env; set +a
    cd apps/jobs-board && pnpm run setup

`pnpm run setup` is safe to run twice. Applying an existing content type is accepted,
and the seed stops if the board already has listings.

One deployment note: the Node adapter caps a request body at 512 KB by default,
which is smaller than plenty of CVs. A built copy of this app needs
`BODY_SIZE_LIMIT` raised (`BODY_SIZE_LIMIT=8M node build`). The dev server has
no such limit, so the ceiling only appears after `pnpm build`.

## Files worth reading

- `setup/provision.ts`: the three content types and the seed.
- `src/routes/+page.server.ts`: browse, search, filter and sort, and which of
  those the engine does.
- `src/routes/jobs/[slug]/+page.server.ts`: the apply action, its validation, the
  upload, and the write.
- `src/routes/media/[id]/+server.ts`: the credential boundary for media, and
  the check that keeps it from leaking CVs.
