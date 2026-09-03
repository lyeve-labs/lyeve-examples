# Booking

A consultation booking site for a small clinic. Four practitioners, a week of
appointment times, and a form that turns one of those times into an appointment.

## Read this first: the engine has no booking primitives

There is no booking, availability, reservation, inventory or hold concept
anywhere in LyEve. Not in the engine, and not in any of the 51 plugins. Nothing
below this line is the product doing scheduling for you.

**The engine stores the data. The app models the domain. The engine offers no
transactional protection against double booking.**

Concretely:

- A slot is an ordinary content entry with a `state` field holding the text
  `open`, `held` or `booked`. The engine has no enum type and no check
  constraint on it, so any other string would be stored just as happily.
- Nothing expires a hold. There is no TTL on a content field and no scheduler
  that moves a custom field from one value to another, so a slot left in `held`
  stays there until something writes over it.
- Marking a slot booked and writing the appointment are two separate HTTP
  writes. There is no transaction spanning them, so the pair can half-succeed.
- Two people booking the same slot in the same moment can both succeed. The
  check the app makes is a check, not a lock. This is spelled out in full below.

Everything the app promises about the schedule is application code sitting in
this directory, and it is only as strong as a check-then-write can be.

## What the example proves

- **Scheduling can be modeled entirely in content types.** Practitioners,
  slots and appointments are three ordinary content types with two relations
  between them. Nothing here needed a plugin.
- **A write path that changes existing state.** Most examples only create.
  This one reads a slot, decides whether it may be sold, writes an appointment
  and rewrites the slot, through a SvelteKit form action.
- **The shape of the guarantee you actually get,** which is the interesting part
  and the reason this example exists.

## Engine features exercised

| Feature | Where |
|---|---|
| `POST /api/admin/schemas` with `datetime`, `number`, `email` and relation fields | `setup/provision.ts` |
| `belongsTo()` relations, both hops | slots to practitioners, appointments to slots |
| `POST /api/admin/content` for every write | `setup/provision.ts`, the booking action |
| `PUT /api/admin/content/{id}` to change an existing entry | `src/lib/server/booking.ts` |
| `GET /api/v1/content/{schema}` with `filters[practitioner_id]` | the practitioner page |
| `populate` to inflate a relation in one round trip | the confirmation page |
| `relationId()` / `related()` to read a relation back | `src/lib/server/booking.ts` |
| `limit` at the engine's 200 ceiling | `listSlots` |
| Media proxied through the app's own route | `src/routes/media/[id]/+server.ts` |

## The race, in detail

`src/routes/book/[slug]/+page.server.ts` does this:

1. Re-read the slot. The page may have been open for an hour.
2. Refuse if its state is not `open`.
3. Write the slot to `booked`.
4. Write the appointment.

Step 2 and step 3 are not atomic. Two requests can both complete step 1 while
the slot is open, both pass step 2, and both go on to sell the same hour. The
window is a couple of network round trips wide. It is small, and on a quiet
clinic diary you would likely never see it. It is still a bug, and calling it
anything else would be dishonest.

Three things that look like they would fix it, and do not:

- **`unique: true` on the appointment's slot relation.** A `belongs_to` field
  generates two columns: a dead one named after the field, which nothing ever
  writes, and the real `<field>_id` that the write path fills. `unique` builds
  its index on the field name, so the constraint lands on the dead column. That
  column is NULL in every row, and a unique index does not constrain NULLs.
- **`unique: true` on some composite of practitioner and time.** The engine
  indexes single columns. There is no multi-column unique field.
- **Checking harder, or checking twice.** Any number of reads before a write is
  still a read before a write.

### What a real system would need

One of these, none of which the engine exposes:

- **A database-level constraint.** A unique index on the appointment table's
  real FK column, so the second insert is rejected by Postgres rather than by
  application logic. The engine's schema API cannot ask for one, and the second
  writer would learn about the rejection as a 503, which it could not tell apart
  from the database being down.
- **A conditional update.** `UPDATE ... SET state = 'booked' WHERE id = $1 AND
  state = 'open'`, and treat zero rows affected as "somebody else got there
  first". There is no compare-and-set on the content API. `PUT` replaces the
  body unconditionally.
- **A transaction across both writes.** There is no way to open one over HTTP.
- **An application lock,** taken on the slot id before the check and released
  after the write. That means a lock service outside the engine, which is a
  fourth moving part to run and to reason about.

The honest summary: if double booking would cost you money or a court date, the
booking transaction does not belong in a CMS. Model the catalog here, and put
the commitment step behind something that can say no.

### The compensating write

If the appointment write fails after the slot is already marked booked, the
action puts the slot back to `open`. That is a compensating write, not a
rollback. If the process dies between the two calls, the slot stays booked with
no appointment against it, and only somebody looking at the data can tell.
The confirmation page shows a warning when an appointment's slot does not read
`booked`, which is the same class of drift seen from the other side.

## Content types

All three are prefixed `booking_` because every example in this repo shares one
engine, and so are all the slugs, because a slug is unique per tenant across
every content type rather than per type.

**`booking_practitioners`**: `title`, `slug`, `role`, `bio`, `photo_media_id`.

**`booking_slots`**: `title`, `slug`, `starts_at` (datetime), `duration_minutes`
(number), `state` (text), `practitioner` (belongs_to).

**`booking_appointments`**: `title`, `slug`, `customer_name`, `customer_email`,
`notes`, `slot` (belongs_to).

Every relation is declared with `belongsTo()`, which makes it optional. A
relation marked required generates a NOT NULL column that the write path never
fills, and every insert then fails with a 422. The app enforces its own
requirements instead.

## Other things the product does not do here

- **No anonymous read.** The engine has no public door, so the browser never
  talks to it. Every page renders from `+page.server.ts` and the credential
  stays in `src/lib/server/`.
- **No sort parameter.** Rows come back `created_at DESC` and nothing else, so
  the schedule is sorted by `starts_at` in the app after the fetch.
- **No range filter.** `filters[col]=value` is exact equality. "Upcoming only"
  is decided in the app over rows it already fetched, which is fine for a
  four-person clinic and would not be for a chain.
- **No aggregate.** "How many hours are free for each practitioner" is a count
  over fetched rows, not a query.
- **`limit` is clamped to 25..200.** Asking for 3 returns 25. A diary longer
  than 200 slots would have to page with `offset`.
- **No email.** Booking stores an appointment and shows a reference. Nothing is
  sent anywhere.
- **No timezone.** A `datetime` field is a TIMESTAMPTZ, an instant with no zone
  attached to it, so this example stores and renders everything in UTC. A real
  practice would carry its own zone on the practitioner and format against that.
- **No photos in the seed.** `photo_media_id` exists and renders through
  `/media/[id]` when set, because the engine's own download route needs a bearer
  token and 401s a browser. Upload an image through the admin UI and paste the
  id onto a practitioner to see it.

## Run it

From the repo root, with the local stack already up:

```bash
cp .env.example .env          # once, if you have not already
pnpm install
pnpm --filter @lyeve-examples/booking run setup
pnpm --filter @lyeve-examples/booking dev
```

Then open http://localhost:5177.

`setup` is safe to run again. Applying a content type that already exists is
accepted, and the seed stops early if the diary already holds slots. To reseed,
delete the `booking_slots` entries first.

The seed builds the schedule relative to the day you run it: the next five
weekdays, two times per practitioner per day, 40 slots in total, with a scatter
already booked or held. Run it once and come back a fortnight later and the
diary will be in the past, because nothing regenerates it.
