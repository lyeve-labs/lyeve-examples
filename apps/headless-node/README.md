# headless-node

A LyEve client with no framework in it. Six small TypeScript programs, run one
at a time from the terminal, using the published SDK packages exactly as they
come off npm.

Every other example in this repo is a SvelteKit app, and a framework hides
things. It supplies the fetch, the environment, the place server code is allowed
to live. This one supplies none of that, so what is left is the engine's actual
contract: two ports, one token, two write paths that are not equivalent, and a
handful of behaviors that will cost you an afternoon each if you meet them for
the first time in production.

Read it as a tutorial. Run the scripts in order. They print what they did.

```
src/01-authenticate.ts    log in, and read the token's lifetime
src/02-define-schema.ts   create two content types, one pointing at the other
src/03-write-content.ts   write through the admin route, and why not the other one
src/04-read-content.ts    pages, offsets, cursors, filters, relations
src/05-search.ts          search, and the content search cannot see
src/06-media.ts           upload a file and fetch the bytes back
```

## What this example proves

- The published SDK works, directly, with nothing wrapped around it. It is two
  packages: `@lyeve-labs/client` for the HTTP client, and
  `@lyeve-labs/client-rest` for typed functions over the routes.
- The one piece of glue the SDK does not ship, a base URL, is a dozen lines of
  code, and this shows exactly which dozen.
- The engine has no anonymous read. Everything here is server code because
  there is no other kind of LyEve client.
- The rules that decide whether a LyEve application works are engine rules, not
  framework rules. They are the same whether you build on SvelteKit, Express, a
  cron job or nothing at all.

## The thing that stops people

`createClient` takes a fetch and a header bag. It does not take a base URL.

```ts
const client = createClient(fetch);
await getSchemas(client); // fetch('/api/admin/schemas') -> Failed to parse URL
```

Every function in `@lyeve-labs/client-rest` calls a bare path like
`/api/admin/schemas`. In a browser the page's origin completes it. In Node
nothing does, and the call fails on a URL parse one layer below anything the SDK
can report.

There is a second half to it. The engine is two servers: it builds one router
for `/api/admin` and another for `/api/v1` and binds them to separate listeners.
A client that writes content and reads it, which is every real client, is
talking to two ports. So the wrapper prepends a host, and picks which host from
the path prefix:

```ts
export function routedFetch(hosts: Endpoints): typeof fetch {
	return (input, init) => {
		if (typeof input === 'string' || input instanceof URL) {
			return fetch(absolute(String(input), hosts), init);
		}
		return fetch(new Request(absolute(input.url, hosts), input), init);
	};
}

function absolute(target: string, hosts: Endpoints): string {
	if (!target.startsWith('/')) return target;
	return (target.startsWith('/api/v1') ? hosts.apiUrl : hosts.adminUrl) + target;
}
```

That is the whole trick, and it lives in `src/lyeve.ts` with the reasoning
attached. Everything else in this example is the SDK doing its job.

## Run it

Boot the engine once from the repo root. It builds from the sibling
`lyeve-core` checkout, sets up a development license and creates the first admin
account.

```sh
cd /path/to/lyeve-examples
bash platform/scripts/up.sh    # or make up, where the root Makefile is present
pnpm install                   # once, for every example
```

Then, from `apps/headless-node`:

```sh
cp .env.example .env      # optional: the repo-root .env is read as a fallback

pnpm run setup            # steps 2 and 3, the provisioning pair
pnpm tour                 # all six steps in order

pnpm authenticate         # or run any single step
pnpm define-schema
pnpm write-content
pnpm read-content
pnpm search
pnpm media
```

Every step is safe to run twice. Content types are re-applied rather than
duplicated, and each entry is looked up by slug before it is written.

Steps 2 to 6 share one token, cached in `.lyeve-token.json` and gitignored,
because logging in is rate limited: the engine seeds a rule allowing a burst of
five and then roughly one login every three minutes, per address. Step 1 logs in
anyway, twice, once on each router, because that is what it is demonstrating. Run
it half a dozen times in a row and it will answer 429. That is the engine
protecting the credential, not a fault in the example.

