# Helpdesk

A customer support desk: an inbox filtered by status, a ticket thread with
replies, a status workflow, and a public form that opens a ticket.

It is the example for **stateful content**. The blog publishes documents that
never change. A ticket is the opposite: it is opened by a stranger, replied to
by several people, and moved through a workflow, and every one of those is a
write. This app is where the engine's write paths, its relation model and the
narrow edge of its query language all show up at once.

## Why tickets are content types

The engine's support assistant, part of the AI plugin, is not a ticket system.
Its model is an AI chat session: `POST /api/admin/support/chat` takes a
`message` and answers it from a knowledge base, and the conversation can later
be escalated or resolved. There is no route that opens a conversation without an
LLM call, no priority, no requester and no queue. It answers questions. It does
not track work.

The schema plugin's `comments` preset is a closer fit, because it creates
ordinary content types with threading through a `parent` relation. It was still
not used here, because a comment points at what it discusses through two text
fields, `target_schema` and `target_id`, rather than a relation. A reply that
is a relation to its ticket can be populated, filtered by ticket and checked by
the engine, and a ticket needs fields a comment does not have: a requester, a
priority and a status workflow of its own.

So tickets and replies are content types, `desk_tickets` and `desk_replies`,
and a reply points at its ticket with a `belongs_to` relation. Everything in the
desk is then one kind of object that one set of rules applies to.

## The model

    desk_tickets   title, slug, body, status, priority,
                   requester_name, requester_email, attachment_media_id
    desk_replies   title, slug, body, author_name, author_role,
                   ticket -> desk_tickets (belongs_to)

`status` is `open`, `pending` or `closed`, and `priority` is `urgent`, `high`,
`normal` or `low`. Both are plain text columns. The engine has no enum field
type, so `src/lib/desk.ts` is the only definition of a valid value and every
write goes through it.

`requester_email` is text rather than the engine's `email` type on purpose. An
email column carries a database CHECK constraint on Postgres, and an admin write
mirrors into that table on a best-effort basis: an address the constraint
refuses is accepted by the API, logged on the engine, and then missing from
every read. The app validates the address before it writes instead.

## What it exercises

- **Relations.** `belongsTo('ticket', 'desk_tickets')`, written under `ticket`
  and read back under `ticket_id`, through `relationId()`.
- **`filters[]` equality**, on `status` for the inbox and on `ticket_id` for a
  thread. Both columns are declared `indexed`, because both are what the desk
  reads by.
- **Offset paging.** A list response is a bare array with no total, so the end
  of the data is a short page and nothing else.
- **Two write paths, one of them correct.** New tickets and replies go through
  `createContent` (`POST /api/admin/content`). A status change is
  `PUT /api/admin/content/{id}`, on the same admin router, with a `change_note`
  that files a revision.
- **Sorting in the app.** The queue is urgent-first, which the engine cannot
  express.
- **Field-level errors.** A rejected write comes back as a 422 with field
  errors and no top-level message, and the forms show them.
- **Backend for frontend.** No page, component or `+page.ts` touches the
  engine. `src/lib/server/` holds the credential and the browser only ever
  talks to SvelteKit.

## What the product does not support

These are real limits, not gaps in the example.

- **No negation, no OR, no ranges.** `filters[col]=value` is exact equality.
  There is no way to ask for "status is not closed", so the Active tab is two
  exact queries merged in `loadInbox`. The same limit rules out "opened in the
  last 7 days" and "priority is urgent or high" as server-side queries.
- **No sort parameter.** Every read comes back `created_at DESC`. A ticket
  thread reads oldest first, so the app reverses the page, and the queue orders
  by priority in memory.
- **No count and no aggregate.** Nothing returns a total, so every number on
  the inbox tabs is a full read of the rows behind it. A desk with real volume
  would keep its counters somewhere that can answer without one.
- **`PUT` replaces the body, it does not merge into it.** Changing one field
  means sending every field back. Sending `status` alone erases the message and
  the requester.
- **Slugs are unique per tenant, not per content type.** A ticket and a blog
  post cannot share a slug, and every example in this repo shares one engine.
  Everything the desk writes is prefixed `desk-` for that reason, and a random
  suffix keeps two tickets with the same subject apart.
- **No anonymous read.** The public form is public because SvelteKit serves it,
  not because the engine allows it. Every content route sits behind auth.
- **No per-user identity.** The credential belongs to the app, so the desk has
  no idea who is looking at it. The reply form asks who is replying because
  nothing else can tell it. Real deployments put their own sign-in in front and
  keep the engine credential server-side exactly as this app does.
- **Attachments need a proxy.** `desk_tickets.attachment_media_id` holds a media
  id, and the engine's download route requires a bearer token, so a browser
  pointed at it gets a 401 and a broken image. `/media/[id]` is the credential
  boundary. Upload with `POST /api/admin/media` and store the id it returns.
  The seed leaves the field empty.
- **Search is admin-only.** There is no `/api/v1/search`, so a search box has
  to be proxied. The blog example shows that path.

## Running it

From the repository root:

    make up        # boots postgres and the engine, creates the first admin
    pnpm install
    make setup     # provisions every example and seeds this one
    make dev-helpdesk

The desk is on http://localhost:5180.

`setup/provision.ts` is safe to run again. Applying a content type that already
exists is accepted, and the seed stops if the desk already has tickets. It seeds
12 tickets across the three statuses with 33 replies between them.
