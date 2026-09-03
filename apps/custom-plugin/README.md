# Custom plugin: a reading list

Every other example here builds *on* LyEve. This one extends it.

It adds a per-user reading list: three authenticated endpoints that let someone
save a content entry with a note, list what they have saved, and remove one. It
is deliberately the smallest plugin that still touches every part of the
contract, so it works as a template for a real one.

## What it demonstrates

| Part | File | Why it is there |
|------|------|-----------------|
| Registration | `plugin/init.go` | `core.RegisterPlugin` in `init()` is how the engine discovers a plugin. |
| Lifecycle | `plugin/plugin.go` | `Start` receives the host, runs migrations, builds the handler. `Stop` releases anything long-lived. |
| Routing | `plugin/plugin.go` | `Routes()` returns declarations rather than touching a router, so the engine decides where they mount. |
| Persistence | `plugin/store.go` | Queries go through `host.Querier(ctx)`. The raw `*sql.DB` is for migrations only. |
| Migrations | `migrations/` | One `.up.sql` and `.down.sql` per dialect, embedded and applied by `core.PluginMigrate`. |
| HTTP | `plugin/handler.go` | Decode, validate, call the store, map failures onto status codes. |
| Tenant cleanup | `plugin/plugin.go` | `RegisterTenantPurgeHandler` and `RegisterCoveredTable`, so deleting a tenant takes this data with it. |
| Tests | `plugin/types_test.go` | Table-driven tests for the pure validation logic. |

## The parts that are easy to get wrong

**Tenant isolation is a column, not a schema.** `sys_*` tables live in the
default schema and are not copied per tenant, so the `search_path` or `USE` that
scopes a connection isolates nothing here. Every query in `store.go` carries
`tenant_id = $1` explicitly. Drop that predicate and the plugin reads across
tenants while every test still passes.

**Ownership is checked in the query, not after it.** `Delete` filters on
`user_id` as well as `id`, so a caller cannot remove someone else's row by
guessing a UUID. Fetching first and comparing in Go would be a race.

**Errors do not leak.** The store wraps with `%w` and keeps the driver text for
the log. The handler answers with a fixed human-readable string. A database
failure is a `503`, not a `500`, because the caller can retry it.

**`Exec` returns a `CommandTag`, and `QueryRow` returns `(Row, error)`.** Both
differ from `database/sql`, and both are easy to write out of habit.

**Three dialects, one behavior.** `TIMESTAMPTZ` is `DATETIME(6)` on MySQL and
`DATETIME2(7)` on SQL Server, an indexed `TEXT` has to become `VARCHAR(255)`, and
SQL Server has no `IF NOT EXISTS` for indexes so `sys.indexes` is checked instead.

## Build it

    make verify        # build, vet, test

The module resolves the engine through a `replace` pointing at a `lyeve-core`
checkout beside this repository, and the Makefile sets `GOWORK=off` so it builds
standalone rather than joining any `go.work` file above it. If your checkout
lives elsewhere, repoint the replace:

    go mod edit -replace github.com/lyeve-labs/lyeve-core=/path/to/lyeve-core

## Run it inside the engine

A plugin reaches the binary by being blank-imported from `cmd/lyeve`. To try
this one, add the module to the engine's `go.work` and import it:

    // cmd/lyeve/main.go
    _ "github.com/lyeve-labs/lyeve-examples/custom-plugin/plugin"

Then rebuild the engine. The routes appear at `/api/v1/reading-list`, and the
migration runs on the next boot.
