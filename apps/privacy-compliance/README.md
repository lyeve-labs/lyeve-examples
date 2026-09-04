# Privacy compliance

A privacy desk: data-subject requests come in on a public form, an officer
verifies who sent them, and export, erasure and the masking rules run from the
officer view against the engine's own DSAR routes.

## Read this first

**An erasure is not reversible and the route is easier to fire than it looks.**
There are two of them, and they are different products:

| | `POST /api/admin/gdpr/erase` | `POST /api/v1/gdpr/erase` |
|---|---|---|
| Router | admin | public |
| Auth | super_admin | any authenticated caller |
| Subject | the `identifier` in the body | **always the caller** |
| Empty body | refused, 422 | **erases whoever holds the credential** |

The second route takes no identifier at all. It is legitimate self-service
erasure, and firing it once with a shared administrator token to see what the
response looks like anonymizes that account: address rewritten, password hash
blanked, roles emptied, token version bumped, every later request 401. This app
never calls it, and `setup/provision.ts` never calls either erase route.

The route this desk does use validates `identifier` as required, at least one
character and at most 320. That validation is the engine's, and this app does
not lean on it: the identifier is normalized and classified in
`src/lib/server/dsar.ts` before anything is sent.

**The identifier never comes from a form.** It is read from the stored request
record, which a human filed and another human read. The erase form carries a
typed confirmation and a checkbox, and no identifier field, so there is no
request shape that makes this desk erase an address of the caller's choosing.

**Five gates stand in front of one erasure**, all of them re-checked inside the
action rather than trusted from the page that rendered the button:

1. The identifier is non-empty, under 320 characters, and free of control
   characters.
2. It is an email address or an account id. A free-form string is refused,
   because some erasers match the identifier as a substring inside a JSON
   column and a short string reaches records belonging to somebody who never
   asked.
3. It is not the account this app authenticates with, compared case-folded
   both ways, because the engine folds the address half of its own query and a
   capitalized copy would otherwise walk straight past the check.
4. It does not resolve to an account holding `admin` or `super_admin`. Removing
   an operator is an account-lifecycle decision, not a data-subject request.
5. An export has already been run for that exact subject, matched by digest.
   Erasure with no idea what is about to go is how a desk discovers afterwards
   that it destroyed the wrong records.

## Run it

From the repository root, with the stack already up:

    make up          # once, boots postgres and the engine
    make install
    cd apps/privacy-compliance && pnpm run setup && pnpm dev

Then open http://localhost:5188.

Try, in order: `/requests` for the register, one request for the officer view,
**Run export** to see a real Art. 15 bundle, then the confirm step. The seeded
register includes a request naming the platform's own account, which the confirm
step refuses out loud, and one erasure request whose export has not been run,
where the fifth gate is what you see.

## What it demonstrates

**The DSAR routes, and how little they cover.** `POST /api/admin/gdpr/export`
fans one identifier out to every registered exporter and merges the result.
With every example's plugins licensed, five exporters are registered: the
engine's own `sys_users`, plus AI conversation transcripts, flow run records,
magic-link history and the email log. That is the whole bundle. **Content entries, uploaded media and the audit trail are not in it.**
Verified against the running engine: an export for the administrator's own
address returned `total_records: 1`, `plugins_queried: 5`,
`plugins_with_data: 1`, and the one record was the account row.

**Erasure reaches six times as much as export can show.** The engine logs its
own roster at boot, and on an install with every example's plugins loaded it read
`erasers=31` against those five exporters. The exact names move as plugins are added or
folded, so read the line on your own stack rather than a list copied here.
There is therefore data the product will delete on request and cannot
show you first, which is why the export-first gate in this app is a partial
preflight and not a complete one. That log line is worth knowing about: eraser
registration is a call a plugin author has to remember, nothing fails when they
forget, and a plugin missing from the fan-out looks exactly like a plugin that
matched nothing.

**The self-service export is the bundle you would expect, and it cannot be
pointed at anybody.** `POST /api/v1/gdpr/export` streams NDJSON for the caller
and nobody else. Verified: 848 lines for the administrator, 350 of them content
entries, 467 audit rows, 30 media records and one user row. Neither route is a
superset of the other. Answering an access request with the admin route alone
hands over an account row and calls it everything held.

**Masking happens after the handler has decided what to send.** The pii-mask
plugin rewrites every JSON response body on the admin router except four
prefixes, and the effects are visible from three pages of this app:

- `/masking` reads `GET /api/admin/pii/rules` and shows a rule whose own
  description came back masked. The plugin holds
  `Email addresses (user@domain.tld)`. The wire carries
  `Email addresses ([redacted-email])`. A rule that documents what it matches
  matches itself on the way out.
- `/audit` shows DSAR entries whose subject reads `[redacted-email]`. The
  identifier is stored in the row and masked on read, so the engine's own trail
  can prove an export happened and cannot always say whose data it was. An
  account id survives, because a UUID matches no rule.
- The same page shows IPv4 addresses masked and IPv6 loopback intact, because
  the rule is IPv4-only. The audit handler intends a super_admin to see full
  IPs and masks them only for lesser roles. The middleware overrides that
  decision after the fact, so the documented behavior is not what arrives.

