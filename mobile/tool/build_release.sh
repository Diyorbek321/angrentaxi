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
# Play Market uchun APK emas, `flutter build appbundle` — u bo'lishni o'zi
# qiladi (shu bayroqlar bilan, `--split-per-abi` siz).
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

for flavor in passenger driver; do
  echo "==> $flavor"
  flutter build apk --release \
    --flavor "$flavor" -t "lib/main_${flavor}.dart" \
    --split-per-abi \
    --obfuscate --split-debug-info="build/symbols/$flavor" \
    "${defines_args[@]}" \
    --dart-define=API_BASE_URL="$API_BASE_URL" \
    --dart-define=WS_URL="$WS_URL"
done

echo
echo "APK'lar: build/app/outputs/flutter-apk/"
ls -lh build/app/outputs/flutter-apk/*-release.apk
