# Photo Library

A photo archive built on the media plugin: uploads, folders, generated
variants, storage keys, and the record the engine keeps about every file. Where
the other examples store a media id on an entry and proxy the bytes, this one
works the pipeline itself.

## Read this before you build on it

Four things cost an afternoon each if you find them by experiment.

**A media record has no usable URL.** The `url` field exists in the struct and
is filled from the storage driver's signed URL. The local driver signs nothing
without a signing key, and it cannot be given one: it reads
`storage_local_signing_secret` through `Config.String`, and the config layer
redacts every key ending in `_secret` to the empty string before the plugin sees
it. So setting the variable changes nothing, `omitempty` drops the key from the
JSON, and the plugin logs a warning saying the secret is not set even when it
is. With `STORAGE_DRIVER=local` a record has no URL and no configuration
produces one. Store the media id on your entry and serve the bytes yourself.

**The download route needs a bearer token.** `GET
/api/admin/media/{id}/download` answers 401 without one, so an `<img>` pointed
at the engine is a broken image. It also sets `Content-Disposition: attachment`
and `Cache-Control: no-store`, which are right for an admin download and wrong
for a gallery. `src/routes/media/[id]/+server.ts` is the credential boundary and
decides its own headers.

**Variants may be absent by design.** The processor tries three fixed presets
and skips any whose box already contains the source **in both dimensions**. The
comparison is inclusive, so a 1024x1024 upload gets no `large` variant and a
150x150 upload gets none at all. That is correct: fitting a smaller image into a
larger box writes a bigger file carrying no more detail. It reads as a bug
because nothing in any response distinguishes a preset that was declined from
one whose encode failed. `/photos/<slug>/variants` reconstructs the reason by
comparing the source against the presets, which is what every client has to do.

**A variant's bytes are not reachable over HTTP with the local driver.** The plugin
declares nine routes and not one of them serves a variant. An original is
addressable by record id. A variant has a row, a file on disk and a storage key,
and its only door is the URL the driver signs. Combined with the redaction
above, that means a local install describes a file it can never hand over. An S3
or CDN driver does sign URLs, and that is the only configuration in which the
variant route below serves anything.
`src/routes/media/[id]/[preset]/+server.ts` proxies the variant where the
deployment makes that possible and answers 404 where it does not, rather than
quietly serving the full-size original at the variant's address.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/media-library && pnpm run setup && pnpm dev

Then open http://localhost:5193.

`pnpm run setup` generates ten PNGs with `node:zlib` and uploads them. The
repository carries no binary assets, and the sizes are chosen so the variant
skipping is visible: the set straddles 150, 480 and 1024, and two frames sit
exactly on a preset boundary.

## What it demonstrates

**The upload, as one multipart request per batch.** `/upload` is a SvelteKit
form action. The engine reads every file part in the form, so one request
carries several files, and `folder` and `alt_text` are read once and applied to
all of them. The batch is atomic in the direction that costs you: the first file
the pipeline rejects causes every file already stored in that request to be
deleted, and the response is one 422 with no per-file detail. The page shows the
records that came back, field by field.

**Folders, which are a string and an index and nothing else.** A folder is
validated against `[a-z0-9_/-]` and rejected outright otherwise, including for a
capital letter. It becomes the key prefix, so `gallery/harbour-in-fog` puts the
bytes under `uploads/gallery/harbour-in-fog/` on disk. There is no route that
lists folders, no route that moves a file between them, and a list is filtered
by exact string equality. An album page reads the folder listing alongside its
own photo entries, because the two can disagree.

**What the upload does to the bytes.** An image the engine can decode is
re-encoded to strip EXIF, the orientation tag is baked into the pixels and
removed, and `size` is rewritten to the length of the replacement. The picture
survives and the file does not, so a checksum of your upload is no way to tell
whether the stored copy is current. The private EXIF fields are scrubbed from
the stored metadata document as well as from the bytes, which is why a
photograph cannot leak its GPS fix through the record or through the geographic
filter in media search.

**Two searches that are not the same search.** `GET /api/admin/search` reads
`sys_content_entries` and knows nothing about files. `POST
/api/admin/media/search` reads `sys_media` and is the only way to ask about a
dimension, a size range, a tag, a camera or a scan status. It answers
`{items, total}`, sorts **ascending** unless told otherwise, and its rows carry
no variants. Its limit does not clamp: a value above 200 is replaced by the
default of 50, so asking for 500 quietly gives you a tenth of that. And it has
no OR, so a question like "wider than 1024 or taller than 1024" is two requests
and a union, which is what the album page does.

**Scan status, which does not mean what it says.** In the local setup every record
reads `scan_status: pending` with `scan_result: "virus scanning disabled"`.
`pending` is not a queue. Nothing in the plugin ever revisits a media row, so
the value a record is created with is the value it keeps forever. See below.

## What the engine does not do

- **No route updates a media record.** There is no PUT and no PATCH. `alt_text`
  is set once per upload request and cannot be corrected. A record's `folder` cannot be
  changed. Its `tags` are derived from the metadata and the media kind and no route
  accepts them, so a plain PNG is tagged `image` and nothing else. `POST
  /api/admin/media/{id}/reprocess` re-derives the metadata and the variants from
  the bytes in storage, which is the closest thing to an edit, and it does not
  rescan.
