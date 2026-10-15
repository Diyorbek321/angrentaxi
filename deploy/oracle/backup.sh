#!/usr/bin/env bash
# Nightly PostgreSQL backup: pg_dump custom format (compressed), verified,
# rotated locally (7 daily + 4 weekly by default) and copied off-box —
# GPG-encrypted — to a Cloudflare R2 bucket via rclone (S3 API).
#
#   deploy/oracle/backup.sh                 # daily (+ weekly on Sundays)
#   deploy/oracle/backup.sh --local-only    # skip the R2 upload
#   BACKUP_KIND=predeploy deploy/oracle/backup.sh --local-only   # used by deploy.sh
#
# Scheduled by install-timers.sh (systemd timer, 03:30 Asia/Tashkent).
# Replaces scripts/backup.sh for this stack (that one stays for the dev
# docker-compose.yml `db-backup` profile).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_env

local_only=0
[[ "${1:-}" == "--local-only" ]] && local_only=1

BACKUP_DIR="${BACKUP_DIR:-/var/backups/angren}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
KEEP_PREDEPLOY="${BACKUP_KEEP_PREDEPLOY:-5}"
kind="${BACKUP_KIND:-daily}"

umask 077
mkdir -p "$BACKUP_DIR/$kind"
stamp="$(date +%Y%m%d_%H%M%S)"
file="$BACKUP_DIR/$kind/${DB_NAME}_${stamp}.dump"

# keep_newest <dir> <count>
keep_newest() {
  local dir="$1" count="$2"
  find "$dir" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | awk -v n="$count" 'NR>n {print $2}' | xargs -r rm -f --
}

log "pg_dump -> $file"
# -Fc: custom format, compressed, restorable selectively with pg_restore.
# --no-owner/--no-acl: restorable into a DB whose role name differs.
dc exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -Z 6 --no-owner --no-acl > "$file.partial"
mv "$file.partial" "$file"

# A truncated dump is worse than none: prove pg_restore can read its TOC.
dc exec -T postgres pg_restore -l < "$file" > /dev/null || die "dump unreadable: $file"
size="$(du -h "$file" | cut -f1)"
log "dump ok ($size)"

case "$kind" in
  daily)
    keep_newest "$BACKUP_DIR/daily" "$KEEP_DAILY"
    if [[ "$(date +%u)" == "7" ]]; then
      mkdir -p "$BACKUP_DIR/weekly"
      cp -p "$file" "$BACKUP_DIR/weekly/"
      keep_newest "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
      log "weekly copy kept"
    fi
    ;;
  predeploy) keep_newest "$BACKUP_DIR/predeploy" "$KEEP_PREDEPLOY" ;;
esac

if [[ "$local_only" == "1" || -z "${BACKUP_S3_BUCKET:-}" ]]; then
  [[ -z "${BACKUP_S3_BUCKET:-}" ]] && warn "BACKUP_S3_BUCKET empty — backup stays on this VM only"
  exit 0
fi

# ---- off-box copy ----------------------------------------------------------
command -v rclone >/dev/null || die "rclone not installed (bootstrap.sh installs it)"
[[ -n "${BACKUP_GPG_PASSPHRASE:-}" && "$BACKUP_GPG_PASSPHRASE" != CHANGE_ME ]] \
  || die "BACKUP_GPG_PASSPHRASE not set — refusing to upload personal data unencrypted"

# rclone remote "r2" defined purely through env — no config file on disk.
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

enc="$(mktemp --suffix=.gpg)"
trap 'rm -f "$enc"' EXIT
gpg --batch --yes --quiet --symmetric --cipher-algo AES256 \
  --passphrase-fd 3 -o "$enc" "$file" 3<<<"$BACKUP_GPG_PASSPHRASE"

remote_dirs=("$kind")
[[ "$kind" == "daily" && "$(date +%u)" == "7" ]] && remote_dirs+=(weekly)
for d in "${remote_dirs[@]}"; do
  rclone copyto --s3-no-check-bucket "$enc" "r2:$BACKUP_S3_BUCKET/$d/$(basename "$file").gpg"
  log "uploaded r2:$BACKUP_S3_BUCKET/$d/$(basename "$file").gpg"
done

# Remote retention mirrors the local one (by age).
rclone delete --min-age "$((KEEP_DAILY + 1))d" "r2:$BACKUP_S3_BUCKET/daily" || warn "remote daily prune failed"
rclone delete --min-age "$((KEEP_WEEKLY * 7 + 1))d" "r2:$BACKUP_S3_BUCKET/weekly" || warn "remote weekly prune failed"
log "backup done"
