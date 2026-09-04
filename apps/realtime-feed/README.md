# Realtime feed

A live incident board. The page is server-rendered in full, then kept current by
one `EventSource` pointed at this app, which holds one upstream connection per
watched content type to the engine's server-sent events stream.

## Read this first

**The stream is a hint, never the record.** The engine buffers sixteen events
per connection and silently drops anything that does not fit, and its stream
carries no event id, so there is nothing to replay from after a gap. Every event
here arrives as an overlay on top of a fully loaded board, and the page refetches
the whole board every thirty seconds and on every reconnect. A board assembled
only out of events would be wrong and would have no way to find out.

**It is live on one engine process only.** The stream handler registers hooks on
an in-process bus. Lifecycle events are published outward to the message bus,
but nothing subscribes the bus back into that registry, so a stream held by one
engine instance never hears a write served by another. Behind two instances and
a load balancer this board would go quiet for half the writes, and the thirty
second refetch would be doing all the work. Nothing in the response says so.

**One browser costs two upstream connections.** The engine's stream is per
content type, and this board watches incidents and their updates. Ten open tabs
are twenty engine connections, twenty goroutines and sixty registered hooks. A
real deployment would run one upstream per content type for the whole process
and fan out internally. This example keeps the naive shape because the cost is
the thing worth seeing.

**Opening an incident is two writes and nothing makes them atomic.** The
incident and its first timeline entry are separate content records. There is no
transaction a caller can hold across two content writes, so a failure between
them leaves an incident with an empty timeline. The board renders that state
rather than pretending it cannot happen.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/realtime-feed && pnpm run setup && pnpm dev

Then open http://localhost:5186, open http://localhost:5186/ops in a second
window, and open an incident. The board moves without being reloaded.

## Which write path fires the stream

This was the open question the example was written to settle, and it was settled
by probe rather than by reading. A throwaway content type was created, its
stream opened on the public router, and one entry written through each path.

**Both paths fire it.** The events arrive on the same stream, in write order,
with no configuration involved.

    POST /api/admin/content        -> data: {"event":"after_create","schema":"status_probe_...",
                                            "data":{"id":...,"slug":...,"title":"Admin write probe",
                                                    "status":"published","created_at":...,
                                                    "body":{"note":"written through the admin router",...}}}

    POST /api/v1/content/{schema}  -> data: {"event":"after_create","schema":"status_probe_...",
                                            "data":{"id":...,"slug":...,"title":"Public write probe",
                                                    "note":"written through the v1 router"}}

**The payloads are not the same shape, and that is the part that bites.** The
admin write publishes the whole `sys_content_entries` row, so the schema's own
fields are nested under `body` alongside an envelope of `id`, `slug`, `title`,
`status`, `created_at` and the rest. The public write publishes the generated
table row, so the same fields are at the top level and there is no envelope and
no timestamps at all. `src/lib/server/stream.ts` merges the nested object over
the top-level one, which reads both.

Two consequences worth carrying into your own schema design:

- **Do not name a field `status`.** The entry envelope already has one, holding
  `draft` or `published`, and on every admin write it lands next to yours. The
  field that carries `investigating`, `identified`, `monitoring` and `resolved`
  on this board is called `state` for exactly that reason. The same applies to
  `title`, `slug`, `meta` and `created_at`, though those at least mean the same
  thing in both places.
- **A relation on the stream is under the name you wrote, not `<field>_id`.** A
  read returns `service_id`. The admin write path publishes the JSON body the
  writer sent, where the relation is a bare id under `service`. `relationId()`
  from the shared client handles the read shape, so this app wraps it with a
  fallback to the written form rather than pretending one function covers both.

So the app writes everything through `POST /api/admin/content`, as every example
in this repository does, and loses nothing by it. There is no case here where
durability and search have to be traded against the live signal.

## Which stream, and why

The engine offers two, and they are not interchangeable.

**`GET /api/v1/content/{schema}/stream`, which this app uses.** It carries the
record. A create arrives with the fields in it, so the board can apply the change
without asking the engine anything, and a reader watching the page sees the
incident appear at the moment it is opened rather than at the next refetch. The
cost is that it is scoped to one content type, so watching two types means two
connections.

