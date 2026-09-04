# Community forum

A discussion board: topics grouped by category, threaded replies, a public
submission path that anyone can use, and a moderation queue where a human
decides what becomes readable.

It is the example for the **schema plugin's comments preset**. The preset is a
starting point, not a feature: it creates two content types and nothing else,
so moderation, voting and the rule that a visitor's reply waits for a human
are this app's code. Seeing exactly where that line falls is the point.

## Read this before you trust it

- **There are no forum accounts.** Every reply is anonymous. The vote identity
  is a UUID this app puts in a cookie, stored as a free-text voter key, so
  clearing the cookie buys another vote. The engine has real accounts. They
  belong to the people who run the site, not to the readers.
- **No spam filter runs.** The preset has none. The flow plugin ships a
  `comment-moderation` template that asks an outside service for a verdict and
  writes it back. It needs the `flow-pro` capability and a service to ask, and
  this example sets up neither. Every reply here is held for a human.
- **Nothing joins a reply to a topic.** A reply names its topic in two text
  columns, `target_schema` and `target_id`, with no foreign key. Delete a
  topic and its replies stay behind, naming a record that is gone.
- **A closed topic is closed by this app only.** The engine has never heard of
  a topic, so a reply written straight to the content route is accepted.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/community-forum && pnpm run setup && pnpm dev

Then open http://localhost:5184. The moderation queue is at `/moderation` and
starts with three seeded replies waiting.

`pnpm run setup` applies the comments preset with
`POST /api/admin/schemas/presets/comments`. The preset refuses with a 409 when
either of its types already exists, and creates nothing in that case, so a
second run reports it as already applied.

## The model

    forum_topics    title, slug, body, category, author_name, pinned, locked
    comments        the preset: target_schema, target_id, parent (parent_id),
                    author_name, author_email, body, status
    comment_votes   the preset: comment (comment_id), voter_key, value

`forum_topics` is this app's own type. `category` is a plain text column: the
engine has no enum type and no grouping, so `src/lib/forum.ts` is the only
definition of a valid category and the grouping on the front page is done in
the app.

The two preset types are shared by every app on the engine. `comments` has no
column that says which app a reply belongs to, so this forum writes
`target_schema: forum_topics` on every reply and reads with that filter. The
target is the topic's entry id rather than its slug, so renaming a topic cannot
orphan its replies. `src/lib/server/comments.ts` owns that convention.

## What it exercises

- **Replies as content records.** A reply is written with
  `POST /api/admin/content` like any other record, and read back with
  `GET /api/v1/content/comments` and three exact-equality filters:
  `target_schema`, `target_id` and `status`. That is a thread read, and the
  same read with `status=pending` is the moderation queue. Because a reply is a
  content record, search and the admin UI see it too.
- **A status the app owns.** `status` is required and limited to `pending`,
  `approved`, `spam` and `rejected` by an enum rule, so anything else is a 422.
  The preset declares `pending` as the default, but a write that leaves the
  field out is refused as missing rather than defaulted, so every write names
  it. A visitor's reply is always written `pending`, and nothing from the form
  reaches that field.
- **Moderation as a rewrite.** Approve, spam and reject each write one status
  with `PUT /api/admin/content/{id}`. That route replaces the record's body
  rather than merging into it, so the write carries every required field again.
- **Voting as one record per voter.** A vote is a `comment_votes` record. The
  preset has no unique index on the pair, so `vote` looks for the visitor's
  earlier vote on the comment and rewrites it, and a vote slug names the pair,
  so voting twice replaces rather than accumulates. A score is the sum of the
  vote records, read in one pass.
- **Threading the client has to build.** A thread read is a flat list, newest
  first like every content list. The app puts it oldest first and
  `buildThreadTree` in `src/lib/forum.ts` assembles the tree. Most of that
  function is defense rather than assembly: see below.
- **Two relation names for one column.** A relation is written by its field
  name, `parent`, and read back as `parent_id`. The same holds for a vote's
  `comment`.

## What the engine does not do

**No count and no group-by.** A per-topic reply count means reading the forum's
replies and grouping them in memory, which is what the front page does in one
pass. A board with real volume would keep counters somewhere that can answer
without it.

**Lists clamp to 25..200 and carry no total.** Every read pages 200 at a time
until a short page comes back.

**The admin list ignores filters.** `GET /api/admin/content?schema=comments`
takes `filters[...]` and returns every record anyway, so every filtered read
here goes through the public read route with this app's credential.

**`parent` proves less than it looks.** It is a relation with a foreign key, so
a parent is always a real comment. Nothing checks that it is in the same
thread, and nothing stops an edit from making a reply its own ancestor. Two
shapes therefore have to be handled rather than trusted: a parent that is not
in the list at all, which happens whenever a reply's parent is still pending,
and a cycle, which would make a naive walk not terminate. The tree builder
treats both as top-level and flags the first. The form action also checks that
a submitted parent is in this thread before passing it on.

**Nothing renders markdown.** The content engine stores text and strips
dangerous markup from any string holding a `<`, so an `img` tag carrying an
`onerror` attribute is stored without the attribute. This app renders the body as text, split into
paragraphs, and never with `{@html}`.

**A seeded reply and a visitor's reply have the same author.** Every record is
written with this app's credential, so the engine records its administrator
as the author of every reply, and `author_name` is what the person typed.

**Addresses are masked on the way out when PII masking is on.** The local stack
licenses the PII masking plugin, which rewrites every email address in a JSON
response to `[redacted-email]`, the moderation queue included. The address is
stored as typed. That is also why a moderation write leaves `author_email` out:
the masked value would fail the email field, and a field left out of the write
keeps what its column holds.

**Deleting is not modeled.** `spam` and `rejected` both keep a reply out of
every thread and differ only in the value stored. Nothing removes either.
`DELETE /api/admin/content/{id}` would, and this app does not call it.

## Layout

    src/lib/forum.ts               categories, the tree builder, formatting
    src/lib/server/lyeve.ts        the client and the schema name
    src/lib/server/comments.ts     replies, votes and moderation, and the target convention
    src/lib/server/topics.ts       topics as content
    src/lib/server/visitor.ts      the cookie that stands in for a voter
    src/routes/+page.server.ts     the board, grouped and counted in the app
    src/routes/topics/[slug]/      one topic, its tree, the reply and vote actions
    src/routes/new/                start a topic
    src/routes/moderation/         the queue, and the three decisions
    setup/provision.ts             the content type, the preset, five topics, thirteen replies

Nothing outside `src/lib/server/` and the `.server.ts` files touches the engine,
and the browser never holds a credential.
