#!/usr/bin/env bash
# Copy the shared client into every example, so each one runs on its own.
#
#   platform/scripts/vendor-client.sh          copy into every app
#   platform/scripts/vendor-client.sh --check   report drift, change nothing
#
# An example is meant to be taken away and run. While the client was a
# workspace dependency it could not be: copying an app out of this repository
# left it with an unresolvable import. So each app carries its own copy.
#
# The cost of that is drift, and it is the whole reason --check exists. The copy
# under packages/lyeve is the one to edit. This script pushes it out, and `make
# check-vendor` fails when an app's copy has diverged. Nothing reconciles a
# hand-edit inside an app, so do not make one.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SRC="$REPO/packages/lyeve/src"
[ -d "$SRC" ] || die "canonical client not found at $SRC"

CHECK=false
[ "${1:-}" = "--check" ] && CHECK=true

# Where the copy lives inside an app, and what its own code imports.
#
#   SvelteKit app   src/lib/lyeve/   imported as $lib/lyeve
#   plain node app  src/lyeve/       imported relatively
#
# setup/ scripts run under plain node in both cases, so they always use a
# relative path: $lib is a SvelteKit alias and means nothing to node.
drift=0
copied=0

for dir in "$REPO"/apps/*/; do
  app="$(basename "$dir")"
  [ -f "$dir/package.json" ] || continue          # custom-plugin is Go

  if [ -d "$dir/src/lib" ]; then
    dest="$dir/src/lib/lyeve"
  else
    dest="$dir/src/lyeve"
  fi

  if $CHECK; then
    if [ ! -d "$dest" ]; then
      warn "$app: no vendored client at ${dest#$REPO/}"
      drift=$((drift + 1))
      continue
    fi
    if ! diff -rq "$SRC" "$dest" >/dev/null 2>&1; then
      warn "$app: vendored client has drifted from packages/lyeve"
      diff -rq "$SRC" "$dest" 2>&1 | sed 's/^/    /'
      drift=$((drift + 1))
    fi
    continue
  fi

  mkdir -p "$dest"
  # Mirror rather than merge, so a file removed from the canonical copy is
  # removed here too.
  find "$dest" -maxdepth 1 -name '*.ts' -delete 2>/dev/null
  cp "$SRC"/*.ts "$dest"/
  copied=$((copied + 1))
done

if $CHECK; then
  [ "$drift" -eq 0 ] && ok "every vendored client matches packages/lyeve" \
    || die "$drift app(s) have a vendored client that does not match packages/lyeve; run make vendor"
  exit 0
fi

ok "client copied into $copied app(s)"
