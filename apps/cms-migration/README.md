# Migrating in from another CMS

A newspaper archive arriving as three CSV files, imported with the real
command-line tool, and a page that shows what the tool reported next to what the
engine actually holds afterwards.

This is a runbook. The findings below were established by reading the tool's
source and running it against a live engine, and they are the reason the
migration here takes three invocations rather than one.

## Read this before you migrate anything

**Everything the tool imports is invisible to search and to the admin UI, and
nothing warns you.** The tool writes each entry with
`POST /api/v1/content/{schema}` and a body of `{"data": {...}}`. That route
inserts into the schema's generated table and stops there. Search reads the
admin content table, so a migrated row is never indexed. The engine returns
`total: 0` for a phrase that is plainly in a migrated headline, with a 200 and no
error. The report page puts that query next to the same query against one page
written through `POST /api/admin/content`, so you can see the two answers side by
side.

There is no switch for this. If your content has to be searchable, either write
your own importer against `POST /api/admin/content`, or accept that the imported
corpus is reachable by `/api/v1` reads and by nothing else. Re-importing the same
rows through the admin route afterwards is not a fix: that route mirrors into the
generated table too, so you end up with every row twice.

**No single base URL works.** The tool builds one client and points it at
`--admin-url`. It authenticates against `/api/admin/auth/login` and lists schemas
at `/api/admin/schemas`, which only the admin listener serves. It writes to
`/api/v1/content/{schema}`, which only the public listener serves. Aim it at the
admin port and the dry run passes, the schemas get created, and then every single
row fails with a 404 that names nothing. Aim it at the public port and it cannot
log in.

The fix is the one a real deployment already has: a single hostname in front of
both listeners, routing by path prefix. `migration/single-origin-proxy.mjs` is a
standard-library Node server that does exactly that, and `migration/run.sh`
starts it, reads the port it bound, runs the tool against it, and stops it.
Substitute your ingress, traefik, or nginx.

**`--api-url` is accepted and ignored.** It is parsed into the config and never
read. Every request goes to `--admin-url`.

**`--checkpoint` is accepted and ignored.** The runner overwrites it with
`cmsctl_migrate_<source>_checkpoint.json` in the working directory. `run.sh`
gives each stage its own directory so the two live stages do not overwrite each
other's progress.

## What the tool does with content types

It creates one it cannot find, but not one you would want to keep. The fields
come only from the mappings file, and only their name, type and required flag
are used. No index, no unique constraint, and no `relation_to`, which means a
mapping with `"field_type": "relation"` produces a bare `author_id UUID` column
with no foreign key behind it.

It also adds `_source_id` and `_source` to record where each row came from, and
marks them `system: true`. The schema engine emits no column for a system field,
so no column is created, and the values the tool writes on every row are dropped
by the insert builder without an error. Provenance does not survive unless you
carry it yourself.

So `setup/provision.ts` declares the three target types properly, with indexes, a
real `belongs_to` relation, and a `legacy_id` text field that keeps the old
system's primary key. The tool then reports each one as
`schema legacy_authors already exists, skipping DDL`, which is the outcome you
want.

## How a relation column is carried

It is not translated. The CSV cell reaches the UUID column exactly as it was
written, so a column of legacy keys like `p-118` fails every insert. The
WordPress adapter has the same shape: it copies the site's numeric `author` into
`author_id` and hands the number on.

A relation therefore takes two passes:

1. migrate the target type, here `legacy_authors`
2. read back the ids the engine minted, keyed by the legacy id you kept
3. rewrite the child export with those ids in the column the mapping points at
4. migrate the child type

`migration/resolve-relations.ts` is steps 2 and 3. It refuses to write a partial
file: an unresolved byline stops the run and names the key, because a silently
dropped relation is data loss that shows up months later.

## What the dry run tells you, and what it does not

`--dry-run` connects to the engine, lists the existing schemas, reads every
source file, and prints:

- the number of content types and rows it found
- which types it would create and which already exist
- per type, the row count, a warning count, and PASS or FAIL

The warnings are one thing only: a source column named by a mapping you marked
`"required": true` is missing from a row. That is the whole check.

It does not validate field types. It does not look at the target schema's own
required fields. It does not check that a relation value is a UUID, let alone
that it resolves. And it does not fail:

    lyevectl migrate data from-csv --csv-paths legacy_posts=./posts-unquoted-row.csv \
      --mappings ./mappings.json --admin-url http://localhost:4401 \
      --email ... --password ... --dry-run

`migration/posts-unquoted-row.csv` has one row whose headline was written without
quotes, so it carries two extra commas. Go's CSV reader stops at that row. The
report says:

      legacy_posts                   0 entries  0 warnings  PASS

Exit code 0. The only trace is one line on stderr saying
`FAILED: csv: row 3 in legacy_posts: record on line 8: wrong number of fields`.
A live run behaves the same way: the reader errors, the whole content type is
skipped, and the summary says completed. Read the stderr log, and compare the row
count in the report against `wc -l` on your export before you trust either.

## The checkpoint and --resume

The checkpoint is a JSON file recording, per content type, the source ids that
migrated, were skipped, or failed. Passing `--resume` loads it and filters those
rows out before the write, which is what makes a second run of `run.sh`
harmless.

