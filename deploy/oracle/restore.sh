#!/usr/bin/env bash
# Restore the production database from a pg_dump custom-format file.
#
#   deploy/oracle/restore.sh /var/backups/angren/daily/angren_taxi_20261015_033000.dump
#   deploy/oracle/restore.sh backup.dump.gpg                 # local, encrypted
#   deploy/oracle/restore.sh r2:daily/angren_taxi_....dump.gpg   # from R2 bucket
#   deploy/oracle/restore.sh <file> --yes                    # no prompt
#
# What it does:
#   1. fetch/decrypt the dump if needed and check pg_restore can read it;
#   2. take a safety dump of the CURRENT database (unless NO_SAFETY_DUMP=1);
#   3. stop backend + panels, drop and recreate the database;
#   4. pg_restore (the dump's own CREATE EXTENSION IF NOT EXISTS postgis runs);
#   5. verify PostGIS + table count, start backend (pending migrations run on
#      boot) and the panels.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_env

src="${1:?usage: restore.sh <file.dump|file.dump.gpg|r2:path> [--yes]}"
assume_yes=0
[[ "${2:-}" == "--yes" ]] && assume_yes=1
APP_SERVICES=(backend web-admin web-manager web-market web-restaurant)

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# ---- 1. obtain a plain .dump -----------------------------------------------
if [[ "$src" == r2:* ]]; then
  export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    RCLONE_CONFIG_R2_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" \
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" \
    RCLONE_CONFIG_R2_ENDPOINT="$BACKUP_S3_ENDPOINT"
  key="${src#r2:}"
  log "downloading r2:$BACKUP_S3_BUCKET/$key"
  rclone copyto "r2:$BACKUP_S3_BUCKET/$key" "$work/$(basename "$key")"
  src="$work/$(basename "$key")"
fi
[[ -f "$src" ]] || die "no such file: $src"

if [[ "$src" == *.gpg ]]; then
  log "decrypting"
  gpg --batch --yes --quiet --decrypt --passphrase-fd 3 \
    -o "$work/restore.dump" "$src" 3<<<"${BACKUP_GPG_PASSPHRASE:?BACKUP_GPG_PASSPHRASE not set}"
  src="$work/restore.dump"
fi

dc up -d postgres
wait_healthy postgres 120 || die "postgres unhealthy"
dc exec -T postgres pg_restore -l < "$src" > "$work/toc" || die "not a readable pg_dump custom-format file"
log "dump ok: $(grep -c ' TABLE DATA ' "$work/toc" || true) tables with data"

if [[ "$assume_yes" != "1" ]]; then
  read -r -p "This REPLACES database '$DB_NAME' on this VM. Type the DB name to continue: " answer
  [[ "$answer" == "$DB_NAME" ]] || die "aborted"
fi

# ---- 2. safety dump ----------------------------------------------------------
if [[ "${NO_SAFETY_DUMP:-0}" != "1" ]] \
  && [[ "$(psql_exec "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" postgres)" == "1" ]]; then
  log "safety dump of the current database"
  BACKUP_KIND=prerestore "$ORACLE_DIR/backup.sh" --local-only
fi

# ---- 3. recreate -------------------------------------------------------------
log "stopping app services"
dc stop "${APP_SERVICES[@]}" 2>/dev/null || true
log "dropping and recreating $DB_NAME"
psql_exec "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" postgres
psql_exec "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\"" postgres

# ---- 4. restore --------------------------------------------------------------
log "pg_restore"
if ! dc exec -T postgres pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
     < "$src" 2> "$work/restore.err"; then
  # pg_restore exits 1 even for ignorable noise; show it and judge below.
  warn "pg_restore reported errors:"
  grep -E 'error|ERROR' "$work/restore.err" | head -20 >&2 || true
fi

# ---- 5. verify + start ---------------------------------------------------------
postgis="$(psql_exec "SELECT extversion FROM pg_extension WHERE extname='postgis'")"
[[ -n "$postgis" ]] || die "PostGIS extension missing after restore"
tables="$(psql_exec "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
log "restored: postgis $postgis, $tables tables in public"
(( tables > 1 )) || die "restore produced an empty schema — see errors above"

if [[ "${NO_START:-0}" != "1" ]]; then
  log "starting backend (pending migrations run on boot) and panels"
  dc up -d "${APP_SERVICES[@]}"
  wait_healthy backend 300 || die "backend unhealthy after restore: dc logs backend"
fi
log "restore complete"
