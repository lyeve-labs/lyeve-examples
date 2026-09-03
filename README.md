# LyEve examples

Runnable applications built on LyEve. Every one boots against a real engine,
provisions its own content types, seeds its own data, and serves pages you can
open.

Nothing here is a sketch. The engine is built from source, the recipe every app
follows was verified by executing it, and the traps that recipe warns about were
each reproduced before they were written down.

## Start here

    make up          # build and boot the engine, create the first admin
    make install     # install dependencies for every example at once
    make setup       # provision and seed every example, then list any that failed
    make dev-blog    # run one app
    make preview     # serve every built app, one port each

Measuring is a choice rather than a sweep:

    make bench-list             # every target, and what each one measures
    make bench APP=blog         # the pages a visitor waits for
    make bench ENGINE=blog      # the engine behind those pages
    make bench PROFILE=courses  # a full benchmark workload, seeded and driven

`make up` takes a few minutes the first time because it compiles the engine and
its 51 plugins. After that it is a cache hit.

Requirements: Docker, Go 1.27, Node 26, pnpm 11 (the versions `mise.toml` pins),
and a checkout of `lyeve-core` beside this repo (or set `LYEVE_CORE_SRC`). The
paid examples also need a development license: set `LYEVE_LICENSE_KEY` and
`LICENSE_PUBLIC_KEY_HEX` to a license and its public key. `LICENSE_FEATURES` in
`platform/scripts/lib.sh` lists the features it should carry.
`make up` checks for Docker, Go and curl, for the engine checkout and for the
license, and says which is missing.

## The examples

| Example | What it proves |
|---|---|
| [blog](apps/blog/) | Relations, `populate`, full-text search, media. The reference implementation. |
| [docs-portal](apps/docs-portal/) | Hierarchical content and a page tree the app builds itself. |
| [company-site](apps/company-site/) | A contact form on the schema plugin's forms preset, and a generated sitemap. |
| [marketplace](apps/marketplace/) | Multi-relation catalog, filtering, and what the engine cannot filter. |
| [booking](apps/booking/) | Scheduling modeled entirely in the application, and why it is not race-free. |
| [subscription-gating](apps/subscription-gating/) | Gating content on entitlements and receiving provider webhooks. |
| [saas-multitenant](apps/saas-multitenant/) | Tenant provisioning, scoped API keys, usage metering. |
| [helpdesk](apps/helpdesk/) | Ticket status workflow and threaded replies. |
| [events-ticketing](apps/events-ticketing/) | Capacity as application state. |
| [lms-courses](apps/lms-courses/) | Three levels of nesting and walking relations upward. |
| [jobs-board](apps/jobs-board/) | Public submissions with a file upload. |
| [community-forum](apps/community-forum/) | Threaded discussion and a moderation queue on the schema plugin's comments preset. |
| [multi-language-site](apps/multi-language-site/) | Per-entry translations, locale fallback and translation status. |
| [realtime-feed](apps/realtime-feed/) | A live status board pushed over the events stream, with no credential in the browser. |
| [webhook-integrations](apps/webhook-integrations/) | Deliveries out with the signature verified, and signed requests in. |
| [privacy-compliance](apps/privacy-compliance/) | Data-subject export and erasure, masking rules, an audit trail. |
| [mobile-api-backend](apps/mobile-api-backend/) | Scoped API keys, quota and metering, with a non-browser client. |
| [newsroom](apps/newsroom/) | Drafts, publishing, revisions with restore, and a staged approval on the review plugin. |
| [cms-migration](apps/cms-migration/) | Migrating in from a CSV export using the real command-line tool. |
| [search-console](apps/search-console/) | The rest of the search plugin: synonyms, ranking, instant search, reindexing and caller-reported analytics. |
| [headless-node](apps/headless-node/) | The published SDKs used directly, with no framework. |
| [custom-plugin](apps/custom-plugin/) | Extending the engine itself, in Go. |
| [graphql-storefront](apps/graphql-storefront/) | The GraphQL transport end to end, and where it is thinner than REST. |
| [media-library](apps/media-library/) | The media pipeline itself: uploads, folders, variants and storage keys. |
| [analytics-dashboard](apps/analytics-dashboard/) | A console over the engine's own telemetry, each panel naming its route. |

## Every example is its own package

An example you cannot take away is not much of an example. Each app depends on
nothing in this repository:

    cp -r apps/blog ~/somewhere      # or download just that directory
    cd ~/somewhere/blog
    cp .env.example .env             # point it at your engine
    pnpm install                     # published packages, nothing else
    pnpm run setup && pnpm dev

Its only LyEve dependencies are the product's own published packages: the SDK,
`@lyeve-labs/client` and `@lyeve-labs/client-rest`, and in every app with pages,
`@lyeve-labs/ui-kit`. That is deliberate: an
example should use the packages a customer would use. The engine behavior the
SDK does not encode lives in a small module vendored into each app under
`src/lib/lyeve/`, built on top of the SDK rather than replacing it, so
`client.api` and `client.admin` are ordinary SDK clients and any client-rest
function works with them.

The copy under `packages/lyeve` is the one to edit. `make vendor` pushes it out
to every app, and `make check-vendor` fails when one has drifted. That is the
price of apps that stand alone, paid somewhere it can be checked.

One thing the SDK will not do for you: its `createContent` posts to the public
content route, and content written there is invisible to search for good. Every
example writes through the admin route instead.

## How every app is shaped

**They are all backends-for-frontends, and they have to be.** The engine has no
anonymous read: apart from the token endpoint and the health probes, every route
requires authentication. A browser cannot talk to it. So the SvelteKit server
holds the credential, and the browser only ever talks to SvelteKit.

That is not a workaround. It is the deployment shape this product implies, and
building the examples any other way would teach the wrong lesson.

    browser  ->  SvelteKit server  ->  LyEve engine
                 (holds the token)     (never public)

Shared code lives in [packages/lyeve](packages/lyeve/): one small client that
encodes the engine's behavior so the apps do not each rediscover it.

## Read this before writing your own

[docs/VERIFIED-RECIPE.md](docs/VERIFIED-RECIPE.md) is the important document. It
records what the engine actually does, as opposed to what its documentation
says, including several behaviors that will silently cost you an afternoon:

- Content written to the public API is invisible to search, permanently and
  without an error.
- A relation declared `required: true` makes every insert fail.
- `?limit=3` returns 25 rows.
- There is no sort parameter.
- An `<img>` pointed at the engine gets a 401.

[docs/APP-TEMPLATE.md](docs/APP-TEMPLATE.md) is the checklist for adding one.

## Layout

    apps/           one directory per example
    packages/lyeve  the shared server-side client
    platform/       scripts that boot, seed, serve and check the local stack
    perf/           measure any example at the page and the engine
    docs/           the verified recipe and the template guide
    .stack/         local engine binary, logs and license (never committed)

## Honesty

Some of these examples model domains the product has no primitives for. There is
no booking, ticketing, ordering or inventory concept in LyEve, and there is no
payment integration: the engine verifies a provider's webhook signature and
records what it is told, and nothing in it charges a card.

Where an example models such a domain, its README says so at the top and points
at exactly which guarantees are the application's problem. An example that
implied otherwise would be worse than no example.
