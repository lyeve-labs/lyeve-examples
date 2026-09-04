#!/usr/bin/env bash
# Measure an example at one of two layers, and record the result with the facts
# needed to judge it.
#
#   perf/run.sh app <name>        the pages a visitor waits for
#   perf/run.sh engine <name>     the engine calls behind those pages
#   perf/run.sh all               every app, both layers
#
#   RATE=50 DURATION=60s perf/run.sh app blog
#
# One rule: a number reaches perf/results/ only if this script produced it from
# a run. There is no path in here that writes a figure any other way.
set -uo pipefail

PERF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$PERF/.." && pwd)"
RESULTS="$PERF/results"
K6_IMAGE="${K6_IMAGE:-grafana/k6:latest}"

say()  { printf '\033[36m==\033[0m %s\n' "$*"; }
ok()   { printf '\033[32mok\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31mxx\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker is required; k6 runs as a container"
[ -f "$PERF/apps.json" ] || die "perf/apps.json is missing; run: node perf/discover-apps.mjs"
mkdir -p "$RESULTS"

jq_node() { node -e 'const d=require(process.argv[1]);process.stdout.write(String(eval(process.argv[2])))' "$PERF/apps.json" "$1"; }

app_field() { # app_field <name> <expr on `a`>
  node -e '
    const d=require(process.argv[1]);
    const a=d.apps.find(x=>x.name===process.argv[2]);
    if(!a){process.exit(3)}
    process.stdout.write(String(eval(process.argv[3])));
  ' "$PERF/apps.json" "$1" "$2"
}

# ── host facts, so a figure can be judged rather than just read ──────────────
host_facts() {
  # The source checkout commit is a hint, not the identity of what was measured:
  # the binary can be built from a worktree, or the checkout can move on while a
  # long-running engine keeps serving the build it started with. A figure was
  # once attributed to a commit that had nothing to do with the running process.
  # The binary fingerprint is what actually identifies the thing under test.
  local engine_commit binary bin_hash bin_built
  engine_commit="$(git -C "${LYEVE_CORE_SRC:-$REPO/../lyeve-core}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  binary="$(readlink -f /proc/"$(pgrep -f "$REPO/.stack/bin/lyeve" | head -1)"/exe 2>/dev/null || echo unknown)"
  if [ -f "$binary" ]; then
    bin_hash="$(sha256sum "$binary" | cut -c1-12)"
    bin_built="$(date -u -r "$binary" +%Y-%m-%dT%H:%M:%SZ)"
  else
    bin_hash=unknown; bin_built=unknown
  fi
  cat <<EOF
{
  "cores": $(nproc),
  "memory_gb": $(awk '/MemTotal/ {printf "%.0f", $2/1048576}' /proc/meminfo),
  "kernel": "$(uname -r)",
  "docker": "$(docker --version | sed 's/,.*//')",
  "k6_image": "$K6_IMAGE",
  "engine_binary": "$(basename "$binary")",
  "engine_binary_sha256": "$bin_hash",
  "engine_binary_built": "$bin_built",
  "source_checkout_commit": "$engine_commit",
  "note": "a development machine, not a dedicated reference host; comparable only with other runs recorded here. source_checkout_commit is a hint; engine_binary_sha256 identifies what ran."
}
EOF
}

# ── run k6 and record ────────────────────────────────────────────────────────
measure() { # measure <layer> <name> <target-url> <k6-script> <extra k6 env...>
  local layer="$1" name="$2" url="$3" script="$4"; shift 4
  local stamp; stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local base="$RESULTS/$name-$layer-$stamp"

  # Never measure something that is not answering. A refused connection would
  # otherwise be recorded as a 100% error rate and read as a product failure.
  local probe="$url/"
  [ "$layer" = engine ] && probe="$url/readyz"
  # A warning rather than a hard exit: in a sweep one unreachable target must
  # not abort the remaining apps. The engine dying mid-sweep did exactly that.
  if ! curl -sf -o /dev/null --max-time 10 "$probe"; then
    warn "$name ($layer): nothing answering at $probe, nothing recorded. For an app run: make preview. For an engine run: make up."
    return 1
  fi

  say "$name ($layer) at $url, rate ${RATE:-default}, duration ${DURATION:-default}"
  # The image runs as its own unprivileged user, which cannot write to a bind
  # mount owned by the host user, so the summary export fails and the run is
  # discarded. Mapping the uid is what makes the export land.
  docker run --rm --network host \
    --user "$(id -u):$(id -g)" \
    -v "$PERF:/perf" -w /perf/k6 \
    "$K6_IMAGE" run \
    --summary-export "/perf/results/$(basename "$base").summary.json" \
    "$@" "$script" 2>&1 | tee "$base.log" | tail -22

  local summary="$base.summary.json"
  if [ ! -s "$summary" ]; then
    warn "$name ($layer): k6 produced no summary; nothing recorded"
    return 1
  fi

  host_facts > "$base.host.json"
  node -e '
    const fs=require("fs");
    const [summaryPath, hostPath, outPath, name, layer, stamp] = process.argv.slice(1);
    const s=JSON.parse(fs.readFileSync(summaryPath,"utf8"));
    const host=JSON.parse(fs.readFileSync(hostPath,"utf8"));
    const m=s.metrics||{};
    const t=m[layer==="app"?"page_latency":"engine_latency"]||{};
    const okm=m[layer==="app"?"page_ok":"engine_ok"]||{};
    const rec={
      name, layer, at: stamp, provenance: "measured", host,
      requests: (m.http_reqs||{}).count ?? null,
      rate_achieved: (m.http_reqs||{}).rate ?? null,
      p50_ms: t.med ?? null, p95_ms: t["p(95)"] ?? null, p99_ms: t["p(99)"] ?? null,
      max_ms: t.max ?? null,
      // A Rate in the k6 summary carries `value` (a fraction) plus pass and
      // fail counts. There is no `rate` key, and reading one records a null.
      ok_rate: okm.value ?? null,
      checks_passed: okm.passes ?? null,
      checks_failed: okm.fails ?? null,
      http_req_failed: (m.http_req_failed||{}).value ?? null,
      // In the summary a threshold boolean is true when it was BREACHED, so
      // an empty list here is the run having met every threshold it declared.
      thresholds_breached: Object.entries(m).flatMap(([metric,v])=>
        Object.entries(v.thresholds||{}).filter(([,breached])=>breached===true).map(([expr])=>`${metric}: ${expr}`)),
      // A Trend in the summary has no count, so only the latencies are recorded.
      per_series: Object.fromEntries(Object.entries(m)
        .filter(([k])=>k.startsWith(layer==="app"?"page_":"engine_") && !k.endsWith("_ok") && !k.endsWith("latency") && !k.endsWith("skipped"))
        .map(([k,v])=>[k,{p95_ms:v["p(95)"]??null,med_ms:v.med??null}])),
    };
    // A run whose setup threw sends its setup requests and no measured one,
    // and its empty thresholds read as met. It is not a measurement.
    if (!rec.checks_passed && !rec.checks_failed) { console.error("no measured request"); process.exit(3); }
    fs.writeFileSync(outPath, JSON.stringify(rec,null,2)+"\n");
    const pct=(x)=>x==null?"-":(x*100).toFixed(2)+"%";
    const ms=(x)=>x==null?"-":x.toFixed(2);
    const breach = rec.thresholds_breached.length ? `${rec.thresholds_breached.length} breached` : "met";
    console.log(`| ${name} | ${layer} | ${stamp} | ${rec.requests ?? "-"} | ${rec.rate_achieved==null?"-":rec.rate_achieved.toFixed(1)} | ${ms(rec.p50_ms)} | ${ms(rec.p95_ms)} | ${ms(rec.p99_ms)} | ${pct(rec.ok_rate)} | ${breach} | ${host.engine_binary_sha256} |`);
  ' "$summary" "$base.host.json" "$base.json" "$name" "$layer" "$stamp" > "$base.row" || {
    rm -f "$base.row"; warn "$name ($layer): no measured request or an unreadable summary (see $(basename "$base").log); nothing recorded"; return 1; }

  append_row "$(cat "$base.row")"
  rm -f "$base.row"
  ok "$name ($layer) recorded: $(basename "$base").json"
}

