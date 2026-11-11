#!/usr/bin/env bash
# One-time move of the Railway PostgreSQL database onto this VM.
#
#   RAILWAY_DATABASE_URL='postgresql://angren:...@xxx.proxy.rlwy.net:12345/angren_taxi' \
#     deploy/oracle/migrate-from-railway.sh
#
# Use the PUBLIC (TCP proxy) URL — Railway dashboard → postgres service →
# Connect → "Public Network". The *.railway.internal host only resolves inside
# Railway.
#
# If Railway is down / the DB is gone: use a dump you already have
#   deploy/oracle/restore.sh /path/to/railway.dump
# or start fresh with seeds (README.md, "Toza boshlash").
#
# Steps: check the source (Postgres major, PostGIS) → pg_dump -Fc with a
# client of the SAME major version (in a throwaway container) → restore.sh.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_env

url="${RAILWAY_DATABASE_URL:?set RAILWAY_DATABASE_URL (Railway public postgres URL)}"
out_dir="${BACKUP_DIR:-/var/backups/angren}/railway"
mkdir -p "$out_dir"
out="$out_dir/railway_$(date +%Y%m%d_%H%M%S).dump"

client() {  # client <image> <cmd...> — run a postgres client in a container
  local image="$1"; shift
  docker run --rm -i -e PGCONNECT_TIMEOUT=15 "$image" "$@"
}

dc up -d postgres
wait_healthy postgres 120 || die "postgres unhealthy"

log "probing source"
major="$(client postgres:16-alpine psql "$url" -tAc 'SHOW server_version_num' | cut -c1-2)" \
  || die "cannot connect to Railway DB (is it up? public URL? sslmode?)"
[[ "$major" =~ ^[0-9]+$ ]] || die "could not read server version"
log "source Postgres major: $major"
(( major <= 16 )) || die "source is Postgres $major but the VM runs 16 — bump the postgres image first (imresamu/postgis:${major}-3.5-alpine) and re-run"

img="postgres:${major}-alpine"
postgis="$(client "$img" psql "$url" -tAc "SELECT extversion FROM pg_extension WHERE extname='postgis'")"
if [[ -z "$postgis" ]]; then
  warn "source has NO postgis extension — matching queries will fail until it exists; restore continues"
else
  log "source PostGIS: $postgis (target offers: $(psql_exec "SELECT default_version FROM pg_available_extensions WHERE name='postgis'" postgres))"
fi
client "$img" psql "$url" -tAc \
  "SELECT 'users='||count(*) FROM users UNION ALL SELECT 'orders='||count(*) FROM orders" 2>/dev/null \
  | sed 's/^/  source /' || true

log "pg_dump -> $out"
umask 077
client "$img" pg_dump "$url" -Fc -Z 6 --no-owner --no-acl > "$out.partial"
mv "$out.partial" "$out"
log "dump size: $(du -h "$out" | cut -f1)"

"$ORACLE_DIR/restore.sh" "$out" "${1:-}"

log "row counts on the VM:"
psql_exec "SELECT 'users='||count(*) FROM users UNION ALL SELECT 'orders='||count(*) FROM orders" \
  | sed 's/^/  target /' || true
log "migration done. Keep $out until you have verified the app, then delete it."
