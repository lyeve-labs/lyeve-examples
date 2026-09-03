# lms-courses

A course platform: a catalog, a course page with its full curriculum, a lesson
reader with previous and next navigation, and an enrollment form.

It exists to answer one question honestly. **How do you render a three-level
content tree on an engine whose relation support only walks one way?**

Runs on port 5182.

## What this example proves

Content is nested three deep. A lesson belongs to a module, a module belongs to
a course, and every page needs more of that tree than a single request returns.

The engine resolves a relation from the record that stores it. A lesson row
holds `module_id`, so `populate` inflates a lesson's module. **Nothing walks the
other way.** A course row holds no reference to its modules, so no combination
of `populate` and `depth` returns them. That was measured against a running
engine, not assumed:

| Request | Result |
|---|---|
| `?populate=<relation>` | the stored reference is inflated into the whole record |
| `?populate=*`, `?depth=1` and above | the same, for every relation the record holds |
| any of the above, asked of the parent | nothing, because the parent holds no reference to its children |

A depth above one walks further along that same direction, from each record it
has already inflated toward the record that one points at. It never turns
around, and naming a relation that does not exist is ignored without an error,
so a typo in `populate` reads as a record with no relations.

The direction that is missing is still reachable, just not through `populate`.
`filters[col]=value` does exact equality on any column, `module_id` included, so
a parent's children are one filtered list away. That is the whole technique:

1. Fetch the course by slug.
2. Fetch its modules with `filters[course_id]=<course id>`.
3. Fetch each module's lessons with `filters[module_id]=<module id>`, all in
   parallel.

A three-module course page is six reads: course, modules, three lesson lists,
and one more for the enrollment count. `src/lib/server/outline.ts` carries the
walk and the reasoning.

The catalog takes the opposite approach in `loadCatalog`, and the contrast
is the point. Three requests fetch every course, every module and every lesson,
and the grouping happens in memory. That is the better trade while the whole
catalog fits in one page and the wrong one the moment it does not, because a
truncated page understates a course silently rather than failing.

Nothing in this app calls `populate`, and that is the finding rather than an
omission. Every page needs the direction `populate` does not serve, so relation
ids are read with `relationId()` and the children are fetched by filter.

### Why the lesson page loads the entire course

Previous and next cross module boundaries. The last lesson of module two is
followed by the first lesson of module three, and neither module knows about the
other. There is no endpoint that returns a lesson's position within a course, so
the reader assembles the same outline the course page does and reads the
neighbors out of the flattened list.

## Content types

All four are prefixed, because every example in this repository shares one
engine.

| Schema | Fields |
|---|---|
| `lms_courses` | `title`, `slug`, `summary`, `body`, `level`, `cover_media_id` |
| `lms_modules` | `title`, `slug`, `sort_order`, `course` (belongs to `lms_courses`) |
| `lms_lessons` | `title`, `slug`, `body`, `sort_order`, `duration_minutes`, `module` (belongs to `lms_modules`) |
| `lms_enrollments` | `title`, `slug`, `student_name`, `student_email`, `progress`, `course` (belongs to `lms_courses`) |

The position field is `sort_order` rather than `order`. The engine quotes
identifiers, so a column called `order` would be created successfully, but a
reserved word makes every later query against it a quoting exercise for no gain.

## Engine features exercised

- Schema apply with a three-deep relation chain, applied parent first because a
  relation emits a foreign key against the target's generated table.
- `belongsTo()` relations, written under the field name and read back under
  `<field>_id`.
- `filters[col]` exact equality, including several filters combined with AND:
  the enroll action asks for an enrollment matching both `course_id` and
  `student_email` before writing a new one.
- Media upload and retrieval. The seed generates a real PNG cover per course,
  uploads it, and every page serves it through the app's own `/media/[id]`
  route.
- Content writes through the admin route, both from the seed and from a live
  form action.
- Field validation. `student_email` is an `email` field, and a malformed address
  comes back as a 422 carrying the field name, which the action turns into a
  message beside the input.

## What the product does not support

Everything here was verified against a running engine. None of it is worked
around silently.

- **No anonymous read.** Every content route sits behind auth, so the browser
  cannot call the engine. This app is a backend for frontend: the credential
  lives in `src/lib/server/`, and the browser only ever talks to SvelteKit.
- **Populate has one direction.** A child can be asked for its parent. A parent
  cannot be asked for its children. These examples declare relations with
  `belongsTo()` only, because a relation marked `required: true` generates a
  second, dead NOT NULL column that no write path ever fills, and every insert
  then fails with a 422 naming nothing.
- **No set filter.** `filters[module_id]=a,b` returns 422 and
  `filters[module_id][in]=a` returns 400, so a course with three modules costs
  three lesson requests. A single IN clause would make it one, and its absence
  is the real cost of the technique above.
- **No sort parameter.** Rows always arrive `created_at DESC`. Curriculum order
  is restored in the app from `sort_order`, which is why that field exists.
- **No total, no aggregate.** A list response is a bare JSON array with no count
  and no `has_more`. The enrollment figure on a course page is the length of a
  capped page, so a course with more than 200 enrollments would understate it.
  Counting properly needs a count endpoint the engine does not have.
- **`limit` is clamped to 25..200.** Asking for 3 returns 25. The shared helper
  slices for you. The ceiling of 200 is real and bounds every read in this app.
- **`default` on a field is accepted and then ignored.** No DEFAULT clause is
  emitted, so `progress` is written as `0` explicitly on every enrollment.
- **Population is best effort.** A relation the engine cannot resolve comes back
  as null rather than as an error, so a page has to render sensibly when a
  relation is missing rather than trusting that it will be there.
- **Read shapes are cached and can bleed.** List responses carry
  `Cache-Control: max-age=60`, and a read that did not ask for population was
  observed returning inflated relations shortly after another read of the same
  rows did ask for it. Never infer from the shape you got back. `relationId()`
  finds the id whether or not the response was populated, and `related()` is the
  matching reader for the populated side.
- **Media needs a bearer token.** The engine's download route answers 401 to an
  unauthenticated request, so pointing an `<img src>` at it shows a broken
  image. Covers are proxied through `/media/[id]`, which is the credential
  boundary.
- **Search is on the admin router only.** There is no public search route, so a
  search box has to be proxied by the app. The `blog` example demonstrates that.
  This one stays on the read paths the catalog needs.

## Running it

From the repository root, boot the engine and install dependencies once:

```
make up
pnpm install
```

Then provision the content types, seed the catalog and start the app:

```
cd apps/lms-courses
pnpm run setup
pnpm dev
```

Open http://localhost:5182.

`pnpm run setup` reads the engine URL and credentials from the repository root
`.env` that `make up` writes, so there is nothing to export by hand. It is also
safe to run again: applying a content type that already exists is accepted, and
the seed stops as soon as it finds a course, so covers are not uploaded twice
and the catalog is not duplicated.
