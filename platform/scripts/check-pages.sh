#!/usr/bin/env bash
# Fetch every served app's home page and the first page it links to, and report
# what came back. A build that passes can still render nothing, which is the
# case this catches.
#
#   platform/scripts/check-pages.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

PIDS="$STACK/preview.pids"
[ -s "$PIDS" ] || die "nothing is being served; run make preview first"
OUT="$STACK/pages"; mkdir -p "$OUT"

pass=0; total=0
while read -r pid name port; do
  total=$((total + 1))
  # A server that exited, usually on a port another process already held,
  # leaves whatever holds the port to answer in its place.
  if ! kill -0 "$pid" 2>/dev/null; then
    printf '\033[31mFAIL\033[0m %-22s not running, see %s\n' "$name" "$STACK/logs/preview-$name.log"
    continue
  fi
  home="$OUT/$name.html"
  code="$(curl -sL --max-time 60 -o "$home" -w '%{http_code}' "http://localhost:$port/" || echo 000)"
  link="$(grep -oE 'href="/[a-z0-9][a-z0-9/_%-]*"' "$home" 2>/dev/null | sed 's/href="//;s/"//' | grep -vE '^/$' | head -1)"
  inner=000
  [ -n "$link" ] && inner="$(curl -sL --max-time 60 -o "$OUT/$name-inner.html" -w '%{http_code}' "http://localhost:$port$link" || echo 000)"
  title="$(grep -oE '<title>[^<]*</title>' "$home" 2>/dev/null | head -1 | sed 's/<[^>]*>//g')"
  # A 3xx is a real answer: a locale-rooted app redirects / to /en, and following
  # it would hide which of the two responded.
  ok_code() { case "$1" in 200|301|302|303|307|308) return 0 ;; *) return 1 ;; esac; }
  if ok_code "$code" && { ok_code "$inner" || [ -z "$link" ]; }; then
    pass=$((pass + 1)); printf '\033[32mok  \033[0m %-22s home %s  inner %s  %-28s %s\n' "$name" "$code" "$inner" "${link:0:28}" "${title:0:32}"
  else
    printf '\033[31mFAIL\033[0m %-22s home %s  inner %s  %s\n' "$name" "$code" "$inner" "${link:0:40}"
  fi
done < "$PIDS"
echo; [ "$pass" = "$total" ] && ok "$pass/$total apps render" || die "$pass/$total apps render"
