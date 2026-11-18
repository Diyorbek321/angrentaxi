#!/usr/bin/env bash
# Telefondan Play skrinshotlarini oladi (USB debugging, adb).
#
# Telefonda DEMO ilova o'rnatilgan bo'lsin (store/tool/build_demo.sh) — u
# serversiz, tayyor ma'lumot va avtomatik safar bilan ishlaydi, shuning uchun
# skrinshotlarda haqiqiy mijozlarning ma'lumoti chiqmaydi.
#
# Ishlatish (mobile/ ichidan):
#   store/tool/capture.sh passenger     # yoki: driver
# Har kadr uchun: telefonda kerakli ekranni oching → kompyuterda Enter.
# "s" — o'tkazib yuborish, "r" — qayta olish. Keyin: python3 store/tool/frame.py
set -euo pipefail
cd "$(dirname "$0")/../.."

app="${1:?ilova: passenger yoki driver}"
adb="${ADB:-$HOME/android-sdk/platform-tools/adb}"
out="store/screenshots/raw/$app"
mkdir -p "$out"

if ! "$adb" get-state >/dev/null 2>&1; then
  echo "❌ Telefon ulanmagan. USB debugging'ni yoqing va kabel bilan ulang ('$adb devices')." >&2
  exit 1
fi

# Toza status bar: soat 10:00, to'liq batareya, bildirishnomalar yo'q.
"$adb" shell settings put global sysui_demo_allowed 1 >/dev/null
for cmd in "enter" "clock -e hhmm 1000" "battery -e level 100 -e plugged false" \
           "network -e mobile show -e level 4 -e datatype lte" "notifications -e visible false"; do
  set -- $cmd
  "$adb" shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null
done
trap '"$adb" shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null' EXIT

# Kadrlar ro'yxati frame.py dagi SHOTS bilan bir xil.
mapfile -t shots < <(python3 - "$app" <<'PY'
import sys, pathlib
sys.path.insert(0, "store/tool")
from frame import SHOTS
for name, uz, _ in SHOTS[sys.argv[1]]:
    print(f"{name}\t{uz}")
PY
)

for line in "${shots[@]}"; do
  name="${line%%$'\t'*}"; caption="${line#*$'\t'}"
  while true; do
    read -r -p "[$name] «$caption» ekranini oching → Enter (s=o'tkazish): " ans
    [[ "$ans" == "s" ]] && break
    "$adb" exec-out screencap -p > "$out/$name.png"
    echo "  ✓ $out/$name.png"
    read -r -p "  Yaxshimi? Enter=ha, r=qayta: " again
    [[ "$again" == "r" ]] || break
  done
done

echo "Tayyor. Ramkaga joylash: python3 store/tool/frame.py"
