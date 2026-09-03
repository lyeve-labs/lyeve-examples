#!/usr/bin/env bash
# Boot the engine the examples run against.
#
#   platform/scripts/up.sh [--fresh]
#
# Builds the engine from the sibling lyeve-core checkout rather than pulling an
# image, because the published packages are not anonymously pullable.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FRESH=false
[ "${1:-}" = "--fresh" ] && FRESH=true

need docker; need go; need curl
[ -d "$ENGINE_SRC" ] || die "engine source not found at $ENGINE_SRC (set LYEVE_CORE_SRC)"
[ -n "${LYEVE_LICENSE_KEY:-}" ] && [ -n "${LICENSE_PUBLIC_KEY_HEX:-}" ] \
  || die "no development license: set LYEVE_LICENSE_KEY and LICENSE_PUBLIC_KEY_HEX (see README)"

mkdir -p "$STACK/bin" "$STACK/logs" "$STACK/jwt"

# database
if $FRESH; then
  say "removing the existing database"
  docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  if docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    say "starting the existing database container"
    docker start "$PG_CONTAINER" >/dev/null
  else
    say "creating postgres on :$PG_PORT"
    docker run -d --name "$PG_CONTAINER" -p "$PG_PORT:5432" \
      -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB="$PG_DB" \
      postgres:16-alpine >/dev/null || die "could not start postgres"
  fi
fi

for _ in $(seq 1 60); do
  docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 || die "postgres never became ready"
ok "postgres ready on :$PG_PORT"

# license
#
# The engine verifies a license against a public key linked in at build time,
# so the license and the public key have to belong together, and the binary is
# rebuilt whenever they change. Both come from the environment:
# LYEVE_LICENSE_KEY and LICENSE_PUBLIC_KEY_HEX. This repository issues no
# licenses.
printf 'LICENSE_PUBLIC_KEY_HEX=%s\nLYEVE_LICENSE_KEY=%s\n' "$LICENSE_PUBLIC_KEY_HEX" "$LYEVE_LICENSE_KEY" > "$STACK/license.env"
ok "using the license from the environment"
HEX="$(grep -oP '(?<=LICENSE_PUBLIC_KEY_HEX=).*' "$STACK/license.env")"

# build
#
# cmd/lyeve is its own Go module in current checkouts and a package of the
# engine in older ones.
if [ -f "$ENGINE_SRC/cmd/lyeve/go.mod" ]; then
  BUILD_DIR="$ENGINE_SRC/cmd/lyeve"; BUILD_PKG="."
else
  BUILD_DIR="$ENGINE_SRC"; BUILD_PKG="./cmd/lyeve"
fi

