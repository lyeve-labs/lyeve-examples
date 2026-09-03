#!/usr/bin/env bash
# Serve every built app on consecutive ports so they can all be opened at once.
#
#   platform/scripts/preview-all.sh [--stop]
#
# Ports start at 4700 and follow the order of apps/*, skipping any port another
# process holds. Each server is detached from this shell, so the script returns
# and the apps keep running until --stop.
#
# 4700 keeps clear of ports other local development servers commonly use. That
# matters because these previews outlive the shell that started them: a stale
# preview on a shared port answers / with 200 and 404s every real page, so
# whatever expected its own server there reads a different app as its own.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

PIDS="$STACK/preview.pids"
mkdir -p "$STACK/logs"

if [ "${1:-}" = "--stop" ]; then
  [ -f "$PIDS" ] && while read -r pid _; do kill "$pid" 2>/dev/null; done < "$PIDS"
  rm -f "$PIDS"; ok "preview servers stopped"; exit 0
fi

[ -f "$REPO/.env" ] || die "no .env; run make up first"
set -a; . "$REPO/.env"; set +a

# Stop whatever an earlier run left behind, before assigning ports again.
#
# Without this the old servers keep the ports, the new ones cannot bind, and the
# port block silently means something different from what this run recorded: add
# an app whose name sorts early and every later app's port shifts by one, so the
# checker reads app N's name against app N-1's pages. It reported twenty-three
# passes with every title attached to the wrong app.
if [ -s "$PIDS" ]; then
  while read -r pid _ _; do [ -n "$pid" ] && kill "$pid" 2>/dev/null; done < "$PIDS"
  sleep 1
fi
#
# A port held by a server of ours that the pid file lost is freed. A port held
# by anything else is skipped, never stopped: another stack on this machine can
# hold a port in the block, and a server that fails to bind beside it leaves the
# other one answering for this app.
port_owner() { ss -ltnp 2>/dev/null | grep -E "[:.]$1 " | grep -oP '(?<=pid=)\d+' | head -1; }
ours() { case "$(readlink -f "/proc/$1/cwd" 2>/dev/null)" in "$REPO"/apps/*) return 0 ;; *) return 1 ;; esac; }
for port in $(seq 4700 4799); do
  held="$(port_owner "$port")"
  [ -n "$held" ] && ours "$held" && kill "$held" 2>/dev/null
done
sleep 1

: > "$PIDS"
port=4700
for dir in "$REPO"/apps/*/; do
  name="$(basename "$dir")"
  [ -f "$dir/build/index.js" ] || continue
  while [ -n "$(port_owner "$port")" ]; do port=$((port + 1)); done
  ( cd "$dir" && PORT=$port setsid node build/index.js > "$STACK/logs/preview-$name.log" 2>&1 < /dev/null & echo "$! $name $port" >> "$PIDS" )
  printf '  %-22s http://localhost:%s\n' "$name" "$port"
  port=$((port + 1))
done
ok "$(wc -l < "$PIDS") apps serving; stop with: make preview-stop"
