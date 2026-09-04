# Analytics dashboard

An operations console that reads the engine's own telemetry instead of content.
The other examples in this repository are things you build **with** LyEve. This
one is a view **of** LyEve.

## Read this before you trust a number

Three plugins and the engine itself expose telemetry, and they fill their
tables four different ways. Two panels sitting side by side can both read zero for opposite
reasons, and an operator has to respond differently to each. So every panel
here states which of the two it is looking at, names the route it read, and says
in one sentence why the figure is what it is.

That honesty is the deliverable. A dashboard that renders "not collecting" as
zero is worse than no dashboard, because it converts a missing instrument into a
confident measurement.

The five states a panel can be in:

| Badge | Meaning |
|---|---|
| **Collecting** | The engine records this on its own and rows came back. Trust it. |
| **Collecting, window empty** | The engine records this on its own and nothing happened. A real reading of zero. |
| **Not collecting: no trigger** | The table is only written by an explicit POST or an external scheduler. The zero is not a measurement. |
| **Not collecting: nothing reports** | A counter written only when a particular kind of client calls. The zero means nobody reported, not that nothing happened. |
| **Never populated** | No code path in this build assigns the value. It will read zero forever. |

## Which panels are real

**Real, with no configuration whatsoever.** The **apianalytics** plugin installs
HTTP middleware, so every request through either router is recorded, buffered in
memory and flushed to `api_metrics_hourly` on an interval. Nothing opts in, no
client reports, and an empty response genuinely means no traffic. This is the
whole `/requests` page: request counts, error rates, latency percentiles, and
breakdowns by endpoint, method, tenant and user-agent family. It is the only
telemetry source in this list that needs nothing switched on.

**Real, and live at the instant you read it.** `/healthz`, `/readyz` and
`/startup` run their checks per call. `/api/admin/pool/health` reads the
driver's pool statistics. `/api/admin/debug/latency` reports an in-process ring
buffer. `/api/admin/metrics` is a Prometheus exposition. Also real: the
**usage** plugin's `content_count`, `media_count` and `storage_bytes`, which are
a COUNT and a SUM run against the live tables when you ask.

**Real, and the closest thing to a content activity feed the engine keeps.** The
**analytics** plugin subscribes to the create, update and delete hooks for every
schema, so a row lands in `sys_analytics_events` whenever anything writes
content.

## Which panels are empty, and why

These are worth reading as a list, because none of them is a bug in this app.

**`/api/admin/analytics/daily` and `/summary` return zeros because nothing
aggregates.** `sys_tenant_analytics_daily` is written only by
`POST /api/admin/analytics/aggregate` (one tenant, one day) or
`/aggregate-all`. The plugin's own package comment says aggregation is
"scheduled via the cron plugin". The plugin schedules nothing itself and no cron
job ships pointed at it. A deployment fills this by scheduling a daily POST.
Note that the same figures are already available live and exact from the usage
plugin, so the aggregation buys history rather than accuracy.

**`/api/admin/analytics/dashboard` returns four fields and populates one.** The
store scans a single column into `api_calls_24h`. `total_content`, `total_media`
and `total_users` are never assigned by any code path and serialize as zero.
Worse, the one field that is populated sums `dau` from the daily table above, so
it is zero for the other reason too. Nothing a deployment can switch on changes
the three dead fields. This dashboard does not render them.

**`usage.api_calls` and `bandwidth_bytes` are zero on a bearer-token install.**
The usage middleware reads the request's auth claims and returns immediately
unless the caller authenticated with an **API key**. A bearer token, which is
how every example in this repository talks to the engine and how most
server-side integrations do, passes through unmetered. So `api_calls` is not a
count of API calls. It is a count of API-key API calls. The `/quota` page puts
the apianalytics figure for the same tenant in the next column, so the gap is
visible instead of assumed. Filling the column needs clients holding API keys,
which is a client-side change rather than a setting.

**`/api/admin/usage/snapshots/{tenant}` is an empty array** because a snapshot
row exists only where something has posted to `/api/admin/usage/snapshot`, and
nothing schedules that.

**`requests_limit: 0` does not mean exhausted, it means unlimited.** The usage
plugin seeds that row at boot for the default tenant, and every warning flag
beside it is false because there is nothing to compare against. Read as a digit
it says the opposite of what it means, which is why the `/quota` page renders
the word. `PUT /api/admin/quotas/{tenant}` turns the panel into a measurement.

**`/api/admin/analytics/providers` answers a bare `null`,** not an empty array,
when no external destination is configured. A caller treating the body as a list
throws.

