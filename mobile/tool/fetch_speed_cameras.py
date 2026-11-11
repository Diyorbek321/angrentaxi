#!/usr/bin/env python3
"""Tezlik kameralarini OpenStreetMap'dan `assets/map/speed_cameras.json` ga yozadi.

Telefon radar signalini ushlay olmaydi — ogohlantirish GPS + kameralar
bazasi bilan ishlaydi (Yandex Navigator, Waze ham shunday). Baza ilovaga
joylanadi: serversiz va internetsiz ishlaydi. Yangilash — shu skriptni
qayta ishga tushirib, yangi build.

Hudud: Toshkent viloyati + Toshkent (Angren–Toshkent yo'li va shaharlararo
qatnov). Ma'lumot © OpenStreetMap contributors, ODbL.

Ishga tushirish (mobile/ dan):  python3 tool/fetch_speed_cameras.py
"""
import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "map" / "speed_cameras.json"

# janub, g'arb, shimol, sharq
BBOX = (40.55, 68.6, 41.75, 70.65)

QUERY = f"""[out:json][timeout:120];
node["highway"="speed_camera"]{BBOX};
out;"""

# Bir joyga ikki marta chizilgan kameralar (OSM'da tez-tez) — birlashtiriladi.
MERGE_METERS = 30


def meters(a, b):
    lat = math.radians((a[0] + b[0]) / 2)
    dx = (a[1] - b[1]) * 111_320 * math.cos(lat)
    dy = (a[0] - b[0]) * 110_540
    return math.hypot(dx, dy)


def max_speed(tags):
    raw = tags.get("maxspeed", "").strip()
    return int(raw) if raw.isdigit() and 5 <= int(raw) <= 150 else None


def main():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=data,
        headers={"User-Agent": "AngrenTaxi-dev/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        elements = json.load(res)["elements"]

    cameras = []
    for e in sorted(elements, key=lambda e: e["id"]):
        point = (round(e["lat"], 6), round(e["lon"], 6))
        speed = max_speed(e.get("tags", {}))
        twin = next((c for c in cameras if meters(c, point) < MERGE_METERS), None)
        if twin is not None:
            # Tezligi bor nusxa afzal.
            if twin[2] is None and speed is not None:
                twin[2] = speed
            continue
        cameras.append([point[0], point[1], speed])

    OUT.write_text(
        json.dumps(
            {
                "source": "© OpenStreetMap contributors, ODbL",
                "bbox": BBOX,
                "fields": ["lat", "lng", "maxSpeedKmh"],
                "cameras": cameras,
            },
            separators=(",", ":"),
        )
        + "\n"
    )
    print(f"{len(elements)} OSM nuqta → {len(cameras)} kamera: {OUT}")


if __name__ == "__main__":
    main()
