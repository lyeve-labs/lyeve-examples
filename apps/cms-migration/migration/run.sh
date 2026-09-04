#!/usr/bin/env bash
# Migrate the legacy exports in this directory into LyEve with the real CLI.
#
#   migration/run.sh
#
# Three CLI invocations, in this order, because the tool cannot do it in one:
#
#   1. a dry run over all three exports, saved as the report
#   2. a live migration of the authors and the pages
#   3. a live migration of the posts, after their bylines have been resolved
#      from legacy keys into the ids the engine minted in step 2
#
# Everything runs through a single-origin proxy. See single-origin-proxy.mjs for
# why: the tool builds one client, and no one listener serves both the admin
# routes it authenticates against and the content route it writes to.
#
# Re-running is safe. Each stage keeps its own checkpoint and is invoked with
# --resume, so a row already migrated is filtered out before the write.
set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG="$APP/migration"
REPORTS="$MIG/reports"
BIN="$MIG/.bin"
CLI_DIR="${LYEVE_CLI_DIR:-$APP/../../../lyeve-cli}"

: "${LYEVE_ADMIN_URL:?set LYEVE_ADMIN_URL; copy .env.example to .env and source it}"
: "${LYEVE_API_URL:?set LYEVE_API_URL}"
: "${LYEVE_EMAIL:?set LYEVE_EMAIL}"
: "${LYEVE_PASSWORD:?set LYEVE_PASSWORD}"

step() { printf '\n\033[36m==\033[0m %s\n' "$1"; }
die() { printf '\033[31mfailed:\033[0m %s\n' "$1" >&2; exit 1; }

command -v go >/dev/null || die "go is not installed; the migration tool is a Go program"
[ -f "$CLI_DIR/go.mod" ] || die "no CLI checkout at $CLI_DIR; set LYEVE_CLI_DIR"

mkdir -p "$REPORTS" "$BIN"

step "building the CLI from $CLI_DIR"
# GOWORK=off so the CLI checkout builds on its own rather than joining any
# go.work file that happens to sit above it.
( cd "$CLI_DIR" && GOWORK=off go build -o "$BIN/lyevectl" . ) || die "could not build the CLI"
CLI="$BIN/lyevectl"

step "starting the single-origin proxy"
# The proxy picks its own port and reports it, because a development machine
# often has other servers running and a hard-coded port is a collision waiting
# to happen.
PORT_FILE="$REPORTS/proxy.port"
: > "$PORT_FILE"
PROXY_PORT_FILE="$PORT_FILE" node "$MIG/single-origin-proxy.mjs" > "$REPORTS/proxy.log" 2>&1 &
PROXY_PID=$!
trap 'kill "$PROXY_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  [ -s "$PORT_FILE" ] && break
  sleep 0.25
done
[ -s "$PORT_FILE" ] || die "proxy did not bind a port; see $REPORTS/proxy.log"
PROXY_URL="http://127.0.0.1:$(cat "$PORT_FILE")"
printf '  %s\n' "$PROXY_URL"

for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "$PROXY_URL/readyz" 2>/dev/null; then break; fi
  sleep 0.25
done
curl -fsS -o /dev/null "$PROXY_URL/readyz" 2>/dev/null \
  || die "the engine answered $PROXY_URL/readyz with something other than 200; check that make up has run and that the database is up"

STAGES_JSON=""
RUN_STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# run_stage <name> <label> <report-file> <log-file> <csv-paths> [extra flags...]
run_stage() {
  local name="$1" label="$2" report="$3" log="$4" paths="$5"; shift 5
  local work="$REPORTS/checkpoints/$name"
  mkdir -p "$work"

  local started exit_code=0
  started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  step "$label"
  # The tool ignores --checkpoint and always writes cmsctl_migrate_csv_checkpoint.json
  # into its working directory, so each stage is given a directory of its own.
  (
    cd "$work"
    "$CLI" migrate data from-csv \
      --csv-paths "$paths" \
      --mappings "$MIG/mappings.json" \
      --admin-url "$PROXY_URL" \
      --api-url "$PROXY_URL" \
      --email "$LYEVE_EMAIL" \
      --password "$LYEVE_PASSWORD" \
      "$@"
  ) > "$REPORTS/$report" 2> "$REPORTS/$log" || exit_code=$?

  cat "$REPORTS/$report"
  tail -n 4 "$REPORTS/$log" || true

  # The checkpoint is copied rather than moved: --resume on the next run looks
  # for it back in the stage directory, under the name the tool chose.
  local checkpoint=""
  if [ -f "$work/cmsctl_migrate_csv_checkpoint.json" ]; then
    cp "$work/cmsctl_migrate_csv_checkpoint.json" "$REPORTS/checkpoint-$name.json"
    checkpoint="checkpoint-$name.json"
  fi

  # Shown on the report page, so the absolute paths are trimmed back to the
  # repository and the credentials are left out.
  local cmdline="lyevectl migrate data from-csv --csv-paths ${paths//$MIG\//} --mappings mappings.json --admin-url $PROXY_URL $*"
  STAGES_JSON="$STAGES_JSON${STAGES_JSON:+,}{\"name\":\"$name\",\"label\":\"$label\",\"command\":\"$cmdline\",\"exit_code\":$exit_code,\"report_file\":\"$report\",\"log_file\":\"$log\",\"checkpoint_file\":\"$checkpoint\",\"started_at\":\"$started\",\"finished_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

  [ "$exit_code" -eq 0 ] || die "$label exited $exit_code; see $REPORTS/$log"
}

ALL_PATHS="legacy_authors=$MIG/authors.csv,legacy_posts=$MIG/posts.csv,legacy_pages=$MIG/pages.csv"

run_stage dry-run "dry run over all three exports" \
  dry-run.txt dry-run.log "$ALL_PATHS" --dry-run

run_stage authors-and-pages "migrating the authors and the pages" \
  migrate-authors-and-pages.txt migrate-authors-and-pages.log \
  "legacy_authors=$MIG/authors.csv,legacy_pages=$MIG/pages.csv" --resume --batch-size 25

step "resolving bylines from legacy keys into engine ids"
( cd "$APP" && node --experimental-strip-types migration/resolve-relations.ts )

run_stage posts "migrating the posts, with resolved bylines" \
  migrate-posts.txt migrate-posts.log \
  "legacy_posts=$MIG/posts.resolved.csv" --resume --batch-size 25

CLI_VERSION="$( ( cd "$CLI_DIR" && git rev-parse --short HEAD 2>/dev/null ) || echo unknown )"

cat > "$REPORTS/run.json" <<JSON
{
  "engine_admin_url": "$LYEVE_ADMIN_URL",
  "engine_api_url": "$LYEVE_API_URL",
  "proxy_url": "$PROXY_URL",
  "cli_version": "$CLI_VERSION",
  "started_at": "$RUN_STARTED",
  "finished_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "stages": [$STAGES_JSON]
}
JSON

step "done; reports in migration/reports"