append_row() {
  local row="$1" table="$RESULTS/RESULTS.md"
  if [ ! -f "$table" ]; then
    cat > "$table" <<'HDR'
# Measured results

Every row was produced by `perf/run.sh` from an actual run. Nothing here is a
target, an estimate or a figure carried over from elsewhere. The engine commit
is recorded per row because a change to the engine changes what these mean.

The two layers answer different questions. `app` is the server-rendered page a
visitor waits for, which includes SvelteKit and every engine call that page
makes. `engine` is the engine alone for that app's primary content type. A slow
page with a fast engine is the app's own doing.

These ran on a development machine. They are comparable with each other and with
nothing else.

| App | Layer | Run (UTC) | Requests | Rate/s | p50 ms | p95 ms | p99 ms | OK | Thresholds | Binary |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
HDR
  fi
  printf '%s\n' "$row" >> "$table"
}

# ── entry points ─────────────────────────────────────────────────────────────
run_app() {
  local name="$1"
  local port; port="$(app_field "$name" 'a.port')" || die "unknown app '$name'; see perf/apps.json"

  # apps.json records the dev-server port, but a measured run wants the built
  # output, which make preview serves on its own port block. Prefer whatever is
  # actually serving so that perf/run.sh app <name> works straight after it.
  local preview="$REPO/.stack/preview.pids"
  if [ -z "${APP_URL:-}" ] && [ -s "$preview" ]; then
    local pport; pport="$(awk -v n="$name" '$2==n {print $3}' "$preview" | head -1)"
    [ -n "$pport" ] && port="$pport"
  fi

  local url="${APP_URL:-http://localhost:$port}"
  measure app "$name" "$url" app.js \
    -e "APP=$name" -e "APP_URL=$url" \
    ${RATE:+-e "RATE=$RATE"} ${DURATION:+-e "DURATION=$DURATION"}
}

