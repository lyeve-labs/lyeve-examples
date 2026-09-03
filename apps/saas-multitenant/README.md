# saas-multitenant

A control panel for a SaaS that resells the engine. It provisions tenants, mints
API keys scoped to one of them, and reads back the quota and usage figures the
engine actually keeps.

Three pages:

| Page | What it does |
|------|--------------|
| `/` | The tenant roster, joined to the customer profile and the quota, with a form that provisions a new tenant |
| `/tenants/<slug>` | One tenant: its keys, a mint form, a revoke action, and a one-shot request that spends the key |
| `/usage` | Live usage per tenant for a billing period, and the action that freezes it into a snapshot |

## What this example proves

**A tenant is three rows in three plugins with nothing joining them but a slug.**
The engine's `sys_tenants` holds a slug, a name, a plan string and an enabled
flag. The keys are the API key plugin's, the limits and the
counters are the usage plugin's, and the billing contact is not the engine's
problem at all. The create form writes all three and the pages stitch them back
together on the slug, because no endpoint returns them together.

**Which tenant a request acts as is decided by a header, not by the URL.**
`sys_api_keys` and `sys_quotas` are shared tables isolated by a `tenant_id`
column, and the column is filled from the tenant the request resolved to. A
super_admin resolves to the implicit `default` tenant, so minting a key for
Northwind means sending `X-Tenant-ID: saas_northwind` on the create. Without it
the key is stamped `default` and never appears on Northwind's page. See
`src/lib/server/platform.ts`.

**A key needs scopes, not only roles.** `RequireScoped` derives a
`resource:action` pair from the request path and refuses any key whose scope
list does not grant it. An empty scope list grants nothing. A key minted with
roles and no scopes authenticates cleanly and is then refused on every route it
was issued for, with a 403 that never mentions scopes. The mint form makes the
scopes the visible choice for that reason, and the "spend one request" box on
the tenant page shows the difference: a key with `schemas:read` gets 200, the
same key without it gets 403.

**Metering only sees API-key traffic on the public router.** The counter is
incremented by middleware that keys off `claims.APIKeyID`, and the admin router
never populates those claims. Nothing this console does with its own session is
billed to anyone, which is why the usage figures start at zero and only move
when a real key is used.

## Engine surface it exercises

| Route | Used for |
|-------|----------|
| `POST /api/admin/tenants` | Provision a tenant. super_admin only, license-gated. |
| `GET /api/admin/tenants` | The roster. There is no lookup by slug, so the app pages the list. |
| `GET`, `POST /api/admin/api-keys` | List and mint, scoped by `X-Tenant-ID`. |
| `POST /api/admin/api-keys/{id}/revoke` | Disable a key and keep the row. |
| `GET`, `PUT /api/admin/quotas/{tenant}` | Read and upsert a tenant's limits. |
| `GET /api/admin/usage/tenant/{tenant}` | Live figures for one tenant. |
| `GET /api/admin/usage/tenants` | The cross-tenant rollup. super_admin only. |
| `POST /api/admin/usage/snapshot` | Freeze a period into `sys_tenant_usage_snapshots`. |
| `POST /api/admin/schemas` | The plan and profile content types. |
| `POST /api/admin/content` | Plans and tenant profiles, written the only way that keeps them visible to search and to the admin UI. |
| `GET /api/v1/content/{schema}` | Reading them back, with `populate` inflating the plan relation. |
| `GET /api/v1/schemas` with `X-API-Key` | The one call made as a customer rather than as the operator. |
| `GET /api/admin/media/{id}/download` | Proxied by `/media/[id]`, because the engine's download route 401s a browser. |

## Multi-tenancy on this stack

**The shared example stack runs with `MULTI_TENANT=false`, and this example does
not turn it on.** Every other example in this repo writes into the one default
tenant and assumes it, so no example enables the flag.

What that costs, stated plainly: **this example demonstrates the tenant admin
API surface, not request-level isolation.** It proves that tenants can be
created, that keys can be minted against a named tenant, that quotas can be set
per tenant and that usage is aggregated per tenant. It does not prove that a
tenant's request cannot reach another tenant's data, because the middleware that
would enforce that at the connection level is not mounted.

The part that matters even when the flag is on:

> Isolation on `sys_*` tables is enforced by a `tenant_id` column, not by the
> per-tenant schema. `PluginMigrate` runs on the master pool, so every `sys_*`
> table lives in the default schema and is never replicated into a tenant's
> schema. `SET search_path` and `USE <database>` therefore protect none of it.
> **A query that forgets `AND tenant_id = $N` reads across tenants**, and it does
> so silently, on a correct-looking connection, with the isolation middleware
> running.

