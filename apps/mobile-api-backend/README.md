# Mobile API backend

A transit agency's console for the credentials its phone app carries: mint a
scoped API key, meter what it spends, read its request trail, and cap it. Plus
`client/`, a Node program that plays the phone.

This is the one example where something other than a server talks to the
engine. Every other app here is a backend-for-frontend because a browser cannot
be given a credential. A native client can be given a key, and a key is the
credential the engine designs for that.

## Read this before you copy it

**A key in a shipped app binary is a published key.** Anything on a device can
be extracted from it, and this key is a bearer credential with no device
binding, no user identity and no proof-of-possession. The pattern this example
demonstrates belongs to a server, a CI job, a kiosk you control, or a native
client whose key is provisioned per install and revocable. What a real phone app
does instead is authenticate its user against your own backend, receive a
short-lived token, and let the backend hold the key. The engine supports that
too: `POST /api/v1/auth/token` issues a 15-minute JWT, and there is no refresh
store on the public router, so the backend logs in again rather than refreshing.

**Scope granularity stops at the resource.** `content:read` grants every content
type on the engine, not this app's three. A key does carry a `schemas` list, and
that list is stored, returned by the API, and read by nothing: the engine drops
it when it turns a key into request claims, so it restricts nothing. There is no
way to mint a key that can read `mobile_notices` and not `blog_posts`.

**The per-schema permission layer does not apply to keys.** Role permissions and
field masking on content reads are resolved from JWT claims, and a request
carrying only `X-API-Key` has none, so that check returns true and no field is
masked. Scopes are the whole of a key's authorization.

**The tenant quota is not this app's to set.** The stack runs single-tenant, so
one quota row governs every example sharing the engine. This console reads it
and offers no write, and the per-key monthly limit is the lever that is actually
isolated. The write, for a deployment where the tenant is yours, is
`PUT /api/admin/quotas/{tenant}` with `{"requests_limit": 100000}`. A limit
above zero also switches on a counter write for every request, and a 429 needs
`is_hard_limit` and `block_on_exceeded` set together: a limit on its own only
changes headers.

**Neither 429 tells a client how to recover.** The per-key refusal carries
`X-RateLimit-Exceeded: true` and no `Retry-After` and no remaining count. The
tenant refusal carries `X-Quota-Blocked: true` and a body naming the limit.
Nothing resets a per-key counter: raising `monthly_limit` is the only way back
before the month turns over.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/mobile-api-backend
    pnpm run setup       # content types, seed data, and two API keys
    pnpm dev         # console on http://localhost:5189

Then, in another shell, be the phone:

    pnpm client        # the reader key: feed, quota, and two refusals
    pnpm client:limit  # the probe key: spends its monthly allowance

`pnpm run setup` writes the two raw keys into `client/.env`, which is gitignored and
is the only copy: the engine stores a peppered HMAC and returns the plaintext
once. Re-running setup keeps a key that is still enabled and whose secret is
still in that file, and mints a replacement when either is missing, a revoked
key included. Deleting the file and running setup again rotates both, and takes
their meters and trails with the old rows.

## What it demonstrates

**A key needs scopes, and roles are not smaller scopes.** The mint form offers
scopes and no roles, deliberately. `RequireScoped` waves through any key holding
`admin` or `super_admin`, and `requireRole` waves through any key holding no
role at all, so a role on a machine credential removes a gate rather than
narrowing one. On the admin router that combination means scopes are the only
thing between a scope-only key and the admin API: mint `media:read` and the key
reaches `/api/admin/media`, including the download route.

An empty scope list is fail-closed, which is the right default and an easy
mistake to ship: the published SDK's `createAPIKey` input has no `scopes` field
at all, so a key minted through it authenticates and is then refused on every
route it was minted for, with a 403 that does not mention scopes. Post to
`/api/admin/api-keys` by hand. `setup/provision.ts` and `src/lib/server/keys.ts`
both do.

**The scope vocabulary is derived, not published.** There is no catalog
endpoint. The engine builds the pair a request needs from the request:
the resource is the third path segment and the action comes from the method
(GET and HEAD read, DELETE deletes, everything else writes). So
`GET /api/v1/content/mobile_notices` wants `content:read`,
`POST` the same path wants `content:write`, and `GET /api/admin/api-keys` wants
`api-keys:read`. `src/lib/scopes.ts` is that rule, and the key page uses it to
say what a key may call without calling anything.

One route breaks the pattern usefully. `GET /api/v1/quotas/status` is declared
in the usage plugin's authenticated group rather than its scoped group, so it is
not scope-checked: a key with an empty scope list gets a full answer there. The
obvious `quotas:read` is not needed and would not help.

**Two meters, two limits, one plugin.** The usage plugin counts requests per
tenant and writes `X-Quota-Requests-Used`, `-Limit` and `-Pct` onto every
response it sees, plus `X-Quota-Warning-80`, `-90`, `X-Quota-Exceeded` and
`X-Quota-Blocked` when they apply. Its middleware runs before authentication, so
a 401 carries the headers too, and the counter counts requests rather than
successful ones. It also counts requests and bytes per key, per calendar
month, and enforces the key's own `monthly_limit`. The two meters count
separately, and a client can be refused by either.

