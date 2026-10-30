#!/usr/bin/env bash
# Skrinshot uchun DEMO APK (serversiz, tayyor ma'lumot, avtomatik safar).
# Do'konga YUKLANMAYDI — faqat telefonga o'rnatib skrinshot olish uchun.
#
#   store/tool/build_demo.sh            # mobile/ ichidan
#   adb install -r build/app/outputs/flutter-apk/app-arm64-v8a-passenger-release.apk
set -euo pipefail
cd "$(dirname "$0")/../.."

defines=()
[[ -f .env.dart-defines.json ]] && defines=(--dart-define-from-file=.env.dart-defines.json)

for flavor in passenger driver; do
  flutter build apk --release --split-per-abi --target-platform android-arm64 \
    --flavor "$flavor" -t "lib/main_${flavor}.dart" \
    "${defines[@]}" --dart-define=DEMO_MODE=true
done
ls -lh build/app/outputs/flutter-apk/*arm64*-release.apk
