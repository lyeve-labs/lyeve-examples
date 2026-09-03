# subscription-gating

A subscription-gated publication. Free articles are open to everyone, paid
articles are served only to a reader whose subscription is active, and the
subscription state arrives from the payment provider over a signed webhook.

**Checkout happens at the payment provider. The engine only verifies and
records what the provider tells it.** Nothing in this example, and nothing in
the shipped engine, charges a card, creates a customer, opens a checkout
session or issues a refund. The example is a subscription-state receiver, and
the section below says exactly how far the product goes.

## What the product actually ships for payments

- Nothing. The engine has no payment-provider route, no plan API, no invoice
  API, no checkout, no charge, no refund and no customer creation.
- This example verifies the provider's webhook signature itself and records
  what it is told. That is the whole payment footprint here.

A reader subscribing to your publication is application data, not engine
state. So this app receives the provider's event on its own route and records
the result in its own content type.

## What this example proves

- Gating decided entirely on the server. The full text of a paid article never
  reaches a browser that has not earned it. The article page truncates in
  `src/lib/server/articles.ts` and returns only the preview, because a paywall
  that ships the whole body and hides the rest with CSS is defeated by
  view-source.
- Two conditions, not one. Access needs `tier === 'member'` **and**
  `status === 'active'`. A subscriber whose payment failed keeps the tier they
  bought until the provider says otherwise, so tier alone would keep serving
  paid articles through a failed billing cycle.
- Inbound webhook handling that a real provider would be happy with: HMAC over
  the exact bytes, a timestamp inside the signed material so a captured request
  is not replayable forever, constant-time comparison, and status codes chosen
  for a retrying sender rather than for a browser.
- Reading the engine's own license state from `GET /api/admin/entitlements` and
  rendering it, so the example shows how a deployment finds out what it is
  entitled to.

## Engine features exercised

| Feature | Where |
|---|---|
| Schema apply, two content types | `setup/provision.ts` |
| Content writes through the admin router | `createContent` in `setup/provision.ts` |
| Content updates through `PUT /api/admin/content/{id}` | `setSubscription` in `src/lib/server/members.ts` |
| Public reads with `filters[]` exact equality | `findReaderByEmail`, `listArticles` |
| Single-entry read by id | `findReaderById` |
| License entitlements | `src/lib/server/entitlements.ts`, rendered on `/account` |
| Media proxy, present but unexercised by the seed | `src/routes/media/[id]/+server.ts` |

## What is honestly NOT supported

Everything here is a property of the product, not of this example.

- **No card processing of any kind.** See the section above. If you need
  checkout, you integrate the provider yourself and point its webhook here.
- **No enum field type.** `tier` is a `text` column, and `free` / `member` is a
  convention the application enforces. The engine will happily store `mmeber`.
- **No `sort` parameter on any read.** Rows come back `created_at DESC` and
  nothing else. `listArticles` sorts in the app.
- **`limit` is clamped to 25..200.** Asking for 8 returns 25. The shared client
  slices for you.
- **Filters are exact equality with no case folding.** No operators, no ranges,
  no LIKE. Every email is lower-cased on write and on lookup for that reason
  alone. Skip it and a provider that capitalizes the local part matches
  nothing.
- **No anonymous read.** Every content route sits behind auth, so the browser
  never talks to the engine. This app is a backend-for-frontend and the
  credential stays in `src/lib/server/`.
- **`PUT /api/admin/content/{id}` replaces the body, it does not merge it.**
  `setSubscription` reads the entry first and writes it back whole. Sending
  only the changed keys drops the rest and returns 422 for whichever of them
  the schema marks required.
- **A slug is unique per tenant, not per content type.** The unique index is
  on `(slug, tenant_id)` and does not mention the schema, so reusing a slug
  another content type already took returns `409 conflict` with the same
  `failed to create content` message a real conflict gets. It matters here
  because every example in this repo shares one engine, which is why the member
  slugs carry an app prefix.
- **No webhook idempotency or ordering.** This app applies the last event it
  receives. A provider that redelivers out of order can move a reader back to a
  state they have already left.
- **`GET /api/admin/entitlements` is admin-only** and deliberately exposes no
  license id, instance id or expiry. It works here only because the
  server-side credential is an admin one. On a real site that panel belongs
  behind a staff check rather than on a page any reader can reach.
