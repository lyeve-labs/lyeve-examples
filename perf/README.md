# Measuring the examples

Two layers, because a slow page has two possible causes and guessing between
them wastes a day.

| Layer | What it drives | What it answers |
|---|---|---|
| `app` | the example's own pages, over HTTP | what a visitor waits for, server-rendering and engine calls together |
| `engine` | the engine directly, for that app's primary content type | what the engine contributes to that wait |

Run both and the difference is the application's own cost. From the first run
recorded here, the blog's engine reads answered at 6.8ms p95 while its pages
took 80ms p95, so roughly 73ms was rendering rather than data. That is not a
verdict on either layer. It is the number you need before optimizing the wrong
one.

## Run it

```bash
make up            # the engine
make setup         # content, once
make build         # the apps, since this measures built output
make preview       # serve them
make bench ENGINE=blog   # the engine behind one app
make bench APP=blog      # that app's pages
make bench-all     # every app, both layers
```

Rate and duration are environment variables:

```bash
RATE=100 DURATION=60s perf/run.sh engine marketplace
```

`k6` is not installed and does not need to be. It runs as a container
(`grafana/k6`), which is why `run.sh` maps the host uid: the image runs as its
own unprivileged user and cannot otherwise write its summary into the
bind-mounted results directory, and a run whose summary never lands is
discarded rather than recorded.

## The one rule

A number reaches `results/` only if `run.sh` produced it from a run. There is no
path in the script that writes a figure any other way, and a run whose summary
k6 did not export records nothing at all.

Each result carries the host it ran on, including the engine commit, because a
figure without that is not reproducible. `results/RESULTS.md` is a log of every
run in order, not a leaderboard: rows are comparable with each other and with
nothing else. These run on a development machine, so they are not comparable
with the published head-to-head figures, which run on a dedicated host.

`run.sh` refuses to start against something that is not answering. A refused
connection would otherwise be recorded as a total failure and read as a product
fault.

## What the drivers do not do

`app.js` fetches HTML and runs no JavaScript. It measures time to a complete
document, not what the browser does with it. Nothing here measures hydration,
client-side navigation, or anything a real browser would.

Dynamic routes are driven by following real links found on the pages listed in
each app's `crawl` set. Inventing slugs would measure the 404 path, which is
fast and says nothing. If an app's pages yield no links the run fails loudly
rather than quietly driving the home page for the whole window.

`engine.js` drives one content type. An app whose cost is spread across several
types is only partly explained by it.

## apps.json is generated

```bash
node perf/discover-apps.mjs
```

It reads each app's dev port from its `package.json`, its page routes from
`src/routes`, and its content types from `setup/provision.ts`. Written by hand
it went stale as soon as an app was added, so it is derived. Regenerate it after
adding an app or changing its routes.

A measured run targets the built output on the port `make preview` chose, not the
dev port in `apps.json`. `run.sh` reads `.stack/preview.pids` and prefers what is
actually serving, so the commands above work in the order given.

## Request shapes

Every engine request here is one the engine actually has. This matters more than
it sounds: the engine ignores a parameter it does not know. A request for
`filter=column:value` answers 200 and returns an unfiltered list, so a figure
labeled as a filtered query would be measuring a plain list. The shapes below
were each verified by execution.

| Shape | Note |
|---|---|
| `filters[column]=value` | exact equality, and the only filter form there is |
| `filters[<rel>_id]=<uuid>` | a relation is filtered by its foreign key. The bare field name is a 400 |
| `populate=*`, `depth=N` | inflate relations |
| `limit` | clamped to 25..200, so a smaller page cannot be asked for |
| no `sort` | rows are always newest-first. Any other order is the application's job |
| `GET /api/admin/search` | search is on the admin router. There is no public search route |
| `GET /readyz` | the only probe that answers without a token |

There is no way to filter by a related record's own field, because the engine
does not join. Listing posts in the category whose slug is known takes two
requests.
