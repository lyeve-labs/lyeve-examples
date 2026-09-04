#!/usr/bin/env bash
# A throwaway engine plus the single-URL proxy the benchmark harness expects.
#
#   perf/bench-stack.sh up <database>
#   perf/bench-stack.sh down
#
# Separate from the examples stack on purpose: a profile seeds thousands of rows
# and must not touch the database the examples are serving from.
#
# It launches and returns. A launcher that lingers to hold the engine open is
# what kills it, because the engine then shares the fate of whatever task is
# holding the launcher.
. "$(dirname "${BASH_SOURCE[0]}")/../platform/scripts/lib.sh"

BENCH_ADMIN="${LYEVE_BENCH_ADMIN_PORT:-4411}"
BENCH_API="${LYEVE_BENCH_API_PORT:-4412}"
PROXY_PORT="${LYEVE_PROXY_PORT:-4499}"
DIR="$STACK/bench"

stop_ports() {
  for port in "$BENCH_ADMIN" "$BENCH_API" "$PROXY_PORT"; do
    local pid; pid="$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oP '(?<=pid=)\d+' | head -1)"
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  sleep 1
}

case "${1:-}" in
  down) stop_ports; ok "throwaway stack stopped"; exit 0 ;;
  up) : ;;
  *) die "usage: perf/bench-stack.sh up <database> | down" ;;
esac

DB="${2:?usage: perf/bench-stack.sh up <database>}"
[ -x "$STACK/bin/lyeve" ] || die "no engine binary; run make up first"
mkdir -p "$DIR/logs"
stop_ports

cat > "$DIR/proxy.mjs" <<'PROXY'
// One URL in front of the engine's two listeners, mirroring the harness Caddy
// config: /api/admin/* to the admin listener, everything else to the content one.
import { createServer, request } from 'node:http';
const ADMIN = Number(process.env.ADMIN_PORT);
const API = Number(process.env.API_PORT);
createServer((req, res) => {
  const port = req.url.startsWith('/api/admin/') ? ADMIN : API;
  const up = request({ host: '127.0.0.1', port, method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502); res.end(String(e.message)); });
  req.pipe(up);
}).listen(Number(process.env.PROXY_PORT), () => console.log('proxy up'));
PROXY

(
  set -a; . "$STACK/stack.env"
  # A stack.env written before the setup token existed lacks it. This makes
  # sure the engine and the setup call below agree on one value.
  stack_secrets
  DATABASE_URL="postgres://postgres:postgres@localhost:$PG_PORT/$DB?sslmode=disable"
  ADMIN_LISTEN_ADDR="0.0.0.0:$BENCH_ADMIN"
  API_LISTEN_ADDR="0.0.0.0:$BENCH_API"
  JWT_KEY_PATH="$DIR/jwt.json"
  set +a
  cd "$ENGINE_SRC" || exit 1
  setsid nohup "$STACK/bin/lyeve" > "$DIR/logs/engine.log" 2>&1 < /dev/null &
)
setsid nohup env "PROXY_PORT=$PROXY_PORT" "ADMIN_PORT=$BENCH_ADMIN" "API_PORT=$BENCH_API" \
  node "$DIR/proxy.mjs" > "$DIR/logs/proxy.log" 2>&1 < /dev/null &

for _ in $(seq 1 120); do
  curl -sf -o /dev/null "http://localhost:$PROXY_PORT/readyz" && break
  sleep 1
done
curl -sf -o /dev/null "http://localhost:$PROXY_PORT/readyz" \
  || { tail -20 "$DIR/logs/engine.log" >&2; die "the throwaway engine never became ready"; }

# The seeder and the driver each authenticate. The default rule allows five
# logins per fifteen minutes, which a profile run exhausts, so it is relaxed
# here the same way the examples stack does it.
# The engine inherits LYEVE_SETUP_TOKEN from stack.env, and setup refuses a
# caller that does not present it.
stack_secrets
TOKEN=""
for _ in $(seq 1 30); do
  TOKEN="$(curl -s -X POST "http://localhost:$PROXY_PORT/api/admin/setup" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"admin@lyeve.com\",\"password\":\"benchmark-Passw0rd!\",\"setup_token\":\"$LYEVE_SETUP_TOKEN\"}" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  [ -n "$TOKEN" ] && break
  TOKEN="$(curl -s -X POST "http://localhost:$PROXY_PORT/api/admin/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@lyeve.com","password":"benchmark-Passw0rd!"}' \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  [ -n "$TOKEN" ] && break
  sleep 10
done
[ -n "$TOKEN" ] || die "could not authenticate against the throwaway stack"

python3 - "$PROXY_PORT" "$TOKEN" <<'PYEOF' || warn "could not relax the login limit; a long profile may hit 429"
import json, sys, urllib.request
port, token = sys.argv[1], sys.argv[2]
base = f"http://localhost:{port}/api/admin/rate-limits"
def call(url, method="GET", body=None):
    req = urllib.request.Request(url, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        raw = r.read(); return json.loads(raw) if raw else None
rows = call(base)
rows = rows if isinstance(rows, list) else (rows or {}).get("data") or []
for row in rows:
    if row.get("endpoint") in {"POST /api/admin/auth/login", "POST /api/v1/auth/token"}:
        call(f"{base}/{row['id']}", "PUT",
             {"endpoint": row["endpoint"], "rate": 50, "burst": 200, "enabled": True})
PYEOF

ok "throwaway stack ready on http://localhost:$PROXY_PORT (database $DB)"
