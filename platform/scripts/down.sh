#!/usr/bin/env bash
# Stop the engine and the database. Leaves the data volume alone. `up.sh --fresh` drops it.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
[ -f "$STACK/engine.pid" ] && kill "$(cat "$STACK/engine.pid")" 2>/dev/null && ok "engine stopped"
rm -f "$STACK/engine.pid"
docker stop "$PG_CONTAINER" >/dev/null 2>&1 && ok "database stopped" || true
