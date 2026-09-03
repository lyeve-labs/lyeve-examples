# The verified recipe

Every statement here was executed against a live engine on 2026-09-03, not read
from documentation. Where the engine behaves differently from what its own docs
or the benchmark profiles suggest, the engine wins and the difference is noted.

## 1. Boot

The published container images are not anonymously pullable, so the engine is
built from the sibling `lyeve-core/` checkout. The license public key must be
injected at link time. A binary linked without it boots at the free tier, and
says so only in its log (`license: no public key was linked into this build`).

    cd cmd/lyeve                   # cmd/lyeve is its own Go module
    go list -deps -f '{{if eq .Name "license"}}{{.ImportPath}}{{end}}' .
    go build -ldflags "-X <license package>.PublicKeyHex=$HEX" -o bin/lyeve .

The license package has moved before, so `platform/scripts/up.sh` reads it
from the build graph rather than naming it. The linker ignores a `-X` that
names a symbol nobody declares, so a build against a stale path succeeds and
verifies nothing.

The license and the public key must belong to one keypair. `make up` takes both
from `LYEVE_LICENSE_KEY` and `LICENSE_PUBLIC_KEY_HEX` in the environment and
links the key into the build, so a change to either rebuilds the engine.

Set `JWT_KEY_PATH` somewhere writable. Left at its default the engine logs
`mkdir /var/lib/lyeve: permission denied` and silently falls back to HS256.

Two listeners, and the split matters more than it looks:

| Port | Router | Carries |
|------|--------|---------|
| `ADMIN_LISTEN_ADDR` | admin | schemas, content writes, search, media, most plugins |
| `API_LISTEN_ADDR` | public v1 | content reads, `/api/v1/auth/token` |

## 2. There is no anonymous read

`POST /api/v1/auth/token` and the unauthenticated probes (`/healthz`, `/readyz`)
are the only doors. Every content and schema route sits behind `requireAuth`.
`/api/v1/health` is **not** public despite the name, so point load balancers at
`/readyz`.

This is the single fact that decides the architecture of every example: a
browser cannot talk to the engine. Each app is a **backend-for-frontend**: the
SvelteKit server holds the credential and the browser only ever talks to
SvelteKit.

## 3. First admin

    POST /api/admin/setup {"email","password","setup_token"}   -> 201 {user, token, csrf_token}

Only works while the users table is empty, and only for a caller holding the
setup token: the engine's `LYEVE_SETUP_TOKEN` (16 characters or more), or the
one-time token it prints to its log at boot when that is unset. The token may
travel in the `X-Setup-Token` header instead of the body. A missing or wrong
token is a 401. `platform/scripts/up.sh` generates one into
`.stack/secrets.env` and sends it. Afterwards:

    POST /api/admin/auth/login {"email","password"}     -> {token, ...}

Tokens last `JWT_EXPIRY_SECS` (default 900s). The API router wires **no refresh
store**, so a server-side client re-logs in rather than refreshing.

## 4. Schemas

    POST /api/admin/schemas -> 200 (not 201)

The field-type key is `field_type`, never `type`. The response is not the
document you sent: `system:true` fields (`id`, `created_at`, `updated_at`) are
injected, so never diff your definition against the response.

`default` on a field is accepted and then ignored. No DEFAULT clause is ever
emitted. Set values on write instead.

### Relations must be `required: false`

A `required: true` belongs_to relation generates two columns, `author UUID NOT
NULL` and `author_id UUID NOT NULL`, and the write path only ever populates the
second. Every insert then fails:

    required: true   ->  POST /api/v1/content/post  ->  422 failed to create content
    required: false  ->  POST /api/v1/content/post  ->  201

Reproduced end to end. Declare every relation optional and enforce the
requirement in the application.

Create the target schema before the schema that points at it. The FK references
`_authors("id")` and the apply fails if that table does not exist yet.

## 5. Writing content: pick the right door

There are two write paths and they are not equivalent.

| | `POST /api/v1/content/{schema}` | `POST /api/admin/content` |
|---|---|---|
| Body | `{"data":{...}}` | `{schema, slug, title, body:{...}, status}` |
| Lands in | `_<schema>` table only | `sys_content_entries`, mirrored to `_<schema>` |
| Visible to `/api/v1` reads | yes | yes |
| Visible to search | **no** | yes |
| Visible in the admin UI | no | yes |

