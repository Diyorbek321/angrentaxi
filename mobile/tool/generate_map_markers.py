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


if __name__ == "__main__":
    car()
    pickup()
    dropoff()
    me()
    waypoint()
