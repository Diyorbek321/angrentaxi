#!/usr/bin/env python3
"""Xarita marker ikonalarini `assets/map/marker_*.png` ga chizadi.

Nega generator: ikonalar oddiy geometriya, lekin o'lchami MUHIM. Ilgari
ular 56–96 px edi va `iconSize: 0.5` bilan 3x ekranda 12–16 dp —
nuqtadek — ko'rinardi (Android plagini rasmni ekran zichligida qabul
qiladi: `BitmapFactory` → `bitmap.getDensity()` → MapLibre pixelRatio).

Endi har ikona 3x da chiziladi (1 dp = 3 px) va `AppVectorMap` o'lchamni
qurilma zichligiga moslaydi — natija har telefonda shu dp.

Ishga tushirish (mobile/ dan):  python3 tool/generate_map_markers.py
Talab: Pillow.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SCALE = 3  # asset zichligi: 1 dp = 3 px
SS = 4  # silliq chet uchun ichki kattalashtirish

OUT = Path(__file__).resolve().parent.parent / "assets" / "map"

# Ranglar `lib/core/config/app_theme.dart` va eski ikonalardan.
MINT = (0x1F, 0xCA, 0x8E, 255)
MINT_INK = (0x06, 0x23, 0x1A, 255)
PRIMARY = (0x0C, 0x7A, 0x4D, 255)
DANGER = (0xE5, 0x49, 0x4E, 255)
ME_BLUE = (0x1D, 0x4E, 0xD8, 255)
INK = (0x0F, 0x1B, 0x22, 255)
WHITE = (255, 255, 255, 255)


class Canvas:
    """dp koordinatalarida chizadigan, soyali RGBA tuval."""

    def __init__(self, w_dp: float, h_dp: float):
        self.w_dp, self.h_dp = w_dp, h_dp
        self.k = SCALE * SS
        size = (round(w_dp * self.k), round(h_dp * self.k))
        self.shadow = Image.new("L", size, 0)
        self.body = Image.new("RGBA", size, (0, 0, 0, 0))
        self.sd = ImageDraw.Draw(self.shadow)
        self.d = ImageDraw.Draw(self.body)

    def _box(self, cx, cy, r):
        k = self.k
        return [(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k]

    def circle(self, cx, cy, r, fill):
        self.d.ellipse(self._box(cx, cy, r), fill=fill)

    def polygon(self, pts, fill):
        self.d.polygon([(x * self.k, y * self.k) for x, y in pts], fill=fill)

    def rect(self, x0, y0, x1, y1, fill, radius=0):
        k = self.k
        self.d.rounded_rectangle(
            [x0 * k, y0 * k, x1 * k, y1 * k], radius=radius * k, fill=fill
        )

    def line(self, pts, fill, width):
        k = self.k
        self.d.line(
            [(x * k, y * k) for x, y in pts], fill=fill, width=round(width * k),
            joint="curve",
        )

    def arc(self, cx, cy, r, start, end, fill, width):
        self.d.arc(self._box(cx, cy, r), start, end, fill=fill, width=round(width * self.k))

    def shadow_circle(self, cx, cy, r, alpha=70):
        # Soya biroz pastda — yorug'lik tepadan.
        self.sd.ellipse(self._box(cx, cy + 1.2, r), fill=alpha)

    def shadow_polygon(self, pts, alpha=70):
        self.sd.polygon([(x * self.k, (y + 1.2) * self.k) for x, y in pts], fill=alpha)

    def save(self, name):
        blur = self.shadow.filter(ImageFilter.GaussianBlur(1.6 * self.k))
        out = Image.new("RGBA", self.body.size, (0, 0, 0, 0))
        out.putalpha(blur)
        # Soya qora; tana ustiga qo'yiladi.
        black = Image.new("RGBA", self.body.size, (8, 20, 26, 255))
        black.putalpha(blur)
        out = Image.alpha_composite(black, self.body)
        final = out.resize(
            (round(self.w_dp * SCALE), round(self.h_dp * SCALE)), Image.LANCZOS
        )
        final.save(OUT / name, optimize=True)
        print(f"{name}: {final.size[0]}x{final.size[1]} px")


def car():
    # 44 dp: navigator strelkasi — yuqoriga qaragan, bearing bilan buriladi.
    c = Canvas(44, 44)
    cx = cy = 22
    c.shadow_circle(cx, cy, 18)
    c.circle(cx, cy, 18, WHITE)
    c.circle(cx, cy, 15.5, MINT)
    c.polygon(
        [(cx, cy - 9), (cx + 7, cy + 8), (cx, cy + 4), (cx - 7, cy + 8)], MINT_INK
    )
    c.save("marker_car.png")


def pickup():
    # 32 dp: olish nuqtasi — yashil halqa.
    c = Canvas(32, 32)
    cx = cy = 16
    c.shadow_circle(cx, cy, 12.5)
    c.circle(cx, cy, 12.5, WHITE)
    c.circle(cx, cy, 10.5, PRIMARY)
    c.circle(cx, cy, 4.5, WHITE)
    c.save("marker_pickup.png")


def dropoff():
    # 32x44 dp pin: uchi tuvalning eng pastida (`iconAnchor: bottom`).
    c = Canvas(32, 44)
    cx, cy, r = 16, 15, 12.5
    tail = [(cx - 7.5, cy + 8), (cx + 7.5, cy + 8), (cx, 43)]
    c.shadow_circle(cx, cy, r)
    c.shadow_polygon(tail)
    c.polygon([(cx - 9, cy + 7), (cx + 9, cy + 7), (cx, 43.6)], WHITE)
    c.circle(cx, cy, r, WHITE)
    c.polygon(tail, DANGER)
    c.circle(cx, cy, 10.5, DANGER)
    c.circle(cx, cy, 4.5, WHITE)
    c.save("marker_dropoff.png")


def me():
    # 32 dp: foydalanuvchi — ko'k nuqta va shaffof aniqlik halqasi.
    c = Canvas(32, 32)
    cx = cy = 16
    c.circle(cx, cy, 15, (ME_BLUE[0], ME_BLUE[1], ME_BLUE[2], 56))
    c.shadow_circle(cx, cy, 8, alpha=60)
    c.circle(cx, cy, 8, WHITE)
    c.circle(cx, cy, 6, ME_BLUE)
    c.save("marker_me.png")


def waypoint():
    # 22 dp: oraliq bekat.
    c = Canvas(22, 22)
    cx = cy = 11
    c.shadow_circle(cx, cy, 8)
    c.circle(cx, cy, 8, WHITE)
    c.circle(cx, cy, 5.75, INK)
    c.save("marker_waypoint.png")


def oneway(name, color):
    # 12x10 dp: bir tomonlama yo'l strelkasi. O'ngga qaragan — MapLibre
    # `symbol-placement: line` da ikonaning +x o'qi chiziq yo'nalishi.
    c = Canvas(12, 10)
    c.line([(3, 1.8), (8.4, 5), (3, 8.2)], color, 2.2)
    c.save(name)


# Joy (POI) ikonalari: 16 dp doira, oq hoshiya, toifa rangi, oq piktogramma.
# Ranglar xira — xarita FON, ikonalar marshrut va markerlardan baland
# chiqmasligi kerak.
POI_COLORS = {
    "health": (0xD9, 0x4A, 0x4F, 255),
    "worship": (0x0E, 0x8A, 0x7E, 255),
    "education": (0xB8, 0x7A, 0x12, 255),
    "shop": (0x7A, 0x52, 0xC2, 255),
    "fuel": (0x4F, 0x62, 0x6C, 255),
    "bank": PRIMARY,
    "transport": ME_BLUE,
    "civic": (0x5B, 0x6B, 0x73, 255),
}


def poi(kind, glyph):
    c = Canvas(16, 16)
    color = POI_COLORS[kind]
    c.circle(8, 8, 7.5, WHITE)
    c.circle(8, 8, 6.4, color)
    glyph(c, color)
    c.save(f"poi_{kind}.png")


def _health(c, color):
    c.rect(7, 4.4, 9, 11.6, WHITE)
    c.rect(4.4, 7, 11.6, 9, WHITE)


def _worship(c, color):
    # Yarim oy.
    c.circle(7.4, 8, 3.6, WHITE)
    c.circle(8.9, 7.3, 3.1, color)


def _education(c, color):
    # Ochiq kitob.
    c.polygon([(4.2, 5.4), (7.6, 6.2), (7.6, 11.2), (4.2, 10.4)], WHITE)
    c.polygon([(11.8, 5.4), (8.4, 6.2), (8.4, 11.2), (11.8, 10.4)], WHITE)


def _shop(c, color):
    # Sumka.
    c.rect(4.8, 6.6, 11.2, 11.6, WHITE, radius=0.8)
    c.arc(8, 6.6, 1.9, 180, 360, WHITE, 1.1)


def _fuel(c, color):
    # Benzin kolonkasi.
    c.rect(5, 4.6, 9.4, 11.6, WHITE, radius=0.6)
    c.rect(5.9, 5.6, 8.5, 7.6, color)
    c.line([(9.4, 6.2), (11, 7.4), (11, 10.4)], WHITE, 1.1)


def _bank(c, color):
    c.polygon([(8, 3.9), (12, 6.4), (4, 6.4)], WHITE)
    for x in (5, 7.4, 9.8):
        c.rect(x, 7.1, x + 1.2, 10.4, WHITE)
    c.rect(4.2, 10.9, 11.8, 11.9, WHITE)


def _transport(c, color):
    # Avtobus.
    c.rect(4.8, 4.4, 11.2, 11, WHITE, radius=1.2)
    c.rect(5.7, 5.6, 10.3, 7.8, color)
    c.rect(5.4, 11, 6.8, 12, WHITE)
    c.rect(9.2, 11, 10.6, 12, WHITE)


def _civic(c, color):
    # Bayroq.
    c.rect(5.2, 4.2, 6.2, 12, WHITE)
    c.polygon([(6.2, 4.4), (11.4, 6.2), (6.2, 8)], WHITE)


if __name__ == "__main__":
    car()
    pickup()
    dropoff()
    me()
    waypoint()
    # Strelka rangi `style_*.json` dagi kichik ko'cha yorlig'i rangiga yaqin.
    oneway("oneway_light.png", (0x8C, 0x9B, 0xA3, 255))
    oneway("oneway_dark.png", (0x5E, 0x72, 0x6A, 255))
    for kind, glyph in [
        ("health", _health), ("worship", _worship), ("education", _education),
        ("shop", _shop), ("fuel", _fuel), ("bank", _bank),
        ("transport", _transport), ("civic", _civic),
    ]:
        poi(kind, glyph)
