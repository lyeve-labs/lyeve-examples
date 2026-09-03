# Writing a new example

Every app follows the blog. Read `apps/blog/` before writing anything, because it is
the reference implementation, and it is known to build, provision and serve.

## Shape

    apps/<name>/
      package.json          copy blog's, change name + dev port
      svelte.config.js      copy verbatim
      vite.config.ts        copy verbatim
      tsconfig.json         copy verbatim
      .env.example          copy verbatim
      src/app.html          copy verbatim
      src/app.css           copy verbatim  (the @source line is load-bearing)
      src/lib/server/lyeve.ts   client singleton + this app's schema names
      src/routes/...          pages, server loads only
      setup/provision.ts    schemas + seed, idempotent
      README.md             what this example proves, and how to run it

## Rules that are not negotiable

1. **Never call the engine from a component script or a `+page.ts`.** The
   credential is server-side. Data comes from `+page.server.ts`, `+server.ts` or
   a form action. `src/lib/server/` is the only place the client is constructed.
2. **Every relation is declared with `belongsTo()`**, which is optional by
   design. A required relation makes every insert fail. Enforce the requirement
   in the app.
3. **Write content with `createContent`**, never the public v1 write route, or
   the content is invisible to search and to the admin UI.
4. **Read relations with `relationId()` / `related()`**, never `data.author`
   directly, because an unpopulated relation reads back under `<field>_id`.
5. **Schema names are prefixed per app** (`blog_posts`, `shop_products`) because
   every example shares one engine. **Slugs need the same care for a different
   reason:** `sys_content_entries` is `UNIQUE (slug, tenant_id)` with no schema
   in the index, so one app's `about` blocks every other app's, and the refusal
   is a 409 that names no field. Check for a collision across every app's
   provisioning script before adding a common word as a slug.
6. **Images go through the app's own `/media/[id]` route.** The engine's
   download route needs a token and 401s a browser.
7. `provision.ts` must be safe to run twice.
8. Svelte 5 runes only: `$props`, `$state`, `$derived`. No `export let`, no
   legacy stores.
9. No em dashes, no emoji, no AI-tells in prose or comments. Comments explain
   why, not what.

## Ports

Each app takes its own dev port, assigned in `package.json`, starting at 5173
for the blog and incrementing.
