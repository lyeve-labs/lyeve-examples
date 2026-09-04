# Newsroom

The content lifecycle: drafts, publishing, numbered revisions with restore, an
embargo, and a three-stage review on the review plugin. A public front page that shows only
published stories, and a desk that shows every story at every status.

## Read this first

**A story's status is two columns in two tables, and no engine route writes
both.** This is the single fact the whole example is arranged around.

| | Desk status | Public status |
|---|---|---|
| Column | `sys_content_entries.status` | `_news_stories._status` |
| Values | `draft`, `published`, `archived` | `published`, `draft` |
| Written by | `PUT /api/admin/content/{id}` | `PUT /api/v1/content/{schema}/{id}/publish` and `/unpublish` |
| Drives | the admin list, the admin UI, search | the filter the public read routes apply |

The admin write mirrors the entry into the public table, and the mirror carries
the title, the slug and the body fields. It never touches `_status`. So a story
created as a draft arrives in the public table at that column's default, which
is `published`, and appears on the front page while the desk calls it a draft.

Everything in `src/lib/server/lifecycle.ts` therefore writes both sides, in
that order, and the desk has a **reconcile** action for the cases where
something moved only one of them. `setup/provision.ts` ends with the same
sweep. Without it every seeded draft would be on the front page.

Three more consequences worth knowing before you build on this:

- `archived` is not reachable in the public column. `SetStatus` in the engine
  accepts it, but only two routes call `SetStatus` and they pass `published`
  and `draft`. An archived story is therefore `draft` publicly, which is what
  takes it off the list. The desk keeps the distinction. The public table
  cannot.
- **The scheduler is on the wrong side of the split.** An embargo
  (`scheduled_publish_at`) is fired by a worker in the content plugin that
  polls every thirty seconds and moves the desk status to `published` through
  the ordinary update path. That re-mirrors the body and cannot write
  `_status`, so an embargo that fires does not put the story on the front page
  by itself. Reconciling does.
- Asking the public route for drafts is `filters[_status]=draft`. On a schema
  without `with_draft_publish` the same filter is accepted and then fails in
  the store, so the answer is a **503**, not a 400.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/newsroom && pnpm run setup && pnpm dev

Then open http://localhost:5190. The desk is at `/desk`.

## What it demonstrates

**Two reads that disagree about drafts, on purpose.** `news_stories` is applied
with `with_draft_publish: true`, which adds the `_status` column. The list route
then appends `(_status = 'published' OR _status IS NULL)` on its own, and so
does a filtered list, which is what a slug lookup is. The get-by-id route does
not: it selects on id and tenant and nothing else.

    /                       list       -> published only
    /stories/[slug]         filtered list, so also published only  -> a draft 404s
    /desk/[id]/preview      get by id  -> a draft renders in full

That asymmetry is what makes an editor preview possible without a second store,
and it is also the reason a story id is not a safe thing to hand to someone who
should see only the published site.

**Two revision histories, and only one of them holds this content.**

| | `sys_content_revisions` | `sys_revisions` |
|---|---|---|
| Numbered | `revision_num`, with a change note and the status | uuid only, no note, no number |
| Written by | `POST` and `PUT /api/admin/content` | `PUT /api/v1/content/{schema}/{id}` |
| Read by | `GET /api/admin/content/{id}/revisions` | `GET /api/v1/content/{schema}/{id}/revisions` |

This app writes through the admin route, as every example here does, so the
numbered history is the real one and the public revisions route answers `null`
for every story. The restore that goes with it,
`PUT /api/v1/content/{schema}/{id}/revisions/{rev_id}/restore`, has nothing to
restore from. The revisions panel prints the count from the empty table beside
the full one, because that is the route a reader is most likely to reach for.

**Restore, which is not the plugin's rollback route.** `POST /api/admin/content/{id}/rollback`
does the right thing to the entry and to the history: it writes the old content
back and files it as a new revision rather than deleting anything. It does not
mirror, so the public read table keeps the superseded body and the site goes on
serving the text the editor just reverted. This app restores by sending the old
revision's payload through the ordinary update route, which files a new revision
and does mirror. It keeps the current slug rather than reverting the URL.