**Every hook event has `processed: false`, permanently.** The hook builds its
event with `provider_types` set to nil under a comment reading "all enabled
providers", and the dispatcher iterates that list, so nil dispatches to nothing.
Configuring an external destination does not change it. This is the one entry in
this list that reads as a genuine defect rather than a design choice.

**`/api/v1/ready` reports `schema_count: 0` on an install with dozens of schemas.** The
handler takes a schema cache accessor and the admin router passes nothing for
it. `status` and `db` on the same response are genuine.

**Anomalies and quota increase requests render a count and nothing else.**
Neither has ever come back populated from this engine, so the shape of an entry
is unverified. Laying out fields for a response never observed would be
inventing one.

## The probe naming trap

Point a load balancer at **`/readyz`**, never at `/api/v1/health`.

| Route | Auth | Checks |
|---|---|---|
| `/healthz` | none | database only, on purpose |
| `/readyz` | none | database, disk, goroutines, pool utilization, plugins |
| `/startup` | none | runs once, then caches the pass forever |
| `/api/v1/health` | **bearer token** | database ping |
| `/api/v1/ready` | **bearer token** | database ping, plus a schema count that is always zero |

`/api/v1/health` sounds like the probe and is not one: it sits behind the auth
middleware and answers 401 without a token, so a health check configured against
it marks a healthy instance down. `/healthz` deliberately checks less than
`/readyz`, because a saturation problem must not restart the container. And all
three public probes bypass the readiness gate that refuses ordinary traffic
during startup, so a 200 from one of them is not a promise that the rest of the
engine will answer yet.

## Two request counts that disagree, and both are right

The `/requests` page says this instance has served tens of thousands of
requests. The `/health` page's Prometheus panel says a few hundred. The
difference is the last restart: the Prometheus counters and the latency tracker
live in the process, and the apianalytics rollups are rows in a table. Neither is
wrong and the gap is not a fault. A console that showed only one of them would
be quietly misleading in a different way each time.

## Charts

Every chart is inline SVG whose coordinates come from `src/lib/charts.ts`. No
chart library is loaded, and none can be: the CSP in `svelte.config.js` allows
scripts from `self` only, so a CDN `<script>` is blocked with no visible error.
Hover and focus are Svelte 5 runes compiled into the app bundle, which is served
from `self` and therefore allowed.

The rules the charts follow, which are the ones easiest to get wrong:

- **One axis, always.** Requests per hour and error rate per hour come from the
  same route and are drawn as two plots. A count in the thousands and a fraction
  under one on one pair of axes would invent a correlation.
- **A missing hour is drawn as a gap, not a zero.** The trend route omits an
  hour that saw no traffic rather than returning a row of zeroes, so plotting
  its rows side by side draws straight through a dead hour. `padHours` fills the
  gaps and the chart marks them with a dashed floor rule.
- **Single series, so no legend box** and one direct label on the peak. A number
  on every column is noise nobody reads. The axis and the tooltip carry the rest.
- **Every chart has a table twin** behind a `Table view` disclosure, so no value
  is reachable only by hovering.
- **State never rests on color.** Every badge and severity carries a glyph and
  a word.

## What this app does not do

- **It does not write telemetry.** Nothing here posts to `/analytics/aggregate`,
  `/usage/snapshot` or `/analytics/events`. Those routes
  exist and would fill several of the empty panels. A console that fired them on
  page load would be manufacturing the data it then reported.
- **It does not poll.** Every page is a server load per request. There is no
  websocket, no interval and no client-side refetch, so a figure is as fresh as
  the last reload and no fresher.
- **It shows one instance.** Tenant breakdowns are per tenant within this
  engine, not across engines.
- **It does not alert.** Alerting is a deployment concern, and not something a
  read-only console should own.
- **It has no `benchmark.json`.** An operator console is not engine-driven load.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/analytics-dashboard && pnpm run setup && pnpm dev

Then open http://localhost:5195.

`pnpm run setup` creates `metrics_notes` and seeds four notes. Everything else on
the dashboard is already there.

## Layout

    src/lib/provenance.ts             the five source states and how each is shown
    src/lib/charts.ts                 pure SVG geometry, no engine calls
    src/lib/server/telemetry.ts       every telemetry route, wrapped with its provenance
    src/lib/server/notes.ts           the one content type this app owns
    src/lib/components/Panel.svelte   the provenance wrapper every figure sits inside
    src/routes/                       overview, requests, health, quota, notes
    setup/provision.ts                metrics_notes and its seed

`src/lib/server/telemetry.ts` is the file worth reading. Every response shape in
it was captured from a live engine on 2026-09-04, and nothing is declared that
was not observed coming back, because a field the engine never sends renders as
a confident zero.
