#!/usr/bin/env bash
# Shared helpers for the deploy/oracle scripts. Source it, do not run it.
#
# Overridable from the environment (handy for local tests):
#   REPO_DIR       repo checkout             (default: two levels above this file)
#   ENV_FILE       env file                  (default: deploy/oracle/.env.prod)
#   COMPOSE_FILE_PATH compose file           (default: deploy/oracle/docker-compose.prod.yml)
#   COMPOSE_PROJECT   compose project name   (default: angren)

ORACLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$ORACLE_DIR/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$ORACLE_DIR/.env.prod}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$ORACLE_DIR/docker-compose.prod.yml}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-angren}"
STATE_DIR="${STATE_DIR:-$ORACLE_DIR/.state}"

log()  { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
warn() { printf '[%s] WARN: %s\n' "$(date '+%F %T')" "$*" >&2; }
die()  { printf '[%s] ERROR: %s\n' "$(date '+%F %T')" "$*" >&2; exit 1; }

# load_env — exports every KEY=VALUE from ENV_FILE into this shell.
load_env() {
  [[ -f "$ENV_FILE" ]] || die "env file not found: $ENV_FILE (copy .env.prod.example)"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

# telegram_notify <text> — logs it and, when TELEGRAM_BOT_TOKEN and
# TELEGRAM_CHAT_ID are set, sends it to Telegram. Never fails the caller.
telegram_notify() {
  log "$1"
  [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]] || return 0
  curl -sS -m 10 -o /dev/null \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$1" || warn "telegram send failed"
}

# dc <compose args...> — docker compose bound to the prod file + env file.
dc() {
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE_PATH" --env-file "$ENV_FILE" "$@"
}

# wait_healthy <service> [timeout_seconds]
wait_healthy() {
  local svc="$1" timeout="${2:-180}" waited=0 cid status
  cid="$(dc ps -q "$svc")"
  [[ -n "$cid" ]] || die "service $svc is not running"
  while (( waited < timeout )); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo missing)"
    case "$status" in
      healthy|running) log "$svc: $status"; return 0 ;;
      unhealthy|exited|dead|missing) warn "$svc: $status"; return 1 ;;
    esac
    sleep 5
    waited=$((waited + 5))
  done
  warn "$svc: not healthy after ${timeout}s (last: $status)"
  return 1
}

# psql_exec <sql> — run SQL as DB_USER inside the postgres container.
psql_exec() {
  dc exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "${2:-$DB_NAME}" -tAc "$1"
}

# r2_env — rclone remote "r2" defined purely through env (no config file on
# disk) from the BACKUP_S3_* variables.
# NO_HEAD: rclone 1.60 (Ubuntu apt) re-reads every upload with
# `HEAD ?versionId=`, which R2 answers 501 Not Implemented — the upload itself
# succeeded, but the copy is reported failed and retried. R2 already verifies
# the Content-MD5 rclone sends with the PUT, so the extra HEAD adds nothing.
r2_env() {
  export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    RCLONE_CONFIG_R2_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:?BACKUP_S3_ACCESS_KEY_ID not set}" \
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:?BACKUP_S3_SECRET_ACCESS_KEY not set}" \
    RCLONE_CONFIG_R2_ENDPOINT="${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT not set}" \
    RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true RCLONE_CONFIG_R2_NO_HEAD=true
}
