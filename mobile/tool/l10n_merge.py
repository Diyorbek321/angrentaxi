#!/usr/bin/env python3
"""Merges lib/l10n/parts/*.uz.json and *.ru.json into the two ARB files.

Why fragments: translation work is split by feature area, and one shared ARB
edited by several hands at once loses keys. Each area owns
`lib/l10n/parts/<area>.uz.json` (+ `.ru.json`); this script is the only thing
that writes `app_uz.arb` / `app_ru.arb`.

Rules it enforces (fails loudly, never guesses):
  * a key may live in exactly one fragment;
  * every key in a `.uz.json` must have a Russian translation and vice versa;
  * placeholder metadata ("@key") lives in the Uzbek (template) fragment.

Run after editing any fragment, then `flutter gen-l10n`:
    python3 tool/l10n_merge.py && flutter gen-l10n
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PARTS = ROOT / "lib" / "l10n" / "parts"
OUT = ROOT / "lib" / "l10n"


def load(path: pathlib.Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    merged = {"uz": {"@@locale": "uz"}, "ru": {"@@locale": "ru"}}
    owner: dict[str, str] = {}
    errors: list[str] = []

    areas = sorted({p.name.split(".")[0] for p in PARTS.glob("*.json")})
    for area in areas:
        uz_path, ru_path = PARTS / f"{area}.uz.json", PARTS / f"{area}.ru.json"
        if not uz_path.exists() or not ru_path.exists():
            errors.append(f"{area}: both {area}.uz.json and {area}.ru.json are required")
            continue
        uz, ru = load(uz_path), load(ru_path)
        uz_keys = {k for k in uz if not k.startswith("@")}
        ru_keys = {k for k in ru if not k.startswith("@")}
        for k in sorted(uz_keys - ru_keys):
            errors.append(f"{area}: '{k}' has no Russian translation")
        for k in sorted(ru_keys - uz_keys):
            errors.append(f"{area}: '{k}' is only in the Russian fragment")
        for k in uz_keys:
            if k in owner:
                errors.append(f"'{k}' defined in both {owner[k]} and {area}")
            owner[k] = area
        merged["uz"].update(uz)
        merged["ru"].update({k: v for k, v in ru.items() if not k.startswith("@")})

    if errors:
        print("l10n_merge: FAILED", file=sys.stderr)
        for e in errors:
            print("  - " + e, file=sys.stderr)
        return 1

    for locale in ("uz", "ru"):
        data = merged[locale]
        ordered = {"@@locale": data.pop("@@locale")}
        for key in sorted(k for k in data if not k.startswith("@")):
            ordered[key] = data[key]
            meta = f"@{key}"
            if meta in data:
                ordered[meta] = data[meta]
        (OUT / f"app_{locale}.arb").write_text(
            json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(f"l10n_merge: {len(owner)} keys from {len(areas)} areas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