- **The sign-in form is not authentication.** It takes an email and trusts it.
  There is no password, no verification and no sign-up. The cookie is signed so
  a visitor cannot edit it to name a different reader, which is the only
  property the gating logic depends on. Real sign-in belongs to an identity
  provider or to the engine's own auth plugins.
- **No images are seeded.** `/media/[id]` ships anyway, because the engine's
  own download route requires a bearer token and 401s a browser, so any app
  that serves an uploaded image has to proxy it.

## Running it

From the repository root:

    make up                             # postgres, the engine, the first admin
    make install
    make setup                          # content types and seed data, every example
    cp apps/subscription-gating/.env.example apps/subscription-gating/.env
    make dev-subscription-gating        # http://localhost:5178

`make setup` is safe to run again. Applying an existing schema is accepted, and
each content type is checked separately before it is seeded.

To provision this example on its own, export the engine credentials first.
`provision.ts` reads `process.env` directly, and Node does not load a `.env`
file for it the way Vite does for `pnpm dev`:

    set -a; . ./.env; set +a
    cd apps/subscription-gating && pnpm run setup

The app's own `.env` needs two values beyond the shared four, both listed in
`.env.example` with development defaults: `SUBSCRIPTION_COOKIE_SECRET` signs
the reader cookie, and `SUBSCRIPTION_WEBHOOK_SECRET` verifies the inbound
webhook. A real deployment takes the second from the payment provider's
dashboard.

Three readers are seeded, each in a different state, and `/account` lists them
because the demo has no sign-up:

| Email | Tier | Status | Sees paid articles |
|---|---|---|---|
| `priya.raghunathan@northwind-freight.example` | member | active | yes |
| `t.halloran@brightline.example` | member | past_due | no |
| `ines.ferreira@quarryhill.example` | free | canceled | no |

Sign in as Priya to read everything, then as Tomas to see the same page refuse
with a billing notice rather than an upsell.

## Driving the webhook

`POST /api/webhooks/subscription` expects an `X-Subscription-Signature` header
of the form `t=<unix seconds>,v1=<hex>`, where the digest is HMAC-SHA256 over
`<timestamp>.<raw body>` keyed with `SUBSCRIPTION_WEBHOOK_SECRET`. That is the
scheme the provider uses.

Settle Tomas and watch the paid articles unlock:

    SECRET=subscription-gating-dev-webhook-secret
    BODY='{"type":"customer.subscription.updated","data":{"object":{"customer_email":"t.halloran@brightline.example","status":"active","metadata":{"tier":"member"}}}}'
    TS=$(date +%s)
    SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -r | cut -d' ' -f1)

    curl -X POST http://localhost:5178/api/webhooks/subscription \
      -H 'Content-Type: application/json' \
      -H "X-Subscription-Signature: t=$TS,v1=$SIG" \
      -d "$BODY"

Send it as `application/json`. SvelteKit rejects a cross-origin POST carrying a
form content type before the handler runs, and a webhook is cross-origin by
definition.

Change `"status"` to `"past_due"` to put him back, or send
`"type":"customer.subscription.deleted"` to drop him to the free tier. Tamper
with a byte of the body and the request is refused with `signature mismatch`.
Set `TS` to an hour ago and it is refused as `signature stale`.

## Layout

    setup/provision.ts                        content types and seed data
    src/hooks.server.ts                       verifies the reader cookie once per request
    src/lib/server/lyeve.ts                   the client, and this app's schema names
    src/lib/server/tiers.ts                   the tier vocabulary and the access decision
    src/lib/server/articles.ts                article reads and server-side truncation
    src/lib/server/members.ts                 member reads, and the subscription write
    src/lib/server/entitlements.ts            GET /api/admin/entitlements
    src/lib/server/digest.ts                  HMAC and constant-time digest comparison
    src/lib/server/session.ts                 the signed reader cookie
    src/lib/server/signature.ts               inbound webhook signature verification
    src/routes/+page.svelte                   the article list
    src/routes/articles/[slug]/               the gated article page
    src/routes/account/                       sign in, sign out, tier, license panel
    src/routes/api/webhooks/subscription/     the provider receiver
    src/routes/media/[id]/                    the media proxy
