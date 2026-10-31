#!/usr/bin/env bash
# Ikkala ilovaning release APK'larini ABI bo'yicha bo'lingan holda yig'adi.
#
# NEGA BO'LINGAN. Oddiy `flutter build apk` uchala protsessor (arm64,
# armv7, x86_64) kodini bitta faylga tiqadi — ~68 MB. Telefon esa faqat
# bittasini ishlatadi. `--split-per-abi` har biriga alohida APK beradi:
# yuklab olish va o'rnatish 2–3 baravar kichik va tez. Deyarli barcha
# hozirgi telefonlar — `arm64-v8a`; eski arzon telefonlar — `armeabi-v7a`.
#
# `--obfuscate` Dart kodidagi nomlarni qisqartiradi (kichikroq va
# o'qish qiyinroq). Xato steklarini o'qish uchun simvollar
# `build/symbols/<flavor>/` da qoladi — ularni har reliz uchun saqlang:
#   flutter symbolize -i <stack.txt> -d build/symbols/<flavor>/app.android-arm64.symbols
#
# PLAY MARKET: `BUNDLE=1` — APK o'rniga AAB (`flutter build appbundle`).
# Play bo'lishni o'zi qiladi, shuning uchun `--split-per-abi` siz. Natija:
# build/app/outputs/bundle/<flavor>Release/app-<flavor>-release.aab
#
# Sentry: `SENTRY_DSN` ni `.env.dart-defines.json` ga yozing — ilova
# yiqilishlarni yuboradi. `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
# ham berilsa, har reliz simvollari va obfuskatsiya xaritasi Sentry'ga
# yuklanadi (aks holda Sentry'dagi stek o'qib bo'lmas bo'ladi).
#
# VERSIYA. `versionCode` (Android) har reliz OSHISHI shart: aks holda Play
# yangilanishni rad etadi, telefon esa eski APK ustiga o'rnatmaydi, Sentry va
# support buildlarni ajrata olmaydi. Avtomatik — git'dagi commitlar soni
# (`main` dan yig'ing); qo'lda berish: `BUILD_NUMBER=123`.
#
# Sentry DSN'siz reliz yig'ilmaydi — production'dagi yiqilishlar ko'rinmay
# qolardi. Ataylab DSN'siz (masalan ichki test) yig'ish: `ALLOW_NO_SENTRY=1`.
#
# Ishlatish (mobile/ ichidan):
#   API_BASE_URL=https://<domen>/api/v1 WS_URL=https://<domen> tool/build_release.sh
set -euo pipefail

cd "$(dirname "$0")/.."

: "${API_BASE_URL:?API_BASE_URL berilmagan (https://<domen>/api/v1)}"
: "${WS_URL:?WS_URL berilmagan (https://<domen>)}"

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
# sentry_flutter relizni `<applicationId>@<name>+<code>` deb nomlaydi.
version="${version_name}+${build_number}"
echo "==> versiya $version"

if [[ "${BUNDLE:-0}" == "1" ]]; then
  build_cmd=(flutter build appbundle --release)
else
  build_cmd=(flutter build apk --release --split-per-abi)
fi

for flavor in passenger driver; do
  echo "==> $flavor"
  "${build_cmd[@]}" \
    --flavor "$flavor" -t "lib/main_${flavor}.dart" \
    --build-name="$version_name" --build-number="$build_number" \
    --obfuscate --split-debug-info="build/symbols/$flavor" \
    --extra-gen-snapshot-options=--save-obfuscation-map="build/symbols/$flavor/obfuscation.map.json" \
    "${defines_args[@]}" \
    "${sentry_args[@]}" \
    --dart-define=API_BASE_URL="$API_BASE_URL" \
    --dart-define=WS_URL="$WS_URL"

  if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
    # Reliz nomi ilovaniki bilan bir xil bo'lishi shart: <applicationId>@<version>.
    dart run sentry_dart_plugin \
      --sentry-define=release="uz.angren.taxi.${flavor}@${version}" \
      --sentry-define=upload_debug_symbols=true \
      --sentry-define=upload_source_maps=false \
      --sentry-define=symbols_path="build/symbols/$flavor" \
      --sentry-define=dart_symbol_map_path="build/symbols/$flavor/obfuscation.map.json"
  fi
done

echo
if [[ "${BUNDLE:-0}" == "1" ]]; then
  echo "AAB'lar (Play Console'ga yuklang):"
  ls -lh build/app/outputs/bundle/*Release/*.aab
else
  echo "APK'lar: build/app/outputs/flutter-apk/"
  ls -lh build/app/outputs/flutter-apk/*-release.apk
fi
