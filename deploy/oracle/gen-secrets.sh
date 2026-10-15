#!/usr/bin/env bash
# Replaces every `CHANGE_ME` secret in .env.prod with a fresh random value.
# Idempotent: only touches keys whose value is still exactly CHANGE_ME.
# R2/S3 keys (CHANGE_ME_R2) are left alone — those come from Cloudflare.
#
#   deploy/oracle/gen-secrets.sh [path/to/.env.prod]
set -euo pipefail
. "$(dirname "$0")/lib.sh"

target="${1:-$ENV_FILE}"
if [[ ! -f "$target" ]]; then
  cp "$ORACLE_DIR/.env.prod.example" "$target"
  log "created $target from .env.prod.example"
fi
chmod 600 "$target"

# Hex only: safe inside URLs, shell, YAML and the redis command line.
rand_hex() { openssl rand -hex "$1"; }

declare -A lengths=(
  [DB_PASS]=24
  [REDIS_PASSWORD]=24
  [APP_SECRET]=32
  [BACKUP_GPG_PASSPHRASE]=32
)

changed=0
for key in "${!lengths[@]}"; do
  if grep -qE "^${key}=CHANGE_ME$" "$target"; then
    value="$(rand_hex "${lengths[$key]}")"
    sed -i "s|^${key}=CHANGE_ME$|${key}=${value}|" "$target"
    log "generated $key"
    changed=$((changed + 1))
  fi
done

log "$changed secret(s) generated in $target"
if grep -qE '=CHANGE_ME' "$target"; then
  warn "still to fill by hand:"
  grep -nE '=CHANGE_ME' "$target" | sed 's/=.*//' >&2
fi
echo "Save BACKUP_GPG_PASSPHRASE in your password manager — R2 backups are useless without it."