The scripts are TypeScript run straight through Node's type stripping, so there
is no build step and no bundler. `pnpm check` runs `tsc --noEmit` over them.

## Configuration

Read from `.env` here, then from the repo-root `.env`. The first definition of a
key wins, and a variable already set in the shell beats both files.

| Variable | Meaning |
|---|---|
| `LYEVE_ADMIN_URL` | Admin router. Schemas, content writes, search, media. |
| `LYEVE_API_URL` | Public v1 router. Content reads, and `POST /api/v1/auth/token`. |
| `LYEVE_EMAIL` | Admin account. |
| `LYEVE_PASSWORD` | Its password. |

## Engine features this exercises

| Feature | Where | Route |
|---|---|---|
| Setup probe | 01 | `GET /api/admin/setup` |
| Password login | 01 | `POST /api/admin/auth/login` |
| Public token issue | 01 | `POST /api/v1/auth/token` |
| Content types | 02 | `POST /api/admin/schemas`, `GET /api/admin/schemas` |
| belongs_to relations | 02, 04 | a `relation` field with `relation_to` |
| Catalog write | 03 | `POST /api/admin/content` |
| Lookup by slug | 03 | `GET /api/admin/content/slug/{slug}` |
| Offset paging | 04 | `GET /api/v1/content/{type}?limit=&offset=` |
| Cursor paging | 04 | `GET /api/v1/content/{type}/cursor?cursor=&limit=` |
| Filtering | 04 | `?filters[col]=value` |
| Relation population | 04 | `?populate=author`, `?depth=1` |
| Single entry | 04 | `GET /api/v1/content/{type}/{id}` |
| Full-text search | 05 | `GET /api/admin/search?q=` |
| Direct table write | 05 | `POST /api/v1/content/{type}` (as a demonstration of what it costs) |
| Media upload | 06 | `POST /api/admin/media` |
| Media download | 06 | `GET /api/admin/media/{id}/download` |

## What the SDK covers, and what it does not

`@lyeve-labs/client-rest` models most admin routes. It does not model
everything, and the gaps are all in places you will reach on day one.

| You need | The SDK gives you | Otherwise |
|---|---|---|
| Log in | `login()`, `isMFAChallenge()` | typed as `{user, token}`, so `csrf_token` and any `refresh_token` are dropped |
| Content types | `getSchemas()`, `upsertSchema()` | complete |
| Catalog write | nothing | `client.post('/api/admin/content', ...)` |
| List content | `listContent(type, client, limit, offset)` | filters, `populate` and `depth` are hand-built query strings |
| Cursor pages | `listContentCursor()` | complete in 0.2.0. 0.1.6 and earlier read the wrong keys and returned an empty page every time |
| Search | `search(q, client)` | `schema`, `status`, `limit`, `offset` and `highlight` are hand-built |
| Media | nothing at all | `fetch` directly: the client sets `Content-Type: application/json` and runs `JSON.stringify` over every body, so multipart and binary cannot pass through it |
| Errors | `ApiError` with `status` and `message` | a 422 answers `{"errors":[...]}` with no top-level `error` key, so `message` carries the raw body |

None of this makes the SDK the wrong choice. It means the client is a client and
not a framework: when a route is not modeled, you call it on the same client
with the same auth and the same base URL wrapper. The handful of lines that
takes is in `src/03-write-content.ts` and `src/05-search.ts`.

## Do not use @lyeve-labs/client-svelte

The published 0.1.4 does not work by either resolution path, so no amount of
configuration rescues it.

- Its `svelte` export condition points at `./src/index.svelte.ts`, and the
  package publishes only `dist`. The file a Svelte bundler is told to load is
  not in the tarball.
- Its `import` condition points at `dist/index.js`, which is a plain `.js` file
  containing uncompiled `$state` runes. The Svelte compiler never sees a `.js`
  file, so the runes reach the runtime as undefined identifiers.

The SvelteKit examples in this repo call the engine from `+page.server.ts` with
`@lyeve-labs/client` and `@lyeve-labs/client-rest`, which is what you want in a
SvelteKit app regardless: the credential has to stay on the server, so a
reactive client-side store has nothing to talk to.