**`GET /api/v1/realtime/events`, from the realtime plugin, which this app does
not use.** One connection covers every content type, and it does the things the
content stream does not: an `id:` on every frame, `Last-Event-ID` replay on
reconnect, a heartbeat every thirty seconds, and topic filtering with `?topic=`.
Three things ruled it out here:

1. **The payload is a notification, not a record.** It is
   `{"schema":...,"action":"create","record_id":""}` and nothing else, so every
   event means a full refetch anyway. Watching the same probe write, that is
   exactly what arrived, on the per-tenant catch-all topic.
2. **`record_id` is always empty.** The bridge that feeds the plugin reads
   `RecordID` off the event, and the internal event the engine publishes has no
   such field for the adapter to copy, so the one identifier that would let a
   client refetch a single row is blank on every event. Verified on the probe
   write, not inferred.
3. **It rejects a request with no `Origin` header.** That is correct for a
   browser endpoint and defends against cross-site stream hijacking, but a
   server-side fetch does not send one, so a backend-for-frontend has to
   synthesize a browser-shaped `Origin` to use the route at all. Faking a
   security header to get past it is not a pattern worth demonstrating.

The plugin's presence routes are also unused, and could not work here. Presence
is keyed on the authenticated user id, and every browser's upstream connection
is opened with this app's single service credential, so presence would report
one user online no matter how many people had the board open. Presence needs
per-user engine identity, which a backend-for-frontend deliberately does not
give the browser.

## What this app adds that the engine does not

The engine's stream is deliberately thin. `src/routes/live/+server.ts` is where
the missing parts live:

| Missing upstream | What `/live` does |
|---|---|
| No heartbeat between events | Sends `: ping` every fifteen seconds, so an idle board is distinguishable from a dead socket |
| No `retry:` field | Sends `retry: 3000`, so a reconnect is predictable rather than left to the browser default |
| No event id, no replay | Sends `resync` every thirty seconds, and the page refetches the board |
| No signal when the upstream dies | Sends `stalled` and closes, so the browser reconnects and gets fresh upstreams |
| Buffered by nginx by default | Sets `x-accel-buffering: no` |

The one thing it must get right is teardown. The engine registers its hooks per
request and unregisters them when the request context ends, so an upstream
connection nobody cancels is a leaked subscription and a leaked goroutine that
lasts as long as the process. When the browser goes away SvelteKit cancels the
response stream, and `/live` cancels the upstream body, which destroys the
socket, which ends the engine's request. That chain is the whole reason the route
keeps a handle rather than a fire-and-forget fetch.

## Layout

    src/lib/board.ts               vocabulary, board shapes and the overlay fold
    src/lib/server/lyeve.ts        the client, this app's schema names, the watched list
    src/lib/server/board.ts        every read and write
    src/lib/server/stream.ts       upstream stream, decoded and mapped
    src/routes/+page.server.ts     the whole board, in three reads
    src/routes/+page.svelte        the board, plus the EventSource that keeps it live
    src/routes/live/+server.ts     the credential boundary for the stream
    src/routes/ops/                open, update and resolve an incident
    setup/provision.ts             content types and seed data

Nothing outside `src/lib/server/` and the `.server.ts` files touches the engine.
The browser has no engine credential and never opens an engine connection, the
live stream included.

## What the engine does not do

- **No sorting and no filtering by anything but exact equality.** Every count and
  every ordering on this board is computed after a full read. `filters[state]=`
  narrows by state, but "everything not resolved" cannot be asked for, so the
  board reads all incidents and splits them here.
- **No aggregate.** A service's color is the worst severity among its open
  incidents, computed in the page. Nothing below the app knows that an
  unresolved critical incident should turn a service red.
- **No total on a list.** The response is a bare array, so a short page is the
  only signal that the data ended.
- **No required relation.** An incident with no service is a shape the database
  accepts, because declaring the relation required makes every insert fail. The
  board treats an unattached incident as belonging to no service and shows it in
  the incident list regardless.
- **No delete on this board.** A delete arriving on the stream cannot be folded
  into an overlay keyed by id, so `/live` turns it into a `resync` and lets the
  refetch handle it.
