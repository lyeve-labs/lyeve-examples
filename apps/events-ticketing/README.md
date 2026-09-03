# events-ticketing

An events site with registration. Six sessions, each with a room that holds a
fixed number of people, a running count of places taken, and a form that takes
one more place until the room is full.

**LyEve has no ticketing and no inventory.** There is no seat, no ticket, no
hold and no counter anywhere in the product. Everything this example calls
capacity is application state, and the section at the bottom lists exactly which
guarantees the app is on the hook for. Read it before lifting any of this.

Run it from the repo root:

```bash
make up                        # build and boot the engine, once
make install                   # dependencies for every example
make setup                     # provision and seed every example
make dev-events-ticketing      # http://localhost:5181
```

To seed this example on its own, with the stack already up:

```bash
set -a; . ./.env; set +a
cd apps/events-ticketing && node --experimental-strip-types setup/provision.ts
```

## What this example proves

**Capacity is a modeling exercise, not a product feature.** LyEve stores
content. It has no ticket, no seat, no hold, no inventory and no counter. This
site has all of those things because it computed them: `capacity` and
`registered` are two number fields on a content entry, `remaining` is a
subtraction the server does on the way to the page, and "sold out" is an `if`
in `src/lib/server/events.ts`. Nothing below the app knows those three fields
are related.

**The engine cannot sort, so the app does.** Content comes back `created_at
DESC` and there is no `sort` parameter to ask for anything else. An events site
needs the opposite order, by a field that is not `created_at`, so the upcoming
list reads a page, drops anything that has already started, and sorts by
`starts_at` in `listUpcomingEvents`. That works because one page holds every
event here. Past 200 events it stops working, and the fix is to read every page
before ordering any of it.

**Two writes, no transaction.** Registering does two things: it creates a
registration entry, then it writes the event back with the count raised by one.
There is no way to make those one operation, and no way to make the second one
conditional on the value the first one read.

## Engine features exercised

| Feature | Where |
|---|---|
| Schema apply, ordered so the relation target exists first | `setup/provision.ts` |
| Field types `text`, `datetime`, `number`, `email` | `setup/provision.ts` |
| `belongsTo` relation, declared optional because a required one breaks every insert | `setup/provision.ts` |
| Admin content write (`createContent`) for seed and for every registration | `setup/provision.ts`, `src/lib/server/events.ts` |
| Admin content update (`PUT /api/admin/content/{id}`) to move the counter | `src/lib/server/events.ts` |
| Public v1 reads with `limit`, `filters[]` and `populate` | `src/lib/server/events.ts` |
| Reading a relation as `<field>_id` with `relationId`, and populated with `related` | `src/lib/server/events.ts` |
| Server-proxied media bytes | `src/routes/media/[id]/+server.ts` |

Every one of those calls happens in `+page.server.ts`, a form action, or
`src/lib/server/`. The engine has no anonymous read, so the browser never sees
it and never holds a credential.

## What the product does not support

Read this section before lifting any of this into something that sells tickets.

- **No inventory primitive.** There is no seat, no ticket type, no hold, no
  waiting list and no expiry. A place is arithmetic this app does on a number
  field, and a place taken is that number written back one higher.
- **The increment is a read-modify-write and it is not atomic.** Two requests
  can read `registered: 57`, both add one, and both write 58. The room is then
  one person over. The engine offers no increment operation, no
  compare-and-set, and no conditional update, so there is no version of this
  code that closes the hole. Serializing registrations behind a lock the app
  owns, or keeping the counter in a database the app controls, are the two real
  answers. The same limit applies to any booking or stock example.
- **The registration and the count are separate writes.** Nothing joins them.
  This app writes the registration first so a failure loses a place from the
  count rather than losing the attendee, and the event page says so when the
  count falls behind the rows recorded against it.
- **No constraint can express the rule.** A content type cannot say `registered
  <= capacity`, cannot make `(event, email)` unique, and will accept a
  registration for an event that finished last year. All three refusals are
  code in `register()`, and all three are advisory: anything else writing to the
  same content type, the admin UI included, bypasses them.
- **The duplicate check is racy too.** It reads, then writes. Two submissions
  of the same address at the same moment both see no match.
- **No range or comparison filters.** `filters[col]=value` is exact equality.
  "Events after today" is not expressible, so the cut happens in the app.
- **No aggregate on the read API.** `/api/v1` answers with a bare JSON array:
  no total, no has_more, no count endpoint. The number of registrations for an
  event is the length of a page of rows, and a page holds at most 200.
- **A number field comes back typed by the dialect.** Postgres renders `NUMERIC`
  as a JSON number and other engines can hand back a string, so the app
  normalizes before doing arithmetic.
- **An `email` field validates at the database, and that write is best-effort.**
  The admin write stores the entry, then projects it into the generated table.
  A format rejection kills the projection and not the entry, which leaves a
  registration that no read can see and no error to explain it. The address is
  validated in the app instead.
- **The seed has no images.** `cover_media_id` is wired end to end and the
  `/media/[id]` route serves whatever id an event carries, but nothing is
  uploaded, so the cards render without art.
- **The door list is public because this example has no accounts.** Attendee
  names are shown to anyone who opens the page. That is a choice made here, not
  a permission the engine granted.

## Layout

```
setup/provision.ts               content types, six events, six registrations
src/lib/format.ts                date and capacity strings, built on the server
src/lib/server/lyeve.ts          the client and this app's schema names
src/lib/server/events.ts         capacity, registration, and the unsafe increment
src/routes/+page.server.ts       upcoming list, sorted and filtered in the app
src/routes/events/[slug]/        event page and the registration action
src/routes/registrations/        door list, relation populated in one request
src/routes/media/[id]/           media bytes, proxied with the server credential
```
