#!/usr/bin/env python3
"""
Navigatsiya ovoz bo'laklarini Microsoft Azure neyron ovozi bilan yaratadi.

  python3 tool/generate_voice_clips.py --dry-run   # faqat matnlarni ko'rsatadi
  python3 tool/generate_voice_clips.py             # assets/voice/<til>/<id>.mp3
  python3 tool/generate_voice_clips.py --force     # mavjudlarini ham qayta yaratadi

Kalit: muhit o'zgaruvchilari AZURE_TTS_KEY va AZURE_TTS_REGION, yoki
mobile/.env.voice fayli (git'ga KIRMAYDI):
  AZURE_TTS_KEY=...
  AZURE_TTS_REGION=westeurope

Bo'laklar ro'yxati — tool/voice_clip_catalogue.json (Dart bilan yagona manba),
matnlar — lib/l10n/app_<til>.arb. Ilova bo'laklarni o'zi topadi; birortasi
yetishmasa o'sha gap TTS bilan aytiladi.
"""
import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = ROOT / "tool" / "voice_clip_catalogue.json"
OUT = ROOT / "assets" / "voice"

# Raqamlar SO'Z bilan: neyron ovoz "500" ni ba'zan ingliz/rus tartibida o'qiydi.
UZ_NUMBERS = {100: "yuz", 500: "besh yuz"}
UZ_ORDINALS = {1: "birinchi", 2: "ikkinchi", 3: "uchinchi", 4: "to'rtinchi", 5: "beshinchi"}
RU_ORDINALS = {1: "первый", 2: "второй", 3: "третий", 4: "четвёртый", 5: "пятый"}


def load_key():
    key, region = os.environ.get("AZURE_TTS_KEY"), os.environ.get("AZURE_TTS_REGION")
    env_file = ROOT / ".env.voice"
    if (not key or not region) and env_file.exists():
        for line in env_file.read_text().splitlines():
            name, _, value = line.partition("=")
            if name.strip() == "AZURE_TTS_KEY":
                key = key or value.strip()
            if name.strip() == "AZURE_TTS_REGION":
                region = region or value.strip()
    return key, region


def distance_prefix(arb, lang, meters):
    """'{meters} metrdan keyin {instruction}' → 'yuz metrdan keyin'."""
    number = UZ_NUMBERS.get(meters, str(meters)) if lang == "uz" else str(meters)
    return arb["shManeuverInDistance"].replace("{instruction}", "").replace("{meters}", number).strip()


def text_for(clip, arb, lang):
    key = clip["arb"]
    if clip.get("part") == "prefix":
        return distance_prefix(arb, lang, clip["meters"])
    if clip.get("part") == "suffix":
        # '{meters} metrdan keyin manzilga yetib borasiz' → 'manzilga yetib borasiz'
        prefix = arb["shManeuverInDistance"].replace("{instruction}", "").strip()
        return arb[key].replace(prefix, "").strip()
    if "exit" in clip:
        n = clip["exit"]
        if lang == "uz":
            return arb[key].replace("{exit}-", UZ_ORDINALS[n] + " ")
        return arb[key].replace("{exit}-й", RU_ORDINALS[n])
    return arb[key]


def synthesize(text, voice, lang_tag, key, region):
    ssml = (
        f"<speak version='1.0' xml:lang='{lang_tag}'><voice name='{voice}'>"
        f"<prosody rate='-5%'>{escape(text)}</prosody></voice></speak>"
    )
    req = urllib.request.Request(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "angren-taxi-voice",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    catalogue = json.loads(CATALOGUE.read_text())
    key, region = load_key()
    if not args.dry_run and (not key or not region):
        sys.exit("AZURE_TTS_KEY va AZURE_TTS_REGION kerak (muhit yoki mobile/.env.voice)")

    made = skipped = 0
    for lang, voice in catalogue["languages"].items():
        arb = json.loads((ROOT / "lib" / "l10n" / f"app_{lang}.arb").read_text())
        out_dir = OUT / lang
        out_dir.mkdir(parents=True, exist_ok=True)
        for clip in catalogue["clips"]:
            text = text_for(clip, arb, lang)
            target = out_dir / f"{clip['id']}.mp3"
            if args.dry_run:
                print(f"{lang}/{clip['id']:<28} {text}")
                continue
            if target.exists() and not args.force:
                skipped += 1
                continue
            target.write_bytes(synthesize(text, voice, voice[:5], key, region))
            made += 1
            print(f"✓ {lang}/{clip['id']}: {text}")
    if not args.dry_run:
        print(f"Tayyor: {made} ta yaratildi, {skipped} ta allaqachon bor edi.")


if __name__ == "__main__":
    main()
