#!/usr/bin/env bash
# Runs every minute (install-timers.sh). Checks the public health endpoint and
# the container health states; after ALERT_AFTER_FAILURES consecutive failures
# sends ONE Telegram alert, and one "recovered" message when it comes back.
# Telegram is optional — without TELEGRAM_* it only logs to the journal.
set -uo pipefail
. "$(dirname "$0")/lib.sh"
load_env

threshold="${ALERT_AFTER_FAILURES:-3}"
url="${HEALTH_URL:-https://api.${DOMAIN}/api/v1/health}"
mkdir -p "$STATE_DIR"
count_file="$STATE_DIR/health-failures"
alerted_file="$STATE_DIR/health-alerted"

notify() {
  log "$1"
  [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]] || return 0
  curl -sS -m 10 -o /dev/null \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$1" || warn "telegram send failed"
}

problems=()
code="$(curl -sS -o /dev/null -m 10 -w '%{http_code}' "$url" 2>/dev/null)" || code=000
[[ "$code" == "200" ]] || problems+=("health $url -> $code")

# Any container reporting unhealthy / restarting.
while read -r name state; do
  [[ -n "$name" ]] && problems+=("$name: $state")
done < <(docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" \
           --format '{{.Names}} {{.Status}}' | grep -Ei 'unhealthy|restarting|exited' || true)

fails="$(cat "$count_file" 2>/dev/null || echo 0)"
if (( ${#problems[@]} == 0 )); then
  if [[ -f "$alerted_file" ]]; then
    notify "✅ Angren ($DOMAIN): tiklandi — health OK"
    rm -f "$alerted_file"
  fi
  echo 0 > "$count_file"
  exit 0
fi

fails=$((fails + 1))
echo "$fails" > "$count_file"
warn "check failed ($fails/$threshold): ${problems[*]}"
if (( fails >= threshold )) && [[ ! -f "$alerted_file" ]]; then
  notify "🚨 Angren ($DOMAIN): ${fails} marta ketma-ket xato
$(printf '• %s\n' "${problems[@]}")
Server: $(hostname), $(date '+%F %T')"
  touch "$alerted_file"
fi
exit 1
