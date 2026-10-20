# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Measured every example at the page and the engine on v0.55.0. The community
  forum and helpdesk pages were measured twice.

## [0.3.0] - 2026-10-20

### Added

- Benchmark manifests for booking, helpdesk, subscription-gating and
  analytics-dashboard, so the benchmark profiles cover 17 examples.

### Changed

- Every app declares `@lyeve-labs/ui-kit` ^0.38.4 instead of ^0.32.1, which a
  caret range on 0.x never left. `make check-kit`, part of `pnpm check` and
  `make verify`, fails when two apps declare different kit ranges. The
  workspace file no longer exempts old kit versions from the release-age
  policy, since nothing resolves them.
- A benchmark traffic entry that depends on a plugin says whether that plugin
  needs a paid license (`paid: true` or `false`), and `perf/export-profiles.mjs`
  refuses an entry that does not. The forum's thread read names the schema
  plugin, which owns the comments preset. The profile format moves to 0.5.0.
- The README and `platform/scripts/lib.sh` describe the development license
  without listing its features. Nothing read the list, and it had fallen
  behind the engine.

### Fixed

- headless-node signs in again when the engine refuses its cached token. After
  `make fresh` it reused a token for an account that no longer existed, so
  `make setup` failed with 401 "session invalidated".
- The community-forum benchmark manifest names the comments preset and seeds
  replies under the topics, and `perf/export-profiles.mjs` carries both into the
  profile. The exported forum profile left the preset's type out, so every
  thread read of the benchmark answered 404.

## [0.2.0] - 2026-10-11

### Added

- A picture of every page of every example, on a desktop and on a phone, in
  `apps/<example>/screenshots/`. Each README shows its own, and
  `docs/PREVIEWS.md` gathers them with guidance on using them.
  `make screenshots` takes them again from the running apps.

### Changed

- Every example is measured again at the page and at the engine on the
  v0.54.1 release, and `perf/results/RESULTS.md` records the run. Every
  threshold is met.
- `make up` takes the development license from `LYEVE_LICENSE_KEY` and
  `LICENSE_PUBLIC_KEY_HEX` in the environment and stops with a clear message
  when either is missing. It reads the license key variable from the engine's
  build graph instead of naming its package, and refuses to continue when the
  engine logs that no license verifies.
- `LICENSE_FEATURES` in `platform/scripts/lib.sh` lists the paid names the
  engine gates today, including `rate-limit-pro`, which raises the sign-in
  limit for local seeding.
- The helpdesk, privacy-compliance, mobile-api-backend, community-forum and
  company-site documentation describes the engine's current plugins: the
  support assistant in the AI plugin, the schema plugin's comments preset, the
  five export sources, and both meters in the usage plugin.

### Fixed

- cms-migration imports again after `make fresh`. Its checkpoints outlived the
  database, so a resumed stage skipped every row of the new, empty one and
  only the byline step failed. A checkpoint is now set aside when the engine
  holds none of the migrated entries it lists.
- `make preview-stop` stops the preview servers. It used to stop only the
  shells that launched them, so every server kept running and kept its port,
  and `make preview` piped into another command never finished.
- cms-migration imported its pages as `about`, `corrections` and `contact`.
  Every example shares one tenant and a slug is unique per tenant across every
  content type, so on the 0.54.1 engine company-site could not seed its own
  `about` page after the migration and its setup failed with a 409. The
  imported pages now keep slugs of their own: `about-the-paper`,
  `corrections-policy` and `contact-the-desk`.
- saas-multitenant's setup imported the client through the `$lib` alias, which
  plain node cannot resolve, so provisioning stopped before creating a tenant.
- `make preview` skips a port another process holds instead of stopping that
  process, and `make check-pages` fails an app whose server is not running.
- The perf runner discards a run that measured no request, keeps a link's query
  string when it crawls, and drives the last content type that holds rows.
- The newsroom desk page said nothing enforces a stage's required role. The
  review plugin enforces it.

## [0.1.3] - 2026-10-03

### Fixed

- The README and the booking app's README count the 51 plugins the engine
  compiles in. Both said 49.
- `make up` and `perf/bench-stack.sh` create the first admin again on an engine
  that requires a setup token. The stack generates `LYEVE_SETUP_TOKEN` into
  `.stack/secrets.env`, starts the engine with it and sends it on the setup
  call; without it the engine answers setup with a 401.
- Every instruction to provision an app says `pnpm run setup`. `pnpm setup` is
  pnpm's own command for installing pnpm, and it wins over a script of the same
  name, so the documented command never ran the app's provisioning.
- `make setup` provisions every app even when one fails, then lists the failures
  and exits non-zero. It stopped at the first failure, so every app after the
  first broken one was left unprovisioned.
- The benchmark README names the targets that exist, `make bench ENGINE=<app>`
  and `make bench APP=<app>`.
- community-forum runs again. Replies and votes are records in the `comments`
  and `comment_votes` types the schema plugin's comments preset creates, and
  the app owns what the retired comments plugin did: a visitor's reply is
  always written pending, moderation rewrites the status, and one vote per
  visitor is an upsert.
- company-site's contact form runs again. The form is a `forms` record of the
  forms preset, a submission is a `form_submissions` record, and the app checks
  the stored field rules and the honeypot before it writes.
- newsroom's review runs again on the review plugin's `/api/admin/review/`
  routes. The definition turns off publish-on-approve so the desk's publish
  step, which writes both status columns, stays the one that publishes, and it
  then moves the review to `published`.
- analytics-dashboard no longer shows three panels that read retired routes:
  tenant health scores, install counts and registered widgets.
- The development license names the paid plugins and capabilities the engine
  gates today, and `make up` mints it again when that list changes. The build
  links the license public key into the one symbol the engine reads.
- `make up` relaxes the sign-in limit again. It wrote the rule's own update
  route, which now refuses a built-in protection with a 409, so every boot
  warned and a full `make setup` ran into 429s; it writes the protections route.

### Changed

- The README lists media-library and analytics-dashboard, gives the toolchain
  versions `mise.toml` pins and the engine's 51 plugins, and names ui-kit among
  the apps' dependencies. The prose that credited the billing, monetization,
  SEO and quota plugins now says what serves those routes today.

## [0.1.2] - 2026-09-09

### Changed

- Documentation and shipped strings no longer carry em dashes, unicode
  ellipses or unicode bullets. Where a string is an error or a log line the
  wording changed and nothing else: status codes, machine-readable error codes
  and behavior are untouched, so a client matching on a code is unaffected.
- An elision inside a code span now uses three ASCII periods, so a reader who
  copies one gets something their tool accepts.

## [0.1.1] - 2026-09-07

### Changed

- Every example app builds against `@lyeve-labs/ui-kit` 0.16.0. Twelve declared
  0.11.2 and eleven declared 0.13.0 while the workspace resolved all of them at
  0.11.2, so two of the three groups were not running what they claimed. A caret
  on a `0.x` version is locked to the minor, so none of it moved on its own.

### Fixed

- The preview servers no longer sit on ports other local development servers
  commonly use. Running both at once meant whichever started second either
  failed to bind or quietly served the other one's site.

## [0.1.0] - 2026-09-05

### Added

- Add runnable LyEve example applications.
- Relax the login rule at boot, allow loopback webhooks, add a preview pass.
- Measure every example at the page and the engine.
- Add eight scenarios and finish the serial pass.
- Generate the benchmark profiles from the examples.

### Changed

- Every example is its own package, built on the published SDK.

### Fixed

- Identify the binary that was measured, not the checkout.
- One boot path, and stop the launcher killing the engine.
