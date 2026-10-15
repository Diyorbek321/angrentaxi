#!/usr/bin/env bash
# Build + (re)deploy the stack on the VM from a git branch, tag or commit.
#
#   deploy/oracle/deploy.sh main            # latest main
#   deploy/oracle/deploy.sh v1.4.0          # a tag
#   deploy/oracle/deploy.sh --rollback      # previous successful deploy
#   SKIP_BACKUP=1 deploy/oracle/deploy.sh main
#
# Steps: fetch + checkout (detached) → pre-deploy DB backup → build images
# tagged with the commit sha → start data services → backend (migrations run
# on boot; we wait for its healthcheck) → panels one by one → Caddy → smoke.
#
# Each service is replaced in place, so expect a few seconds of 502 per
# service (single replica; socket.io clients reconnect by themselves).
#
# ROLLBACK: `--rollback` re-checks-out the previous successful commit and
# starts its images (kept locally, no rebuild). Database migrations are
# forward-only — if the release you are rolling back from ran a migration that
# the old code cannot live with, restore the pre-deploy dump instead:
#   deploy/oracle/restore.sh "$BACKUP_DIR/predeploy/<file>.dump"
set -euo pipefail
. "$(dirname "$0")/lib.sh"

HISTORY="$STATE_DIR/deploy-history"
mkdir -p "$STATE_DIR"
load_env

ref="${1:-main}"
cd "$REPO_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  die "uncommitted changes in $REPO_DIR — the VM checkout must stay clean"
fi

if [[ "$ref" == "--rollback" ]]; then
  [[ -f "$HISTORY" ]] || die "no deploy history yet"
  current="$(git rev-parse --short HEAD)"
  sha="$(grep -v "^${current}$" "$HISTORY" | tail -n 1 || true)"
  [[ -n "$sha" ]] || die "no previous deploy to roll back to"
  log "rolling back $current -> $sha"
  rollback=1
else
  log "fetching $ref"
  git fetch --tags --prune origin
  if git rev-parse -q --verify "origin/$ref^{commit}" >/dev/null; then
    sha="$(git rev-parse --short "origin/$ref")"
  else
    sha="$(git rev-parse --short "$ref^{commit}")" || die "unknown ref: $ref"
  fi
  rollback=0
fi

prev="$(git rev-parse --short HEAD)"
git checkout -q --detach "$sha"
export IMAGE_TAG="$sha"
log "deploying commit $sha (was $prev)"

# --- pre-deploy backup (only if the DB is already running) ------------------
if [[ "${SKIP_BACKUP:-0}" != "1" ]] && [[ -n "$(dc ps -q postgres 2>/dev/null)" ]]; then
  log "pre-deploy backup"
  BACKUP_KIND=predeploy "$ORACLE_DIR/backup.sh" --local-only \
    || die "pre-deploy backup failed — aborting (SKIP_BACKUP=1 to force)"
fi

# --- build ------------------------------------------------------------------
images_present() {
  local s
  for s in backend web-admin web-manager web-market web-restaurant osrm; do
    docker image inspect "angren/$s:$IMAGE_TAG" >/dev/null 2>&1 || return 1
  done
}
if [[ "$rollback" == "1" ]] && images_present; then
  log "images for $sha still present — skipping build"
else
  log "building images (sequential: Next.js builds are RAM-hungry)"
  for s in backend osrm web-admin web-manager web-market web-restaurant; do
    log "build $s"
    dc build "$s"
  done
fi

# --- roll out ---------------------------------------------------------------
log "data services"
dc up -d postgres redis osrm
wait_healthy postgres 120 || die "postgres unhealthy"
wait_healthy redis 60 || die "redis unhealthy"

log "backend (runs pending migrations on boot)"
dc up -d --no-deps backend
if ! wait_healthy backend 300; then
  dc logs --tail 80 backend >&2
  die "backend unhealthy on $sha — run: deploy/oracle/deploy.sh --rollback"
fi

for s in web-admin web-manager web-market web-restaurant; do
  log "$s"
  dc up -d --no-deps "$s"
  wait_healthy "$s" 120 || { dc logs --tail 40 "$s" >&2; die "$s unhealthy"; }
done

log "caddy"
dc up -d --no-deps caddy
# Pick up Caddyfile edits without dropping connections.
dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
wait_healthy osrm 300 || warn "osrm not healthy yet — backend falls back to straight-line"

# --- record + smoke ---------------------------------------------------------
if [[ "$rollback" == "0" ]]; then
  echo "$sha" >> "$HISTORY"
else
  # Drop the bad release from history so a second --rollback goes further back.
  grep -v "^${prev}$" "$HISTORY" > "$HISTORY.tmp" || true
  mv "$HISTORY.tmp" "$HISTORY"
fi

log "smoke test"
API_URL="https://api.${DOMAIN}/api/v1" \
PANEL_URLS="https://admin.${DOMAIN} https://manager.${DOMAIN} https://market.${DOMAIN} https://restaurant.${DOMAIN}" \
  "$REPO_DIR/scripts/smoke.sh" || die "smoke failed on $sha — inspect, then: deploy/oracle/deploy.sh --rollback"

log "pruning dangling images (keeps tagged releases for rollback)"
docker image prune -f >/dev/null
# Keep only the last 3 release tags per service.
for s in backend web-admin web-manager web-market web-restaurant osrm; do
  docker image ls "angren/$s" --format '{{.CreatedAt}}\t{{.Tag}}' \
    | sort -r | awk -F'\t' 'NR>3 {print $2}' \
    | while read -r tag; do docker image rm "angren/$s:$tag" >/dev/null 2>&1 || true; done
done

log "deployed $sha"