**Use `POST /api/admin/content` for everything.** It is the only path that
produces content the whole product can see. Verified: content written through
`/api/v1` returns `total: 0` from search forever, with no error.

Its validation catches people out. `title` is required at the top level **and**
again inside `body`, because `body` is validated against the schema's own
fields. `slug` is required, normalized, and rejects control characters and `%`.

### A slug is unique per tenant, not per content type

`sys_content_entries` carries `UNIQUE (slug, tenant_id)`. There is no schema in
that index, so **one content type's slug blocks every other type's**. A page
slugged `about` stops a section, a product or a post ever being slugged `about`
in the same tenant.

The refusal is a `409` whose body names no field, so it reads like a duplicate
within the type you are writing. It is not. Verified: creating `about` under a
second content type answers 409 while a fresh slug under the same type answers
201.

Two consequences worth designing around. A URL segment that repeats across
sections of a site cannot be the entry slug, so keep the public segment as an
ordinary field and give the entry a namespaced slug. And a check for "does this
slug exist" has to look in the admin store, because a `filters[slug]` lookup on
the public route only sees the one content type you asked about and will tell
you the slug is free when it is not.
`status` defaults to `draft`, and only admin/super_admin may set `published`.

## 6. Reading content

    GET /api/v1/content/{schema}?limit=&offset=&filters[col]=&populate=&depth=

Returns a **bare JSON array**, with no envelope, no total and no has_more.

- `limit` is clamped to **25..200**. `?limit=3` returns 25 rows. Slice in the app.
- `filters[col]=value` is exact equality only. There is **no** `sort`, `order`,
  `fields`, `page` or `status` parameter. Unknown params are ignored silently.
  Rows always come back `created_at DESC`.
- **A relation is filtered by its foreign key, not its field name.**
  `filters[author_id]=<uuid>` narrows the list. `filters[author]=<uuid>` is a
  400, as is any column that does not exist. And because the engine does not
  join, **there is no way to filter by a related record's own field**: to list
  posts in the category whose slug is `engineering`, resolve that slug to a
  category id first, then filter on `category_id`. That is two requests, and no
  parameter combination collapses it into one.
- `populate=author` inflates the relation into the full related object.
  `depth=1` and `populate=*` do the same for every relation.

Relations are asymmetric: you **write** `author`, and you **read** `author_id`.
A read also returns a dead `author: null` key, the orphan column from section 4.
Ignore it unless you populated.

## 7. Search

`GET /api/admin/search?q=` on the admin port only. There is no `/api/v1/search`, so a
public search box is necessarily proxied through the BFF.

## 8. Media

`POST /api/admin/media` (multipart, field `file`) returns a JSON **array**.
Records carry `key` but no usable public `url`.

`GET /api/admin/media/{id}/download` returns the bytes, and **401s without a
token**, so a browser `<img src>` pointed at the engine shows a broken image.
Each app proxies media through its own server route.

## 9. Logging in is rate limited harder than you expect

The rate-limit plugin seeds a rule of **five logins per fifteen minutes per
address**, for both `POST /api/admin/auth/login` and `POST /api/v1/auth/token`.
A sixth attempt inside the window answers 429.

Two things about this are worth knowing before it costs you an afternoon.

**There are two independent limiters, and the documented setting governs the
other one.** Core reads `PUBLIC_RATE_LIMITS`, and its own tests cover an entry
for `POST:/api/admin/auth/login`. That setting has no effect here: the 429 comes
from the rate-limit plugin, whose rules are rows in `sys_rate_limit_rules`.
Setting `PUBLIC_RATE_LIMITS` and watching the limit not move is the expected
outcome, not a misconfiguration.

The rules are editable through `GET`/`PUT /api/admin/rate-limits`, which is what
`platform/scripts/up.sh` does for the local stack.

**Cache the token.** Fifteen minutes is long enough that retrying will not save
a process which logs in per operation. The shared client keeps one token per
instance for its lifetime and re-authenticates only on expiry or a 401, and it
backs off and retries a 429 because a real deployment will return one.

## 10. Errors

Three different envelopes are in play, so parse defensively:

    {"error","code","request_id"}                        most routes
    {"errors":[{"field","message","code","rule"}]}       422 validation, no top-level error key

Store failures surface as 503 even when the caller caused them.
