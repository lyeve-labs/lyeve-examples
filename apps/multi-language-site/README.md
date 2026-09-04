# Multi-language site

A four-locale site on the localization plugin: per-entry translations, locale
fallback with a visible notice, and a translation-status view that edits the
rows behind it.

## What it does not do, before anything else

- **It does not translate anything.** The plugin stores a title, a body and a
  meta blob per locale and nothing more. Every translation here was written by
  hand into `setup/provision.ts`.
- **It does not localize a slug, a status, a date or a relation.** Those live on
  the content entry, which has one value for all locales. `/de/opening-hours`
  and `/fr/opening-hours` are the same record under the same path.
- **It does not negotiate a locale.** The plugin ships a middleware that would
  read `Accept-Language`, but nothing installs it, so the header changes nothing
  anywhere in the engine. The locale is the first path segment and the `locale`
  parameter on the resolve route, and that is the whole mechanism.
- **It does not let the engine own the locale list.** There is no register of
  locales to write to: `PUT /api/admin/localization/locales` accepts a body,
  answers a fixed message and stores nothing. The list lives in
  `src/lib/locales.ts`.
- **It has no search, no media and no anonymous access.** Every page is rendered
  by the SvelteKit server, which holds the credential.

## Run it

From the repository root:

    make up                            # once, boots postgres and the engine
    make install
    make setup                         # provisions and seeds every example
    make dev-multi-language-site

Then open http://localhost:5185. It redirects to `/en`. The switcher in the
header moves between English, German, French and Canadian French.

`make setup` is the target to use rather than `pnpm run setup` in this directory,
because the seed script reads the credential from the environment and the
Makefile is what exports the root `.env` into it. The dev server needs no
environment at all: `src/lib/server/lyeve.ts` falls back to the local stack's
ports and the first admin account.

## What it demonstrates

**Fallback is two decisions, not one.** `GET /api/v1/localization/resolve`
builds the chain (`fr-CA`, then `fr`, then `en`), walks it, and reports where it
stopped in `resolved_locale` and `fallback_chain`. What it does not do is fall
back to the content entry: an entry with no translations at all answers 200 with
`resolved_locale: "en"`, `translation_status: "draft"`, an empty `title` and
`body: {}`. An empty title is the only signal that nothing was found. So the
last step belongs to the app, and `src/lib/server/localize.ts` is where it
happens: the site drops to the entry's own text and labels the page a source
record rather than passing English off as German. Every page carries a panel
showing both answers.

**The default locale needs a row like every other language.** Because resolve
reads only the translation table, an entry whose English text is only on the
entry itself resolves to nothing. `setup/provision.ts` therefore writes an `en`
translation for every record, derived from the entry so the two cannot drift.
One page, `our-history`, is deliberately left with no translation at all, so the
empty answer and the app's fallback are both visible in the running site.

**Resolve is the wrong tool for a list.** It answers for one entry, so a
localized index of six pages under three section headings would be nine calls.
`POST /api/admin/translations/bulk-export` returns every translation for up to
200 entries in one request, and the app applies the chain itself over what comes
back. That is why `src/lib/locales.ts` reimplements the chain: it has to be
available before the request, not reported after it.

**Bulk-import is the only upsert.** POST answers 409 when a locale already has a
row and PUT answers 404 when it does not, so a single-locale write has to know
which verb it needs. `saveTranslation` takes that from the page it rendered and
retries the other verb if another editor got there first. The seed script uses
bulk-import instead, keyed on tenant, entry and locale, which is what makes
`pnpm run setup` safe to run twice.

**A public route that still needs a credential.** The resolve route is declared
`GroupPublic` and really is mounted without `requireAuth`, so it answers without
a token. It answers 404. The tenant a request acts in is read from the token,
and with no tenant the entry lookup matches nothing:

    curl 'localhost:4402/api/v1/localization/resolve?entry_id=<uuid>&locale=de'
    404 {"code":"not_found","error":"content not found"}

The credential is not optional, only the middleware is.

**Status is a label, not a workflow.** `draft`, `translated` and `outdated` are
three strings the engine stores and never acts on. Nothing marks a translation
outdated when the source changes, nothing stops a draft from being served, and
the seed data leans on that: the French version of `getting-here` is a draft two
paragraphs short of the source, and the German `printing-workshops` is marked
outdated. The site decides what those mean when it renders, and offers the
transitions on `/translations`.

## Layout

    src/lib/locales.ts                  the locale list, the chain, the switcher path
    src/lib/server/lyeve.ts             the client, and this app's schema names
    src/lib/server/translations.ts      the plugin's routes, typed
    src/lib/server/localize.ts          the fallback decision and its source-record step
    src/lib/server/pages.ts             the untranslated half: slugs, order, sections
    src/params/locale.ts                keeps /[locale] from swallowing /translations
    src/routes/[locale]/                the localized index and one page
    src/routes/translations/            the status matrix and the per-record editor
    setup/provision.ts                  content types, source records, translations

## Content model

Two content types, `i18n_sections` and `i18n_pages`, with a `belongsTo` relation
from page to section. Sections carry translations too, so a navigation heading is
localized by the same mechanism as a page body, and the About heading is
deliberately missing its German version.

Translation `body` and `meta` are opaque JSON to the engine. This app stores
`{summary, text}` and `{description}`, and those keys are its own contract.

## Routes used

| Route | Router | Why |
|---|---|---|
| `POST /api/admin/schemas` | admin | the two content types |
| `POST /api/admin/content` | admin | the source records |
| `GET /api/v1/content/{schema}` | public | slugs, order, sections, source text |
| `GET /api/v1/localization/resolve` | public | one page, resolved, with its chain |
| `POST /api/admin/translations/bulk-export` | admin | the whole matrix in one call |
| `POST /api/admin/translations/bulk-import` | admin | idempotent seeding |
| `GET /api/admin/content/{id}/translations` | admin | the editor's own read |
| `POST`/`PUT`/`DELETE /api/admin/content/{id}/translations` | admin | the editor's writes |
| `GET /api/admin/localization/locales` | admin | what the engine thinks the locales are |

`{id}` throughout is the content entry id: the uuid `POST /api/admin/content`
returns, which is the `sys_content_entries` row and not the generated table's own
key.