That applies to `sys_api_keys`, `sys_quotas`, `sys_api_usage`, `sys_media` and
`sys_content_entries` alike. Generated content tables carry a `tenant_id` column
for the same reason. If you take one thing from this example into your own code,
take that: the column is the boundary.

Two consequences visible in the app:

- The `X-Tenant-ID` override is honored even with `MULTI_TENANT=false`, but
  only for a super_admin, and only for a slug that exists in `sys_tenants`. An
  unknown slug is a 404 from the middleware, before any handler runs.
- A key minted for `saas_northwind` reading `/api/v1/content/saas_plans` gets an
  empty array, not the three plans the console sees. Same table, same schema,
  different value in one column.

## What the product does not do

Everything here was checked against the engine, not inferred from documentation.

- **No tenant self-service.** Every tenant CRUD route is super_admin only, and
  there is no route a customer can call to list or rotate its own keys. The
  tenant-facing routes in this area are `GET /api/v1/quotas/status` and
  `POST /api/v1/quota-requests`, and that is all of them. A real product needs
  its own customer surface in front of these admin routes.
- **No lookup by slug.** `GET /api/admin/tenants/{id}` takes a UUID, while every
  tenant-scoped table keys off the slug. The app routes by slug and pages the
  roster to resolve it.
- **No sort parameter, anywhere.** Rows come back `created_at DESC`. The
  alphabetical roster and the largest-bill-first usage table are both sorted in
  the app.
- **`GET /api/admin/api-keys/{id}/usage` answers 501.** Per-key metering is not
  available from the key plugin. The usage plugin owns that table and answers at
  `GET /api/admin/usage/api-key/{id}` instead. This example reads tenant-level
  usage and does not show a per-key breakdown.
- **A tenant with no API key has no usage record.** The usage plugin decides
  whether a tenant exists by asking whether it holds a key, so a keyless tenant
  answers 404 rather than a row of zeros. The tenant page says so rather than
  rendering an empty state that looks like real data.
- **Admin and Bearer traffic is never metered.** Only `X-API-Key` requests on
  the public router increment the counter, so operator activity is invisible to
  billing and a customer using a session token instead of a key is billed
  nothing.
- **The raw key exists for one response.** Reads return the hash. There is no
  reveal, no rotate-in-place, and no recovery. Losing it means minting another.
- **There is no scope catalog.** Scopes are `resource:action` pairs derived
  from request paths, and nothing enumerates the valid ones. The four this app
  offers are hand-written in `src/routes/tenants/[slug]/+page.server.ts`.
- **No billing.** No invoices, no proration, no payment, no currency handling.
  The plans here are ordinary content that the app itself interprets. The engine
  knows only the plan string on the tenant row.
- **No transaction across plugins.** Provisioning writes to three plugins and can
  stop half way. Every step in the create form is written to be safe to repeat
  for that reason, and a failed submission is meant to be sent again.
- **Tenant deletion is deliberately not wired here.** `DELETE
  /api/admin/tenants/{id}` exists, but the engine refuses to reissue a slug whose
  orphaned rows survive the purge, so a demo delete button would eventually make
  a slug unusable without explaining why.
- **Content the console writes belongs to the console.** Profiles and plans are
  written under the operator's own tenant, so a customer's `content_count` stays
  at zero until that customer writes content with its own credentials. That is
  correct, and it is also why the numbers on `/usage` are small.

## Running it

From the repo root, once:

```bash
make up       # postgres, the engine, and the first admin account
make install
make setup    # provisions every example, this one included
```

Then:

```bash
make dev-saas-multitenant     # http://localhost:5179
```

To seed only this example:

```bash
set -a; . ./.env; set +a
cd apps/saas-multitenant && pnpm run setup
```

The seed creates three tenants (`saas_northwind`, `saas_calder_labs`,
`saas_meridian_freight`), three plans, a profile and a quota for each tenant, and
one API key per tenant so the usage plugin recognizes them. It is safe to run
again: applying an existing schema is accepted, a taken slug is reused, and no
step writes twice.

Every tenant and content type this example creates is prefixed, because one
engine serves every example in the repo.

## Files

```
src/lib/schemas.ts              the names this example claims on the shared engine
src/lib/format.ts               number, byte and billing-period formatting
src/lib/server/lyeve.ts         the client, holding the credential the browser never sees
src/lib/server/platform.ts      tenants, API keys, quotas and usage
src/lib/server/profiles.ts      the customer record, stored as content
src/routes/+page.server.ts      the roster and the provisioning action
src/routes/tenants/[slug]/      one tenant: keys, mint, revoke, probe
src/routes/usage/               the billing period view and the snapshot action
src/routes/media/[id]/          the media proxy, because the engine's download route needs a token
setup/provision.ts              schemas, plans, tenants, profiles, quotas, keys
```
