#!/usr/bin/env bash
# Sync the canonical panel UI kit from web-manager into the other panels.
#
#   bash scripts/sync-panel-ui.sh          # copy (idempotent)
#   bash scripts/sync-panel-ui.sh --check  # exit 1 if any panel drifted
#
# Source of truth (docs/design/PANEL-UI-KIT.md §1), all inside web-manager/:
#   src/components/ui/**      mirrored (extra files in the target are removed)
#   src/components/shell/**   mirrored
#   src/lib/i18n/**           mirrored (UZ/RU yadrosi + kit matnlari)
#   src/lib/format.ts, src/lib/format.test.ts
#   src/styles/tokens.css
#   tailwind.preset.js
#
# Every synced file starts with:
#   // AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
# Edit in web-manager, never in a target panel.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/web-manager"
TARGETS=(web-admin web-market web-restaurant)
MIRROR_DIRS=(src/components/ui src/components/shell src/lib/i18n)
FILES=(src/lib/format.ts src/lib/format.test.ts src/styles/tokens.css tailwind.preset.js)
HEADER='AUTO-SYNCED from web-manager'

MODE=sync
case "${1:-}" in
  --check) MODE=check ;;
  "") ;;
  -h | --help)
    sed -n '2,16p' "$0"
    exit 0
    ;;
  *)
    echo "Unknown argument: $1 (use --check)" >&2
    exit 2
    ;;
esac

# Sanity: every canonical file carries the header.
missing=0
while IFS= read -r f; do
  if ! head -n 1 "$SRC/$f" | grep -q "$HEADER"; then
    echo "missing AUTO-SYNCED header: web-manager/$f" >&2
    missing=1
  fi
done < <(
  cd "$SRC"
  for d in "${MIRROR_DIRS[@]}"; do find "$d" -type f; done
  printf '%s\n' "${FILES[@]}"
)
[ "$missing" -eq 0 ] || exit 1

drift=0
changed=0

report() { # $1 = message
  echo "  $1"
  drift=1
}

sync_file() { # $1 = relative path, $2 = target panel dir
  local rel=$1 dst="$2/$1"
  if [ -f "$dst" ] && cmp -s "$SRC/$rel" "$dst"; then
    return 0
  fi
  if [ "$MODE" = check ]; then
    if [ -f "$dst" ]; then report "differs: $(basename "$2")/$rel"; else report "missing: $(basename "$2")/$rel"; fi
  else
    mkdir -p "$(dirname "$dst")"
    cp "$SRC/$rel" "$dst"
    changed=$((changed + 1))
  fi
}

for panel in "${TARGETS[@]}"; do
  TGT="$ROOT/$panel"
  [ -d "$TGT" ] || { echo "skip: $panel (not found)" >&2; continue; }
  if [ "$MODE" = check ]; then echo "$panel:"; fi

  for d in "${MIRROR_DIRS[@]}"; do
    # Copy / compare every source file.
    while IFS= read -r f; do
      sync_file "$d/$f" "$TGT"
    done < <(cd "$SRC/$d" && find . -type f | sed 's|^\./||' | sort)

    # Remove / flag files that exist only in the target.
    if [ -d "$TGT/$d" ]; then
      while IFS= read -r f; do
        if [ ! -f "$SRC/$d/$f" ]; then
          if [ "$MODE" = check ]; then
            report "extra: $panel/$d/$f"
          else
            rm -f "$TGT/$d/$f"
            changed=$((changed + 1))
          fi
        fi
      done < <(cd "$TGT/$d" && find . -type f | sed 's|^\./||' | sort)
      if [ "$MODE" = sync ]; then find "$TGT/$d" -type d -empty -delete; fi
    fi
  done

  for f in "${FILES[@]}"; do
    sync_file "$f" "$TGT"
  done
done

if [ "$MODE" = check ]; then
  if [ "$drift" -ne 0 ]; then
    echo "Panel UI kit drift detected — run: bash scripts/sync-panel-ui.sh" >&2
    exit 1
  fi
  echo "Panel UI kit in sync (${TARGETS[*]})."
else
  echo "Synced panel UI kit into ${TARGETS[*]} ($changed file(s) changed)."
fi