Metering only exists for `X-API-Key` traffic on the public router: the admin
router never populates the key claims the meter reads, so nothing the console
does moves the numbers, and a Bearer request is billed to no key. Per-key
counters are not at `/api/admin/api-keys/{id}/usage`, which answers 501 by
design, because reading them there would close a plugin dependency cycle and the
plugin declines rather than reporting a zero indistinguishable from an idle key.
The route that owns the data is `/api/admin/usage/api-key/{id}`.

**The meter and the trail disagree, and the reason is middleware order.** Usage
metering is wired ahead of the scope check, so a refusal is billed. The audit
middleware is wired after it, so a refusal is not recorded. And the quota status
route carries no audit middleware at all. `pnpm client` makes six requests to
the public router, prints the two counts it expects, and the key's page shows
both: six metered, four in the trail.

**A feed built for a phone.** `/feed` reads
`GET /api/v1/content/{type}/cursor`, which is not the offset list beside it.
It honors a page size from 1 to 1000 where the offset route clamps to 25, so a
page of four is possible for the first time. It answers with
`{data, next_cursor}` rather than a bare array. And it orders by row id, which
is a random UUID: not `created_at`, not `updated_at`. Compare the timestamps on
the page and they are out of order. That is exactly what a cursor needs and
exactly not what a newest-first feed needs, so a chronological feed either sorts
in the app or goes back to the offset route and its floor of 25. It also takes
no filters at all.

`next_cursor` is the last row's id, set only when the page came back full, so a
collection that divides exactly by the page size serves one final empty page.
Follow the cursor until it is empty. Do not treat a full page as proof of more.

## What the engine does not do here

- **No get-one-key route.** The key page filters the listing, which is capped at
  500 rows.
- **No media on the public router.** Media is admin-router only, so a phone
  cannot fetch an image with a content-scoped key. Serving it through your own
  route, as the other examples do, is the answer.
- **No counter reset, and no usage delete.** Deleting a key does delete both:
  usage and audit rows reference it with `ON DELETE CASCADE`, so the tenant's
  recorded call count for the period drops by whatever that key had spent.
  Revoke keeps the row, disables the key, and keeps the history.
- **No standard rate-limit headers.** Nothing emits `RateLimit-Limit` or
  `Retry-After` on either refusal.
- **The audit trail has no envelope** while its sibling listing does. This app
  accepts both shapes rather than assuming, because the route map disagreed with
  itself and the source settled it: a bare array.

## Routes used

| Method | Router | Path | Why |
|---|---|---|---|
| `POST` | admin | `/api/admin/api-keys` | mint, with scopes and no roles. `raw_key` returned once |
| `GET` | admin | `/api/admin/api-keys` | the listing, an envelope, newest first |
| `POST` | admin | `/api/admin/api-keys/{id}/revoke` | disable and keep the history |
| `DELETE` | admin | `/api/admin/api-keys/{id}` | remove the row, cascading the meters |
| `PATCH` | admin | `/api/admin/api-keys/{id}/monthly-limit` | the recovery path after a 429 |
| `GET` | admin | `/api/admin/api-keys/{id}/audit` | per-request trail, bare array |
| `GET` | admin | `/api/admin/usage/api-key/{id}` | per-key requests and bytes |
| `GET` | admin | `/api/admin/usage/tenant/{tenant}` | the tenant rollup |
| `GET` | admin | `/api/admin/quotas/{tenant}` | the quota definition |
| `GET` | public | `/api/v1/quotas/status` | live position, and the headers, not scope gated |
| `GET` | public | `/api/v1/content/{type}/cursor` | the feed |
| `GET` | public | `/api/v1/content/{type}` | the offset read, for the contrast |
| `GET` | public | `/api/v1/schemas` | what the key can see |
| `POST` | public | `/api/v1/content/{type}` | the write attempt, to show the 403 |
| `POST` | admin | `/api/admin/content` | seeding, via `createContent` |
| `POST` | admin | `/api/admin/schemas` | provisioning the three types |

## Content types

`mobile_lines`, then `mobile_stops` and `mobile_notices`, which both declare
`line` with `belongsTo()`. Order matters: a relation emits a foreign key against
the target's generated table. Every relation is optional, because a required one
generates a dead `line` column alongside the real `line_id` and the write path
fills only the second, so every insert fails.

Slugs all carry a `mobile-` prefix. A slug is unique per tenant across every
content type at once, not per type, and every example on this engine shares one
tenant.

## Layout

    src/lib/scopes.ts              the derivation rule, and the scope choices
    src/lib/server/keys.ts         mint, list, revoke, delete, limit, audit
    src/lib/server/metering.ts     quota, quota status with headers, usage
    src/lib/server/feed.ts         the cursor route, which the shared client omits
    src/routes/+page.server.ts     the key console and its actions
    src/routes/keys/[id]/          one key: meters, trail, and what it may call
    src/routes/metering/           both counters, side by side
    src/routes/feed/               the payload the phone gets
    client/mobile-client.ts        the phone
    client/spend-the-limit.ts      the phone, out of allowance
    setup/provision.ts             types, seed, and the two keys

Nothing outside `src/lib/server/` and the `.server.ts` files touches the engine
from the console, and `client/` never imports any of it. The console holds an
operator session. The client holds a key. Keeping those two credentials in
separate processes is the whole shape of the example.