run_engine() {
  local name="$1"
  local schemas; schemas="$(app_field "$name" 'a.schemas.slice().reverse().join(" ")')" || die "unknown app '$name'"
  [ -n "$schemas" ] || die "$name declares no content types; nothing to drive"
  # The last type is the one the others point at, which is the app's primary
  # read. A type the app fills only at runtime, such as the receipts of
  # webhooks it has received, is empty after setup, so the last type holding
  # rows is the one driven.
  local admin="${LYEVE_ADMIN_URL:-http://localhost:4401}" api="${LYEVE_API_URL:-http://localhost:4402}" token schema="" t
  token="$(curl -s -X POST "$admin/api/admin/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"${LYEVE_EMAIL:-admin@lyeve.example}\",\"password\":\"${LYEVE_PASSWORD:-Admin12345678}\"}" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  for t in $schemas; do
    if curl -s -H "Authorization: Bearer $token" "$api/api/v1/content/$t?limit=1" | grep -q '"id"'; then schema="$t"; break; fi
  done
  [ -n "$schema" ] || { warn "$name (engine): none of its types holds a row; run make setup. Nothing recorded."; return 1; }
  measure engine "$name" "${LYEVE_API_URL:-http://localhost:4402}" engine.js \
    -e "SCHEMA=$schema" \
    -e "API_URL=${LYEVE_API_URL:-http://localhost:4402}" \
    -e "ADMIN_URL=${LYEVE_ADMIN_URL:-http://localhost:4401}" \
    -e "EMAIL=${LYEVE_EMAIL:-admin@lyeve.example}" \
    -e "PASSWORD=${LYEVE_PASSWORD:-Admin12345678}" \
    ${RATE:+-e "RATE=$RATE"} ${DURATION:+-e "DURATION=$DURATION"}
}

LAYER="${1:-}"; NAME="${2:-}"
case "$LAYER" in
  app)    [ -n "$NAME" ] || die "usage: perf/run.sh app <name>";    run_app "$NAME"    || die "$NAME: nothing recorded" ;;
  engine) [ -n "$NAME" ] || die "usage: perf/run.sh engine <name>"; run_engine "$NAME" || die "$NAME: nothing recorded" ;;
  all)
    failed=0
    for n in $(jq_node 'd.apps.map(a=>a.name).join(" ")'); do
      run_app "$n"    || failed=$((failed+1))
      run_engine "$n" || failed=$((failed+1))
    done
    [ "$failed" = 0 ] && ok "every layer recorded" || warn "$failed run(s) recorded nothing"
    ;;
  *) sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
esac
