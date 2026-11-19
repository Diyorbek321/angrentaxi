#!/usr/bin/env bash
# iOS (faqat YO'LOVCHI ilovasi) — App Store'ga yuklanadigan IPA.
#
# Faqat macOS + Xcode'da ishlaydi (Linux'da iOS build qilib bo'lmaydi).
# Odatda Codemagic chaqiradi (repo ildizidagi codemagic.yaml); qo'lda Mac'da:
#
#   API_BASE_URL=https://<domen>/api/v1 WS_URL=https://<domen> tool/build_ios.sh
#
# NEGA FLAVORSIZ. Android'da bitta koddan ikki ilova (passenger/driver)
# flavor bilan yig'iladi. iOS'ga faqat yo'lovchi chiqadi (docs/IOS-RELEASE.md),
# shuning uchun Xcode'da bitta "Runner" sxemasi = yo'lovchi ilovasi
# (`uz.angren.taxi.passenger`). Flavorsiz build pubspec'dagi
# `flavors: [driver]` assetlarini (ovoz bo'laklari) qo'shmaydi — kerak ham emas.
#
# Oldindan kerak:
#   - ios/Runner/GoogleService-Info.plist (Firebase → iOS ilova; push uchun)
#   - imzo: Codemagic avtomatik qiladi; qo'lda — Xcode'da Team tanlangan bo'lsin
#
# Versiya, Sentry va `.env.dart-defines.json` qoidalari tool/build_release.sh
# bilan bir xil: build raqami = git commitlar soni (App Store ham har yuklashda
# oshishini talab qiladi), DSN'siz reliz `ALLOW_NO_SENTRY=1` siz yig'ilmaydi.
# macOS bash 3.2: bo'sh massivni `set -u` bilan yoyish "unbound variable" beradi,
# shuning uchun pastda `${arr[@]+"${arr[@]}"}` shakli.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "$(uname)" != "Darwin" ]]; then
  echo "❌ iOS build faqat macOS'da (Xcode) ishlaydi. Codemagic'dan foydalaning: docs/IOS-RELEASE.md" >&2
  exit 1
fi

: "${API_BASE_URL:?API_BASE_URL berilmagan (https://<domen>/api/v1)}"
: "${WS_URL:?WS_URL berilmagan (https://<domen>)}"

if [[ ! -f ios/Runner/GoogleService-Info.plist ]]; then
  echo "❌ ios/Runner/GoogleService-Info.plist yo'q — push ishlamaydi va Xcode build yiqiladi." >&2
  echo "   Firebase Console → Project settings → iOS ilova (uz.angren.taxi.passenger) → yuklab oling." >&2
  exit 1
fi

defines_file=".env.dart-defines.json"
if [[ ! -f "$defines_file" ]]; then
  echo "⚠️  $defines_file yo'q — xarita kalitisiz build bo'ladi (dart-defines.example.json ga qarang)" >&2
  defines_args=()
else
  defines_args=(--dart-define-from-file="$defines_file")
fi

sentry_args=()
if [[ -n "${SENTRY_DSN:-}" ]]; then
  sentry_args=(--dart-define=SENTRY_DSN="$SENTRY_DSN")
elif [[ ! -f "$defines_file" ]] || ! grep -q '"SENTRY_DSN" *: *"[^"]' "$defines_file"; then
  if [[ "${ALLOW_NO_SENTRY:-}" != "1" ]]; then
    echo "❌ SENTRY_DSN yo'q ($defines_file yoki muhit o'zgaruvchisi)." >&2
    echo "   Yiqilishlarsiz reliz kerak bo'lsa: ALLOW_NO_SENTRY=1" >&2
    exit 1
  fi
  echo "⚠️  SENTRY_DSN'siz build — yiqilishlar yuborilmaydi" >&2
fi

version_name="$(sed -n 's/^version: *//p' pubspec.yaml | cut -d+ -f1)"
build_number="${BUILD_NUMBER:-$(git rev-list --count HEAD)}"
version="${version_name}+${build_number}"
echo "==> iOS yo'lovchi, versiya $version"

export_args=()
if [[ -n "${EXPORT_OPTIONS_PLIST:-}" ]]; then
  export_args=(--export-options-plist="$EXPORT_OPTIONS_PLIST")
fi

flutter build ipa --release \
  -t lib/main_passenger.dart \
  --build-name="$version_name" --build-number="$build_number" \
  --obfuscate --split-debug-info="build/symbols/ios" \
  --extra-gen-snapshot-options=--save-obfuscation-map="build/symbols/ios/obfuscation.map.json" \
  ${export_args[@]+"${export_args[@]}"} \
  ${defines_args[@]+"${defines_args[@]}"} \
  ${sentry_args[@]+"${sentry_args[@]}"} \
  --dart-define=API_BASE_URL="$API_BASE_URL" \
  --dart-define=WS_URL="$WS_URL"

if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
  # Android yo'lovchisi bilan bir xil reliz nomi: <bundleId>@<version>.
  dart run sentry_dart_plugin \
    --sentry-define=release="uz.angren.taxi.passenger@${version}" \
    --sentry-define=upload_debug_symbols=true \
    --sentry-define=upload_source_maps=false \
    --sentry-define=symbols_path="build/symbols/ios" \
    --sentry-define=dart_symbol_map_path="build/symbols/ios/obfuscation.map.json"
fi

echo
echo "IPA (App Store Connect'ga yuklang):"
ls -lh build/ios/ipa/*.ipa