The DSAR paths are on the exempt list, which is why the export on this desk
hands over real addresses. The exemption suppresses the rewrite and not the
record: an export still writes a PII access-log entry, which is the right way
round for the one route whose purpose is handing over personal data.

**Audit filter names, which fail silently when wrong.** `GET
/api/admin/audit-log` reads `actor`, `action`, `resource_type`, `resource_id`,
`from`, `to`, `tenant_id`, `limit` and `offset`, and ignores everything else. A
filter named `resource` or `type` returns the whole log and reads as a filter
that matched everything. Every one of them is exact equality, so "every
`gdpr.*` action" is not one request: `/audit` filters on
`resource_type=gdpr_dsar`, which both DSAR handlers file under, and the counters
on the front page are one request per action name.

**A digest instead of an address.** Every action this desk files records
SHA-256 of the identifier, first six bytes, hex. That is the engine's own
`subject_ref`, so a line in this register lines up with the engine's log lines
for the same run, and a register of erasures does not become the last place the
erased address survives. Completing an erasure also blanks the subject on the
request record, because the engine erasing its own tables does nothing about a
row this app wrote.

**Legal holds.** An erasure answers 200 with a `holds` array and zero rows when
an active hold covers the subject, and 503 when the hold checker cannot answer
at all. Both are rendered as what they are. Art. 17(3)(e) already carves out
processing needed to defend a legal claim, so deferring and saying so is the
lawful answer rather than a conflict between two obligations.

## What this does not do, and what the engine will not do

- **Zero rows is not proof.** An erasure that answers `total_rows: 0` means no
  registered eraser matched the identifier. It does not mean nothing was held.
  A held erasure also reports zero rows, which is why the holds array decides
  and not the count.
- **The masking rules are read-only.** There is no `POST`, `PUT` or `DELETE` on
  `/api/admin/pii/rules`: the six presets are compiled into the plugin in a
  fixed priority order and nothing on the HTTP surface adds one or turns one
  off. A masking policy here is a deploy, not a setting. The page says so
  rather than offering an editor that would 404 or 405.
- **The access log records no route and no value.** An entry names the viewer,
  their first role, the tenant and which rules matched. It says a super_admin
  was served eleven addresses at 12:35, not which addresses or from where. It
  also records nothing at all when the response carried no credential, so a
  pre-auth flow that leaks PII leaves no entry.
- **There is no lookup by address.** The engine offers `GET /api/admin/users`
  with `limit` and `offset` and nothing else, so the operator guard pages the
  listing and matches locally, capped at 1600 accounts. Past that cap it
  refuses the erasure rather than guessing, and says why. Not finding an
  account is deliberately not a refusal: an address with no account is the
  ordinary case for a comment author or a mail recipient, and those records are
  what Art. 17 is about.
- **A cross-tenant export has to be asked for and is refused here.** The body
  takes `all_tenants`, and on a single-tenant install the engine answers 400
  rather than sweeping one tenant and letting the bundle read as complete. This
  app never sends it. The same identifier can name different people in two
  tenants, so a merged bundle would be a breach rather than a complete answer.
- **The engine keeps no request record.** The DSAR routes act and answer and
  store nothing an operator could open tomorrow, so the register is this app's
  content types. Lose the app's data and the engine retains masked audit rows
  and nothing else.
- **Nothing verifies the audit chain.** Entries are hash-chained, so a deletion
  from the middle of the log is detectable in principle. No route exposes a
  verification and this app does not attempt one.
- **The audit total can be short.** Audit writes are asynchronous. The route
  drains its queue before counting and reports when it could not, which is the
  amber note above the table.
- **A UUID identifier is case-sensitive in a way that differs by dialect.** The
  engine compares the id half of a DSAR query as supplied against a text cast
  of the id column, and PostgreSQL renders that lower case where SQL Server
  renders it upper. This app folds to lower case, which is right for this stack.
- **No media route.** This desk stores no files. Identity evidence for a request
  stays out of the engine on purpose: it is the most sensitive document in the
  whole exchange and it is needed once.
- **The request register is itself personal data.** It holds the subject's
  address so the desk can answer them, and no retention rule prunes it. A real
  deployment would have one.

## Layout

    src/lib/desk.ts                     request types, states and the deadline rule
    src/lib/server/lyeve.ts             the client, and this app's schema names
    src/lib/server/dsar.ts              identifier classification, export, erase
    src/lib/server/operator.ts          who this app is, and the erase guard
    src/lib/server/requests.ts          the register, the officers, the action trail
    src/lib/server/masking.ts           masking rules and the PII access log
    src/lib/server/audit.ts             the engine's trail, filtered to DSAR
    src/routes/+page.server.ts          the desk overview
    src/routes/requests/                the register and one request, with the actions
    src/routes/request/                 the public form, which records and nothing else
    src/routes/masking/                 rules and access log
    src/routes/audit/                   DSAR audit trail
    setup/provision.ts                  content types and seed data

Content types: `privacy_officers`, `privacy_requests`, `privacy_actions`.

Nothing outside `src/lib/server/` and the `.server.ts` files ever touches the
engine. That matters more here than elsewhere: the credential this app holds is
a super_admin one, because the DSAR routes accept nothing less, and it can
anonymize an account.
