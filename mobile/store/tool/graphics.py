#!/usr/bin/env python3
"""Play Market grafikasi: 512×512 ikonka va 1024×500 banner (uz/ru).

HTML shablon → headless Chrome → PNG. Shrift — ilovaning o'zi
(assets/google_fonts/PlusJakartaSans); unda kirill yo'q, shuning uchun ruscha
matn Montserrat'ga tushadi. Ranglar — app_theme.dart va ilova ikonkasidan. Matn yoki rangni o'zgartirsangiz, shu skriptni qayta ishga tushiring:

    python3 store/tool/graphics.py          # mobile/ ichidan

Natija: store/graphics/
"""
from __future__ import annotations

import base64
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]  # mobile/
OUT = ROOT / "store" / "graphics"
FONT_DIR = ROOT / "assets" / "google_fonts"
CHROME = "google-chrome"

# Ilova ikonkasi (mipmap) ranglari va app_theme.dart.
ICON_YELLOW = "#F5C518"
ICON_INK = "#1A1A1A"
BRAND_GREEN = "#0C7A4D"
BRAND_INK = "#0F1B22"

BANNERS = {
    "passenger": {
        "bg": f"linear-gradient(120deg, {BRAND_GREEN} 0%, #0A5E3C 100%)",
        "accent": ICON_YELLOW,
        "car": "car_comfort.svg",
        "uz": ("Angren Taxi", "Taksi · Yuk · Posilka · Ovqat", "Narx buyurtmadan oldin ma'lum"),
        "ru": ("Angren Taxi", "Такси · Грузы · Посылки · Еда", "Цена известна до заказа"),
    },
    "driver": {
        "bg": f"linear-gradient(120deg, {BRAND_INK} 0%, #1B2E38 100%)",
        "accent": ICON_YELLOW,
        "car": "car_econom.svg",
        "uz": ("Angren Taxi Driver", "Buyurtma · Navigatsiya · Daromad", "Angrenda haydovchi bo'lib ishlang"),
        "ru": ("Angren Taxi Driver", "Заказы · Навигация · Заработок", "Работайте водителем в Ангрене"),
    },
}


def font_face() -> str:
    faces = []
    for weight, name in [(500, "Medium"), (700, "Bold"), (800, "ExtraBold")]:
        data = base64.b64encode((FONT_DIR / f"PlusJakartaSans-{name}.ttf").read_bytes()).decode()
        faces.append(
            f"@font-face{{font-family:J;font-weight:{weight};src:url(data:font/ttf;base64,{data})}}"
        )
    return "".join(faces)


def svg_data(name: str) -> str:
    data = base64.b64encode((ROOT / "assets" / "tariffs" / name).read_bytes()).decode()
    return f"data:image/svg+xml;base64,{data}"


def icon_html(size: int, radius: int = 0) -> str:
    # Play o'zi burchaklarni yumaloqlaydi — yuklanadigan ikonka to'liq kvadrat.
    # Shrift — ilova launcher ikonkasidagi kabi Arial o'lchamli qalin grotesk.
    return f"""<div style="width:{size}px;height:{size}px;background:{ICON_YELLOW};border-radius:{radius}px;
display:flex;align-items:center;justify-content:center;font:700 {int(size * 0.5)}px/1 'Liberation Sans',Arial,sans-serif;
color:{ICON_INK};letter-spacing:-{size * 0.01:.1f}px">AT</div>"""


# Shahar ko'chalari va marshrut — bezak (haqiqiy xarita emas, ilova skrinshoti ham emas).
MAP_SVG = """<svg width="560" height="500" viewBox="0 0 560 500" xmlns="http://www.w3.org/2000/svg">
<g stroke="rgba(255,255,255,.10)" stroke-width="14" fill="none" stroke-linecap="round">
<path d="M0 120 L560 90"/><path d="M0 300 L560 260"/><path d="M0 440 L560 420"/>
<path d="M120 0 L170 500"/><path d="M300 0 L330 500"/><path d="M470 0 L500 500"/></g>
<g stroke="rgba(255,255,255,.06)" stroke-width="6" fill="none">
<path d="M0 200 L560 175"/><path d="M220 0 L245 500"/><path d="M390 0 L410 500"/></g>
<path d="M150 400 C 160 300, 240 300, 312 270 S 470 180, 480 110" stroke="ACCENT" stroke-width="9"
 fill="none" stroke-linecap="round" stroke-dasharray="2 18"/>
<circle cx="150" cy="400" r="16" fill="#fff"/><circle cx="150" cy="400" r="7" fill="ACCENT"/>
<path d="M480 60 c-22 0-36 16-36 34 0 26 36 58 36 58 s36-32 36-58 c0-18-14-34-36-34z" fill="ACCENT"/>
<circle cx="480" cy="94" r="12" fill="INK"/></svg>"""


def banner_html(app: str, lang: str) -> str:
    cfg = BANNERS[app]
    title, services, tagline = cfg[lang]
    map_svg = MAP_SVG.replace("ACCENT", cfg["accent"]).replace("INK", BRAND_INK)
    return f"""<div style="position:relative;width:1024px;height:500px;overflow:hidden;background:{cfg['bg']};font-family:J,Montserrat,sans-serif">
<div style="position:absolute;right:-20px;top:0">{map_svg}</div>
<img src="{svg_data(cfg['car'])}" style="position:absolute;right:150px;top:250px;width:250px;
filter:drop-shadow(0 18px 24px rgba(0,0,0,.35))">
<div style="position:absolute;left:72px;top:0;height:500px;display:flex;flex-direction:column;justify-content:center;width:520px">
<div style="box-shadow:0 12px 32px rgba(0,0,0,.30);border-radius:28px;width:120px">{icon_html(120, 28)}</div>
<div style="margin-top:28px;color:#fff;font-weight:800;font-size:{56 if len(title) > 12 else 64}px;line-height:1.05;letter-spacing:-1px">{title}</div>
<div style="margin-top:14px;color:{cfg['accent']};font-weight:700;font-size:28px">{services}</div>
<div style="margin-top:10px;color:rgba(255,255,255,.80);font-weight:500;font-size:24px">{tagline}</div>
</div></div>"""


def render(body: str, width: int, height: int, out: pathlib.Path) -> None:
    html = f"<!doctype html><html><head><meta charset='utf-8'><style>{font_face()}html,body{{margin:0}}</style></head><body>{body}</body></html>"
    with tempfile.TemporaryDirectory() as tmp:
        page = pathlib.Path(tmp) / "p.html"
        page.write_text(html, encoding="utf-8")
        subprocess.run(
            [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
             f"--window-size={width},{height}", "--virtual-time-budget=3000",  # shrift yuklanishini kutadi
             f"--screenshot={out}", page.as_uri()],
            check=True, capture_output=True,
        )
    print(f"✓ {out}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Ikkala ilova bir xil launcher ikonkasidan foydalanadi (mipmap faqat main/ da).
    render(icon_html(512), 512, 512, OUT / "icon-512.png")
    for app in BANNERS:
        for lang in ("uz", "ru"):
            render(banner_html(app, lang), 1024, 500, OUT / f"feature-{app}-{lang}.png")


if __name__ == "__main__":
    main()