The identity it records is the row's position in the file. The CSV adapter
assigns each entry the source id `"<schema>:<row number>"`. It does not read an
id column, even when the export has one. So:

- **editing the export between runs invalidates the checkpoint.** Delete a row,
  and every row after it takes the identity of its neighbor. A resume then skips
  the wrong rows, and nothing about the result looks wrong.
- **without `--resume` a second run inserts everything again.** There is no
  upsert and no dedupe, and nothing here declares `slug` unique, so you get
  duplicates rather than an error. If you want that guard, declare the slug
  unique in the target schema and let the insert fail.
- a resumed run with nothing left to do prints `Total entries: 0` and
  `Migrated: 0`, because the filtering happens before the count. That is success,
  not a fault.

The whole export is read into memory before the first write, so the batch size
bounds how often the checkpoint is saved, not how much is held.

## The other adapters

Same engine, same write path, same two-listener problem. Only the source
changes.

    # Contentful, via the Content Delivery API
    lyevectl migrate data from-contentful \
      --contentful-space=SPACE --contentful-token=CFPAT-... \
      --admin-url https://cms.example.com --email ... --password ...

    # Strapi v4, via the REST API
    lyevectl migrate data from-strapi \
      --source-url=https://cms.example.com --strapi-token=... \
      --schema-filter=article,page

    # WordPress, via the REST API
    lyevectl migrate data from-wordpress \
      --source-url=https://blog.example.com \
      --wp-username=admin --wp-password='app password'

    # WordPress, from a WXR export file, chosen by the .xml suffix
    lyevectl migrate data from-wordpress --source-url=./export.xml

Things worth knowing about each:

- **Contentful** flattens `sys.id`, `sys.createdAt`, `sys.updatedAt` and
  `sys.locale` alongside the fields. A field whose value is a single-locale map
  is unwrapped. A multi-locale field is passed through as an object and lands in
  your column as JSON.
- **Strapi** discovers content types through
  `/api/content-type-builder/content-types`, which needs an admin token. With a
  plain API token that endpoint answers 403 and the run stops, telling you to
  pass `--schema-filter`.
- **WordPress** turns `title`, `content` and `excerpt` into their rendered
  strings, maps `date` to `published_at`, and prefixes ACF fields with `acf_`.
  `categories` and `tags` arrive as arrays of numeric WordPress ids, and
  `featured_media` as a number. Those are all source-system ids and need the same
  two-pass resolution as a byline.

Shared flags: `--schema-filter` to scope the run, `--batch-size` for how often
the checkpoint is written, `--tenant` to set `X-Tenant-ID`, and `--api-key`
instead of `--email` and `--password`. Prefer the API key on a real instance: the
login route is rate limited per address, five attempts per fifteen minutes by
default, and every invocation of the tool logs in again.

## Run it

From the repository root, with the stack up:

    make up          # once
    make install
    cd apps/cms-migration && pnpm run setup && pnpm dev

Then open http://localhost:5191.

`pnpm run setup` applies the three content types, writes the one control page through
the admin route, and then runs `migration/run.sh`, which needs a Go toolchain and
a `lyeve-cli` checkout beside this repository. Set `LYEVE_CLI_DIR` if yours is
elsewhere. Run the migration on its own with:

    bash migration/run.sh

It is safe to run again. Every stage passes `--resume`.

## Layout

    migration/authors.csv              the legacy people export
    migration/posts.csv                the legacy article export, with quoted
                                       commas, doubled quotes, and one body that
                                       spans lines
    migration/pages.csv                the legacy static pages
    migration/posts-unquoted-row.csv   the same posts with one row broken, to
                                       show the dry run passing anyway
    migration/mappings.json            legacy column to target field
    migration/single-origin-proxy.mjs  one origin in front of both listeners
    migration/resolve-relations.ts     legacy byline keys to engine ids
    migration/run.sh                   dry run, migrate, resolve, migrate
    migration/reports/                 everything the run produced
    setup/provision.ts                 target content types and the control page
    src/lib/server/reports.ts          reads and parses the saved reports
    src/routes/+page.server.ts         the report, beside the read-back counts
    src/routes/posts/[slug]/           one migrated article with its byline

## What this example does not do

- **It does not make migrated content searchable.** It proves that it is not,
  and explains the only two ways out.
- **It does not import media.** The exports carry no attachments. A real
  migration needs a fourth pass that uploads each file to
  `POST /api/admin/media` and rewrites the reference in the body, and the
  engine's download route needs a token, so the app has to proxy the bytes.
- **It does not sanitize the imported markup.** The bodies here come from a file
  in this repository and are rendered with an unescaped HTML block. Fifteen years
  of an editor's paste buffer is not trusted input.
- **It does not preserve created dates.** The engine sets `created_at` itself, so
  the original publication date survives only because it was mapped into a field
  of our own, `published_at`. The list route cannot sort on that either, so the
  report page sorts in the app.
- **It does not handle a target schema the export does not cover.** A required
  target field with no mapping fails every row, one row at a time, and the
  failures land in the summary rather than stopping the run.
- **It imports thirteen rows.** Enough to exercise quoting, a relation and a
  checkpoint. It says nothing about how the tool behaves on a hundred thousand.