## What the product does not support

Honest limits, all of them load-bearing. Each one is demonstrated by the script
named beside it.

- **No anonymous read at all** (01). Content, schemas, search and media are
  behind a bearer token. A browser cannot talk to the engine, so every LyEve
  application is a backend for a frontend, whether or not it wanted to be.
- **No refresh on this path** (01). The admin login issues no refresh token to
  a server-side client. A process that outlives its token logs in again.
- **Logging in is rate limited hard** (01). A seeded rule allows a burst of five
  and then about one login every three minutes, per address, and it applies to
  both `POST /api/admin/auth/login` and `POST /api/v1/auth/token`. A client that
  logs in per request stops working within seconds. Hold the token.
- **A required relation breaks every insert** (02). The generator emits both a
  dead `<name>` column and the real `<name>_id`, both NOT NULL, and only the
  second is ever written. Declare relations optional and enforce the
  requirement in your own code.
- **`default` on a field is accepted and ignored** (02). No DEFAULT clause is
  emitted. Set the value when you write.
- **Content written to `/api/v1/content/{type}` is invisible to search and to
  the admin UI, permanently** (05). No error, no warning, no repair short of
  writing it again through the admin route.
- **`limit` is clamped to 25..200 on the offset route** (04). Asking for 3
  returns 25. Smaller pages are a slice in your code.
- **The two list endpoints do not agree** (04). The offset route
  clamps the limit and orders by `created_at` descending. The cursor route at
  `/cursor` honors the limit it is given and walks by id ascending. Which one
  you use changes the page size and the order, so an export and a feed cannot
  share a reader.
- **No total, and no `has_more`** (04). The offset route answers a bare array.
  The last page is a short page.
- **No sort parameter** (04). Rows come back `created_at` descending. Any other
  order is yours to apply, over a page you already hold.
- **Filters are exact equality on one column** (04). No ranges, no LIKE, no OR,
  no null test, and no field selection.
- **Unknown query parameters are ignored in silence** (04). A misspelled filter
  reads as no filter, which is a full page of the wrong rows.
- **A slug is unique per tenant across every content type at once** (03), not
  per type. Two examples that both seed `welcome` collide with a 409.
- **Search is admin-only** (05). There is no `/api/v1/search`, so a public
  search box is always proxied by your own server.
- **Media needs a token to download** (06). Pointing an `img` tag at the engine
  gives a 401 and a broken image. Serve media from a route of your own and hold
  the credential there.
- **Media records carry no usable public URL** (06). Store the id on the entry,
  never a URL.
- **An uploaded image is not stored byte for byte** (06). The engine decodes and
  re-encodes anything it recognizes in order to strip EXIF, so the file that
  comes back is the same picture and a different file. A 144 byte PNG comes back
  as 164 bytes. Dimensions and content type survive. A checksum of your upload
  does not.
- **Errors arrive in more than one envelope** (03, 06). Most routes answer
  `{error, code, request_id}`. A 422 answers `{errors:[...]}` with no top-level
  `error` key. A store failure answers 503 even when the caller caused it.

## What this example does not cover

Webhooks, GraphQL, realtime, multi-tenancy, workflows, API keys and the rest of
the plugin surface. `@lyeve-labs/client-rest` models many of those routes, and
they are reached exactly the way everything here is reached: same client, same
token, same base URL wrapper.

## Files

```
package.json           one script per step, plus setup, tour and check
tsconfig.json          type checking only; Node strips the types at run time
.env.example           the four variables, pointing at the local stack
.gitignore             the cached token, which is a credential
setup/provision.ts     steps 2 and 3, for the repo-wide provisioning pass
src/lyeve.ts           env, the base URL wrapper, sign-in, relation helpers
src/01-authenticate.ts
src/02-define-schema.ts
src/03-write-content.ts
src/04-read-content.ts
src/05-search.ts
src/06-media.ts
```

`src/lyeve.ts` also carries local copies of `belongsTo`, `relationId` and
`related`, the three pure helpers the other examples import from the repo's
shared package. They are reproduced here so this example depends on the
published packages and nothing else, which is the point of it.