- **No bulk delete.** `DELETE /api/admin/media/{id}`, one at a time.
- **Deleting a photograph does not delete its bytes.** A photo entry and a media
  record are separate rows with no foreign key between them. Removing the entry
  leaves the file, and the album page in this app lists the files in a folder
  that no entry points at, because that is the shape the orphan takes.
- **A media list is an envelope, not an array.** `GET /api/admin/media` answers
  `{data, total_count, limit, offset}`, while a v1 content list answers a bare
  array. Reading `.length` off the envelope gives `undefined` and the page
  renders empty with nothing to debug. Its `limit` defaults to 50 and clamps to
  500, which is not the 25..200 clamp the content routes apply.
- **An upload response carries no variants.** Generation is inline and finishes
  before the request returns, but the rows go straight into
  `sys_media_thumbnails` and are never attached to the record the handler
  marshals. Only `GET /api/admin/media/{id}` and
  `GET /api/admin/media/{id}/thumbnails` report them, so finding out what an
  upload produced is a second request per file. A list never reports them at
  all, so knowing which of a hundred files have a thumbnail costs a hundred
  requests.
- **`updated_at` is not a timestamp.** `sys_media` has no such column. The JSON
  field is marshaled from a struct member nothing ever assigns, so every record
  ever returned reports `0001-01-01T00:00:00Z`.
- **`byte_size` on a variant is always 0.** The column is written from a buffer
  the upload has already drained, so the number is zero for every variant the
  engine has generated. The file on disk has a real size. The record does not
  carry it. `size` on a variant is the preset name, not a byte count.
- **`scan_status: pending` is a resting state, not a queue.** Read it as
  unscanned. Two other values need the same reading: `unscannable` means
  scanning was switched on and clamd could not be reached, and `error` means the
  scan failed. In both cases the upload is accepted anyway. Only `clean` is
  evidence that anything looked at the bytes, and only `infected` refuses an
  upload. A deployment that means to scan has to set `MEDIA_VIRUS_SCAN=true`,
  point `MEDIA_CLAMAV_ADDR` at a reachable clamd, and then monitor for
  `unscannable`, because a missing scanner is not an outage the engine reports.
- **No required relation.** A photograph with no album is a shape the database
  accepts, because declaring the relation required makes every insert fail.
- **No sorting, and no page below 25, on the content routes.** Rows arrive
  `created_at DESC`. An album is sorted oldest-first in this app, in the app.

## The storage driver

`STORAGE_DRIVER=local`, which is what the examples stack runs. The bytes land
under `STORAGE_LOCAL_PATH`, which defaults to `./uploads` relative to the
engine's working directory and in the local setup resolves to `lyeve-core/uploads/`.
Keys are `<folder>/<uuid>_<sanitized filename>`, and a variant is the original
key with its extension replaced by `_<preset>.<format>`, so the whole set sits
beside each other in one directory listing. A file uploaded with the default folder of
`/` produces a key that opens with a slash and lands flat in the root.

The S3 driver needs `STORAGE_S3_BUCKET` at minimum, plus a region, and reads
`STORAGE_S3_KEY` and `STORAGE_S3_SECRET` as secrets rather than as ordinary
config. `STORAGE_S3_ENDPOINT` and `STORAGE_S3_FORCE_PATH_STYLE` point it at
MinIO, and `STORAGE_S3_CDN_BASE_URL` is what finally makes `url` on a record
non-empty and this app's proxy route optional. That is the only configuration in
which `/media/[id]/[preset]` serves bytes, because the S3 driver's credentials
are read through the secrets provider rather than through `Config.String` and
therefore actually arrive.

## Layout

    src/lib/naming.ts                  schema names, slug prefixes, the presets
    src/lib/server/lyeve.ts            the client
    src/lib/server/media.ts            the media plugin surface, and what each field means
    src/lib/server/gallery.ts          album and photo reads
    src/routes/+page.server.ts         album index
    src/routes/albums/[slug]/          one album, as a grid, beside its folder listing
    src/routes/photos/[slug]/          one photograph and every field the engine stored
    src/routes/photos/[slug]/variants/ which variants exist, which were skipped, and why
    src/routes/upload/                 multipart form action, several files at once
    src/routes/media/[id]/             original bytes, proxied with the credential
    src/routes/media/[id]/[preset]/    variant bytes, where the driver signs a URL
    setup/photo-image.ts               generates real PNGs at chosen sizes
    setup/provision.ts                 content types, albums, uploads, seed report

Nothing outside `src/lib/server/` and the `.server.ts` files touches the engine.

## Not benchmarked where it matters

`benchmark.json` measures the content side: the album index, an album filtered
on its foreign key, and a photograph read plain and populated. The media routes
are deliberately absent from the mix. A profile seeder fills content types, so
`sys_media` would hold whatever a development run left behind, and a media list
or a download templated against thirty rows would publish a number that
describes nothing. Measuring the pipeline needs a seeded media store, and no
profile builds one.
