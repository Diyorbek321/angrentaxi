#!/usr/bin/env python3
"""Xom telefon skrinshotlarini Play Market ramkasiga joylaydi (1080×1920).

NEGA KERAK. Telefon skrinshoti 1080×2340 — Play "uzun tomon qisqasidan 2
baravardan oshmasin" talabidan o'tmaydi (2340/1080 = 2.17). Ramka 9:16 ga
keltiradi va har kadrga sarlavha qo'shadi.

    python3 store/tool/frame.py            # mobile/ ichidan

Kirish:  store/screenshots/raw/<app>/<NN>_<nom>.png   (SHOTS dagi nomlar)
Chiqish: store/screenshots/final/<app>-<lang>/<NN>.png
Yo'q xom fayl o'tkazib yuboriladi va ro'yxatda ko'rsatiladi.
"""
from __future__ import annotations

import base64
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from graphics import BRAND_INK, BRAND_GREEN, ICON_YELLOW, ROOT, render  # noqa: E402

RAW = ROOT / "store" / "screenshots" / "raw"
FINAL = ROOT / "store" / "screenshots" / "final"

# Kadrlar tartibi = do'kondagi tartib. Birinchi 2–3 kadr eng muhim: ko'pchilik
# faqat ularni ko'radi. Sarlavha — foyda, funksiya nomi emas.
SHOTS: dict[str, list[tuple[str, str, str]]] = {
    "passenger": [
        ("01_home", "Taksi, yuk, posilka va ovqat", "Такси, грузы, посылки и еда"),
        ("02_tariff", "Narx buyurtmadan oldin ma'lum", "Цена известна до заказа"),
        ("03_assigned", "Haydovchi va avtomobil oldindan ma'lum", "Водитель и машина известны заранее"),
        ("04_in_progress", "Safar davomida SOS tugmasi", "Кнопка SOS во время поездки"),
        ("05_rating", "Safardan keyin haydovchini baholang", "Оцените водителя после поездки"),
    ],
    "driver": [
        ("01_online", "Onlayn bo'ling — buyurtmalar keladi", "Выходите на линию — заказы придут"),
        ("02_offer", "Manzil, masofa va narx oldindan", "Адрес, расстояние и цена заранее"),
        ("03_trip", "Safar: manzil, daromad va SOS", "Поездка: адрес, заработок и SOS"),
        ("04_earnings", "Daromad: kun, hafta, oy", "Заработок за день, неделю, месяц"),
    ],
}

THEME = {
    "passenger": f"linear-gradient(160deg, {BRAND_GREEN} 0%, #0A5E3C 100%)",
    "driver": f"linear-gradient(160deg, {BRAND_INK} 0%, #1B2E38 100%)",
}


def frame_html(app: str, caption: str, shot: pathlib.Path) -> str:
    img = base64.b64encode(shot.read_bytes()).decode()
    # Telefon ekrani 1080×2340 → kenglik 700 da balandlik ~1517; pastdan
    # biroz kesiladi (ramka tashqarisiga chiqadi) — bu do'konlarda odatiy usul.
    return f"""<div style="position:relative;width:1080px;height:1920px;overflow:hidden;background:{THEME[app]};
font-family:J,Montserrat,sans-serif">
<div style="position:absolute;top:96px;left:50%;width:120px;height:10px;margin-left:-60px;border-radius:5px;
background:{ICON_YELLOW}"></div>
<div style="position:absolute;top:150px;left:80px;right:80px;height:250px;display:flex;align-items:center;
justify-content:center;text-align:center;color:#fff;font-weight:800;font-size:72px;line-height:1.12;
letter-spacing:-1px">{caption}</div>
<img src="data:image/png;base64,{img}" style="position:absolute;left:190px;top:470px;width:700px;
border-radius:48px;border:10px solid #0B1418;box-shadow:0 40px 80px rgba(0,0,0,.45)">
</div>"""


def main() -> None:
    missing: list[str] = []
    for app, shots in SHOTS.items():
        for lang_index, lang in ((1, "uz"), (2, "ru")):
            out_dir = FINAL / f"{app}-{lang}"
            out_dir.mkdir(parents=True, exist_ok=True)
            for shot in shots:
                name = shot[0]
                raw = RAW / app / f"{name}.png"
                if not raw.exists():
                    if lang == "uz":
                        missing.append(f"{app}/{name}.png")
                    continue
                render(frame_html(app, shot[lang_index], raw), 1080, 1920, out_dir / f"{name}.png")
    if missing:
        print("\nHali olinmagan xom skrinshotlar (store/screenshots/raw/):")
        for m in missing:
            print(f"  · {m}")


if __name__ == "__main__":
    main()
