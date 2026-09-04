#!/usr/bin/env bash
# Choose what to measure, rather than measuring everything.
#
#   perf/bench.sh list                 what can be measured, and what each one means
#   perf/bench.sh app <name>           one example's pages
#   perf/bench.sh engine <name>        the engine behind one example
#   perf/bench.sh profile <id>         one benchmark profile, seeded and driven
#
#   RATE=100 DURATION=60s perf/bench.sh app blog
#
# The three layers answer different questions and are not comparable with each
# other. `app` is what a visitor waits for, `engine` is what the engine
# contributes to that, and `profile` is the cross-platform workload the
# benchmark repository publishes.
. "$(dirname "${BASH_SOURCE[0]}")/../platform/scripts/lib.sh"

PERF="$REPO/perf"
BENCHMARKS="${LYEVE_BENCHMARKS:-$REPO/../benchmarks}"
PROFILES="$BENCHMARKS/profiles/profiles.json"

# One URL in front of the engine's two listeners, which is what the benchmark
# harness expects of every target it compares.
PROXY_PORT="${LYEVE_PROXY_PORT:-4499}"

list() {
  printf '\033[1mExample apps\033[0m  perf/bench.sh app <name>   the pages a visitor waits for\n'
  printf '             \033[0m  perf/bench.sh engine <name>  the engine behind those pages\n\n'
  node -e '
    const d = require(process.argv[1]);
    for (const a of d.apps) {
      const types = a.schemas.length ? a.schemas.join(", ") : "no content types";
      console.log(`  ${a.name.padEnd(22)} :${a.port}  ${String(a.paths.length).padStart(2)} paths  ${types}`);
    }
  ' "$PERF/apps.json"

  if [ -f "$PROFILES" ]; then
    printf '\n\033[1mBenchmark profiles\033[0m  perf/bench.sh profile <id>   a complete workload, seeded then driven\n\n'
    node -e '
      const d = require(process.argv[1]);
      for (const p of d.profiles) {
        const rows = Object.values(p.seed).reduce((a, b) => a + b, 0);
        console.log(`  ${p.id.padEnd(14)} ${String(rows).padStart(5)} rows  ${p.rate}/s  ${p.tagline}`);
      }
    ' "$PROFILES"
  else
    printf '\n\033[33m!!\033[0m no benchmark profiles: %s not found (set LYEVE_BENCHMARKS)\n' "$PROFILES"
  fi
}

# ── one profile: proxy, seed, drive ──────────────────────────────────────────
#
# A profile seeds its own content types at benchmark volume. That is thousands
# of rows, and it is why this runs against a throwaway database rather than the
# one the examples are serving from.
run_profile() {
  local id="$1"
  [ -f "$PROFILES" ] || die "no profiles at $PROFILES; set LYEVE_BENCHMARKS to the benchmark checkout"
  node -e '
    const d = require(process.argv[1]);
    if (!d.profiles.some((p) => p.id === process.argv[2])) process.exit(3);
  ' "$PROFILES" "$id" || die "unknown profile '$id'; run: perf/bench.sh list"

  local db="${LYEVE_BENCH_DB:-lyeve_bench_$id}"
  say "profile $id against a throwaway database ($db)"

  docker exec "$PG_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS $db;" >/dev/null 2>&1
  docker exec "$PG_CONTAINER" psql -U postgres -c "CREATE DATABASE $db;" >/dev/null \
    || die "could not create $db"

  bash "$PERF/bench-stack.sh" up "$db" || die "the throwaway stack did not come up"

  say "seeding"
  ( cd "$BENCHMARKS/harness/seed" && BASE_URL="http://localhost:$PROXY_PORT" PROFILE="$id" \
      node seed-profile.mjs ) || { bash "$PERF/bench-stack.sh" down; die "seeding failed"; }

  say "driving"
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -v "$BENCHMARKS:/repo" -w /repo/harness/k6 grafana/k6:latest run \
    -e "PROFILE=$id" -e "BASE_URL=http://localhost:$PROXY_PORT" -e FULL=1 \
    -e ADMIN_EMAIL=admin@lyeve.com -e ADMIN_PASSWORD=benchmark-Passw0rd! \
    ${DURATION:+-e "DURATION=$DURATION"} profile.js
  local status=$?

  bash "$PERF/bench-stack.sh" down
  [ $status -eq 0 ] || die "the profile run reported a failure"
  ok "profile $id complete"
}

case "${1:-list}" in
  list)    list ;;
  app)     [ -n "${2:-}" ] || die "usage: perf/bench.sh app <name>";     bash "$PERF/run.sh" app "$2" ;;
  engine)  [ -n "${2:-}" ] || die "usage: perf/bench.sh engine <name>";  bash "$PERF/run.sh" engine "$2" ;;
  profile) [ -n "${2:-}" ] || die "usage: perf/bench.sh profile <id>";   run_profile "$2" ;;
  *) die "unknown target '$1'; run: perf/bench.sh list" ;;
esac
