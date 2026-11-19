#!/usr/bin/env bash
# Run `brand-kit doctor --strict` on the repo's own brand/ and on every example
# that has a brand/ directory. Needs `pnpm build` first (uses dist/cli.js).
# Staleness follows source content hashes in brand/.render.json, so the result
# does not depend on which machine rendered the PNGs.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cli="$root/dist/cli.js"
[ -f "$cli" ] || { echo "dist/cli.js missing: run pnpm build first" >&2; exit 2; }

# Flags an example was generated with, so doctor expects the same brand meta.
# Keep in sync with the command in that example's README.
flags_for() {
  case "$1" in
    custom) echo '--tagline|Brand assets you can regenerate|--accent|#e879f9' ;;
    *) echo '' ;;
  esac
}

fail=0
run() {
  local dir="$1" name="$2" flags=() raw
  raw="$(flags_for "$name")"
  if [ -n "$raw" ]; then IFS='|' read -r -a flags <<<"$raw"; fi
  echo "== $name"
  node "$cli" doctor --strict --dir "$dir" ${flags[@]+"${flags[@]}"} || fail=1
}

run "$root" "."
for d in "$root"/examples/*/; do
  [ -d "$d/brand" ] || continue
  run "${d%/}" "$(basename "$d")"
done
exit "$fail"