# The engine verifies the license against a key linked into a variable of its
# license package. A binary linked without it boots at the free tier, and every
# premium example fails later with a 402 that reads like its own fault.
#
# The package has moved before, and the linker ignores a -X that names a symbol
# nobody declares, so a hardcoded path builds cleanly and verifies nothing once
# it goes stale. The symbol is read from the build graph instead: every package
# named license that the engine imports, and the key variable it declares. The
# boot below still refuses an engine that says no license verifies.
LDFLAGS=""
while read -r pkg dir; do
  for var in $(grep -hoE '^var (LicensePublicKeyHex|PublicKeyHex) ' "$dir"/*.go 2>/dev/null | awk '{print $2}' | sort -u); do
    LDFLAGS="$LDFLAGS -X $pkg.$var=$HEX"
  done
done < <(cd "$BUILD_DIR" && go list -deps -f '{{if eq .Name "license"}}{{.ImportPath}} {{.Dir}}{{end}}' "$BUILD_PKG" 2>/dev/null)
[ -n "$LDFLAGS" ] || die "found no license key variable in the engine's build graph"

# A binary built elsewhere, for instance from a worktree carrying a fix under
# test. It must have been linked with the same license public key, or the premium
# plugins load as no-op stubs and say nothing about it.
if [ -n "${LYEVE_ENGINE_BIN:-}" ]; then
  [ -x "$LYEVE_ENGINE_BIN" ] || die "LYEVE_ENGINE_BIN is not an executable: $LYEVE_ENGINE_BIN"
  cp "$LYEVE_ENGINE_BIN" "$STACK/bin/lyeve"
  ok "using the prebuilt engine at $LYEVE_ENGINE_BIN"
else
  say "building the engine and its plugins (a cold build takes a few minutes)"
  ( cd "$BUILD_DIR" && go build -ldflags "$LDFLAGS" -o "$STACK/bin/lyeve" "$BUILD_PKG" ) \
    > "$STACK/logs/build.log" 2>&1 || { tail -20 "$STACK/logs/build.log" >&2; die "engine build failed"; }
  ok "engine built"
fi

# run
stack_secrets
bash "$(dirname "${BASH_SOURCE[0]}")/env.sh" > "$STACK/stack.env"
cat "$STACK/license.env" >> "$STACK/stack.env"

# Always replace a running engine. One left from an earlier boot is serving
# whatever configuration that boot chose, and an HTTP probe cannot tell the
# difference: it answers happily while ignoring every setting made since.
# Stop any engine this stack started, matched by the executable behind its pid
# rather than by its command line.
#
# `pkill -f <path>` looks like the obvious way and is a trap: the pattern
# matches every command line containing the path, including the shell running
# this script, so it terminates its own caller. What a process is really
# running is /proc/<pid>/exe, which nothing can match by accident.
#
# It matters that this succeeds. A port left held makes the replacement log
# "address already in use" and then keep running with no listener at all, so
# the failure presents as an engine that booted and serves nothing.
stop_our_engine() {
  local stopped=0 target pid exe
  for target in "$(readlink -f "$STACK/bin/lyeve" 2>/dev/null)"; do
    [ -n "$target" ] || continue
    for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
      exe="$(readlink -f "/proc/$pid/exe" 2>/dev/null)" || continue
      [ "$exe" = "$target" ] || continue
      kill "$pid" 2>/dev/null && stopped=$((stopped + 1))
    done
  done
  [ "$stopped" -gt 0 ] && say "stopped $stopped engine process(es) from an earlier boot"
  return 0
}
stop_our_engine

for port in "$ADMIN_PORT" "$API_PORT"; do
  for _ in $(seq 1 10); do
    ss -ltn 2>/dev/null | grep -q ":$port " || break
    pid="$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oP '(?<=pid=)\d+' | head -1)"
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
    sleep 1
  done
  ss -ltn 2>/dev/null | grep -q ":$port " && die "port $port is still held; stop whatever owns it and retry"
done

# This script launches the engine and returns, and that is not a detail. A
# launcher that stays alive to hold the engine open is what kills it: wrap a boot
# in a long sleep so a background task keeps running, and the engine shares that
# task's fate and is terminated the moment the task is reaped. setsid puts the engine in its own process group. Returning promptly
# removes the parent whose teardown would take it along.
say "starting the engine"
(
  set -a; . "$STACK/stack.env"; set +a
  cd "$ENGINE_SRC" || exit 1
  setsid nohup "$STACK/bin/lyeve" > "$STACK/logs/engine.log" 2>&1 < /dev/null &
  echo $! > "$STACK/engine.pid"
)

for _ in $(seq 1 90); do
  curl -sf -o /dev/null "http://localhost:$ADMIN_PORT/readyz" && break
  sleep 1
done
curl -sf -o /dev/null "http://localhost:$ADMIN_PORT/readyz" \
  || { tail -30 "$STACK/logs/engine.log" >&2; die "the engine never became ready"; }
ok "engine ready on admin :$ADMIN_PORT, api :$API_PORT"

# The license is checked at boot and logged, so the log is where a key that
# was never linked shows. Without this the stack comes up green on the free
# tier and the premium examples fail one by one during setup.
if grep -qE 'no public key was linked|running free tier' "$STACK/logs/engine.log"; then
  grep -E '"license' "$STACK/logs/engine.log" | head -5 >&2
  die "the engine started without the development license, so the premium examples would refuse"
fi
ok "development license verified"

# first admin
#
# /api/admin/setup only answers while the users table is empty, so a login
# probe decides whether there is anything to do. The setup call carries the
# token the engine was started with (LYEVE_SETUP_TOKEN in stack.env).
if curl -sf -o /dev/null -X POST "http://localhost:$ADMIN_PORT/api/admin/auth/login" \
     -H 'Content-Type: application/json' \
     -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"; then
  ok "admin account already present"
else
  say "creating the first admin account"
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$ADMIN_PORT/api/admin/setup" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"setup_token\":\"$LYEVE_SETUP_TOKEN\"}")
  case "$code" in
    201) ;;
    401) die "setup refused the setup token (401): the engine was started with a different LYEVE_SETUP_TOKEN, or it already has users" ;;
    *)   die "setup returned $code, so the database may already have users" ;;
  esac
  ok "admin account created"
fi

# login limit
#
# The rate-limit plugin ships a sign-in protection allowing five logins per
# fifteen minutes per address, on both sign-in routes. That is a sensible
# production default and unworkable on a machine that seeds every example, each
# of which authenticates. Note that this protection is NOT the core
# PUBLIC_RATE_LIMITS setting: that governs a different limiter and has no effect
# on this one.
#
# A protection is changed by name through its own route, which needs the
# rate-limit-pro capability the development license carries. The rule's own
# update route refuses a protection with a 409.
TOKEN="$(curl -s -X POST "http://localhost:$ADMIN_PORT/api/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"

if [ -n "$TOKEN" ]; then
  relaxed=1
  for route in "POST /api/admin/auth/login" "POST /api/v1/auth/token"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT \
      "http://localhost:$ADMIN_PORT/api/admin/rate-limits/protections" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d "{\"name\":\"$route\",\"requests\":1000,\"window_seconds\":60}")
    [ "$code" = 204 ] || relaxed=0
  done
  [ "$relaxed" = 1 ] && ok "login rate limit relaxed for local development" \
    || warn "could not relax the login rate limit; seeding many examples may hit 429"
fi

[ -f "$REPO/.env" ] || { cp "$REPO/.env.example" "$REPO/.env"; ok "wrote .env"; }

printf '\n'
ok "stack is up"
echo "   admin api  http://localhost:$ADMIN_PORT"
echo "   public api http://localhost:$API_PORT"
echo "   sign in as $ADMIN_EMAIL / $ADMIN_PASSWORD"
echo "   logs       $STACK/logs/engine.log"