**What the review plugin gives, and what the app does.** The plugin gives an
ordered stage set per content type, one assignment per story that walks it, a
stage log of every move with its comment, per-stage SLA tracking computed from
that log, and review comments, all under `/api/admin/review/`. The state
machine is real: the target stage is derived from the stage order and never
taken from the caller.

- **No submit action.** Creating the assignment with
  `POST /api/admin/review/assignments` *is* the submission. The store opens it
  at the first stage as `pending_review` and writes its own `submit` row into
  the log.
- **Roles are enforced.** A stage action is checked against the engine's
  permission rules for `reviews` or `review:<slug>`, and then against the
  current stage's `required_role`. An admin or super admin satisfies any stage.
  This app's credential is the stack's super admin, so every stage opens to it.
  A newsroom with real editors writes a rule per role on the Permissions page.
- **Approval does not publish here, on purpose.** A definition's
  `publish_on_approve` is true unless the creator says otherwise, and then the
  last approval publishes the story. It does so by setting the public status
  column, and the desk status is the other column in the table above, which
  the plugin never writes: the desk would call a published story a draft, and
  reconciling would take it back down. So `pnpm run setup` creates the
  definition with `publish_on_approve: false`. An approved story is published
  by the desk's own publish button, which writes both columns, and that button
  then moves the assignment to `published` with the `publish` transition.
- **`approved` and `published` end the stage actions.** Approve, reject and
  request changes on either is a 409. `publish` is the one move from
  `approved`, and `unpublish` the one move back. `rejected` is not terminal,
  because `request_changes` is the way back to the first stage.

**Pagination the public route does not offer.** The desk reads
`GET /api/admin/content?schema=news_stories`, which takes a caller-chosen limit
up to 500 and returns a real `total_count`. The public read route clamps to
25..200 and returns a bare array.

## What this does not do

- **Nothing reconciles the two statuses on its own.** The desk shows the drift
  and offers a button. A real deployment would put the second write behind the
  first, in one place, and would still have to handle the case where the second
  one fails.
- **The public status is read with three requests.** There is no way to ask the
  public route for rows of any status, so `readPublicStatuses` asks once per
  value and merges. With more than 200 stories at one status it would need
  paging, which it does not do.
- **The desk pages nothing.** It asks for 500 rows and renders them.
- **One user.** The local stack has a single account, so every assignment is
  assigned to it. `POST /api/admin/review/assignments/{id}/reassign` exists
  and is not wired to a control here, because there is nobody to reassign to.
  Note that an assignee is a `sys_users` row while a byline is a
  `news_reporters` record: the two sets are unrelated, and the plugin validates
  neither, storing whatever uuid it is handed.
- **No image upload.** Stories carry a `cover_media_id` and the `/media/[id]`
  route serves the bytes with the server's credential, but nothing in the desk
  uploads one. Seed a media id by hand to see it render.
- **An embargo takes up to thirty seconds after its time**, and then still
  needs reconciling, per the note at the top.
- **HTML in a story body is sanitized server-side.** The content plugin strips
  script, iframe, object, embed and style tags, `on*` attributes and
  `javascript:` URIs from any string value containing a `<`. Plain prose passes
  through untouched.
- **No required relation.** A story with no desk and no byline is a shape the
  database accepts, because declaring a relation required makes every insert
  fail. The pages decide what to render for an unattributed story.

## Layout

    src/lib/server/lyeve.ts        the client, and this app's schema names
    src/lib/server/stories.ts      the read paths, and the drift check
    src/lib/server/lifecycle.ts    publish, unpublish, archive, save, restore, embargo
    src/lib/server/revisions.ts    the numbered history, the diff, the audit trail
    src/lib/server/review.ts       definitions, assignments, transitions, SLA, comments
    src/lib/server/users.ts        assignees, which are engine users
    src/routes/+page.server.ts     the front page
    src/routes/stories/[slug]/     one story, published only
    src/routes/desk/               every story, every status, and the reconcile action
    src/routes/desk/[id]/          edit, publish, revisions, review
    src/routes/desk/[id]/preview/  a draft, read by id
    src/routes/media/[id]/         image bytes, proxied with the credential
    setup/provision.ts             content types, the review definition, and the seed

Nothing outside `src/lib/server/` and the `.server.ts` files touches the engine.
The credential lives in this process, and SvelteKit refuses to bundle a
`$lib/server` import into the browser.
