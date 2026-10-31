#!/usr/bin/env bash
# Deploy'dan keyingi tez tekshiruv (smoke test). Faqat O'QIYDI — bazaga hech
# narsa yozmaydi, SMS yubormaydi, shuning uchun production'da xavfsiz.
#
#   API_URL=https://angrentaxi-production.up.railway.app/api/v1 \
#   PANEL_URLS="https://web-admin-....up.railway.app https://web-manager-..." \
#   ./scripts/smoke.sh
#
# Ixtiyoriy: SMOKE_TOKEN=<access token> — kirgan foydalanuvchi bilan /users/me.
# Chiqish kodi: 0 — hammasi yaxshi, 1 — kamida bitta tekshiruv yiqildi.
set -uo pipefail

API_URL="${API_URL:-http://localhost:3000/api/v1}"
API_URL="${API_URL%/}"
PANEL_URLS="${PANEL_URLS:-}"
SMOKE_TOKEN="${SMOKE_TOKEN:-}"
TIMEOUT="${SMOKE_TIMEOUT:-10}"

failures=0
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

# check <nomi> <kutilgan kod> <url> [qo'shimcha curl argumentlari...]
check() {
  local name="$1" expected="$2" url="$3"
  shift 3
  local code
  code="$(curl -sS -o "$body_file" -w '%{http_code}' -m "$TIMEOUT" "$@" "$url" 2>/dev/null)" || code="000"
  if [[ "$code" == "$expected" ]]; then
    printf '  ✅ %-34s %s\n' "$name" "$code"
    return 0
  fi
  printf '  ❌ %-34s kutilgan %s, keldi %s  (%s)\n' "$name" "$expected" "$code" "$url"
  failures=$((failures + 1))
  return 1
}

# body_has <nomi> <matn> — oxirgi javob tanasida matn borligini tekshiradi.
body_has() {
  local name="$1" needle="$2"
  if grep -q -- "$needle" "$body_file"; then
    printf '  ✅ %-34s\n' "$name"
  else
    printf '  ❌ %-34s javobda %s yo'"'"'q\n' "$name" "$needle"
    failures=$((failures + 1))
  fi
}

echo "Backend: $API_URL"
check "liveness /health" 200 "$API_URL/health"
if check "readiness /health/ready" 200 "$API_URL/health/ready"; then
  body_has "  Postgres va Redis up" '"status":"ok"'
fi
if check "ochiq tariflar /tariffs" 200 "$API_URL/tariffs"; then
  body_has "  kamida bitta taksi tarifi" '"serviceType":"taxi"'
fi
# 401 — ilova ishga tushgan va auth guard ishlayapti; 500 bo'lsa boot buzilgan.
check "himoyalangan /users/me (tokensiz)" 401 "$API_URL/users/me"
if [[ -n "$SMOKE_TOKEN" ]]; then
  check "/users/me (token bilan)" 200 "$API_URL/users/me" -H "Authorization: Bearer $SMOKE_TOKEN"
fi

if [[ -n "$PANEL_URLS" ]]; then
  echo "Panellar:"
  for panel in $PANEL_URLS; do
    check "${panel#https://}/login" 200 "${panel%/}/login"
  done
fi

echo
if (( failures > 0 )); then
  echo "SMOKE: $failures ta tekshiruv yiqildi"
  exit 1
fi
echo "SMOKE: hammasi yaxshi"
