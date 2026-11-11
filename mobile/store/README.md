# Play Market materiallari

Deklaratsiyalar, Data safety va yopiq test — `docs/PLAY-RELEASE.md`.
Haydovchi ilovasi uchun hammasi bir joyda (Play Console tartibida) — `DRIVER-PLAY.md`.
Bu papka — do'kon sahifasining o'zi: matn, grafika, skrinshotlar.

## Play Console → Main store listing (har ilova uchun)

| Maydon | Fayl | Talab |
|---|---|---|
| App name, short/full description (uz, ru) | `listing/passenger.md`, `listing/driver.md` | ≤30 / ≤80 / ≤4000 belgi |
| App icon | `graphics/icon-512.png` | 512×512 PNG, to'liq kvadrat (Play o'zi yumaloqlaydi) |
| Feature graphic | `graphics/feature-<app>-<uz\|ru>.png` | 1024×500 |
| Phone screenshots | `screenshots/final/<app>-<uz\|ru>/*.png` | 2–8 ta, 1080×1920 (9:16) |
| Tablet screenshots (7" va 10") | `screenshots/tablet/<app>/*.png` | 1080×1920 (9:16), ramkasiz — ikkala bo'limga bir xil |

Asosiy til — **o'zbekcha (uz)**, ruscha — tarjima ("Manage translations" → Russian).
Har tilga o'z banneri va skrinshotlari yuklanadi.

## Skrinshotlar qanday olingan (2026-10-29)

Telefon ulanmagan edi, shuning uchun DEMO ilova **Flutter Web** sifatida (vaqtinchalik
nusxada) yig'ilib, Playwright bilan telefon (360×780 @3x) va planshet (720×1280 @1.5x)
o'lchamida bosib o'tildi — `tool/web_capture.mjs`. Veb nusxadagi vaqtinchalik
moslashlar (asosiy kodda YO'Q): `geocoding` o'rniga soxta manzil, xarita uslubi
`data:` URL, haydovchi "readiness" tekshiruvi o'tkazib yuborilgan, demo jadvali 3× sekin.
Ekranlar va ma'lumot — ilovaning o'zi (demo rejim). Ruscha ramkalarda ekran o'zbekcha.

Demo rejimda topilib tuzatilgan (asosiy kodda): narx bahosi endpoint'i
(`/orders/calculate-price`, `price`), buyurtma narxi = ko'rsatilgan baho, safar holati
`GET /orders/:id` da saqlanadi, daromad endpoint'lari (`/orders/earnings[/breakdown]`).

## Skrinshotni haqiqiy telefondan olish (ixtiyoriy)

1. Demo ilovani yig'ing: `store/tool/build_demo.sh` (serversiz, tayyor ma'lumot).
2. Telefonda USB debugging'ni yoqing, kabel bilan ulang, o'rnating:
   ```bash
   ~/android-sdk/platform-tools/adb install -r build/app/outputs/flutter-apk/app-arm64-v8a-passenger-release.apk
   ```
3. Telefon tilini o'zbekchaga qo'ying va oling:
   ```bash
   store/tool/capture.sh passenger
   ```
   Skript har kadr nomini aytadi — telefonda o'sha ekranni ochasiz, kompyuterda Enter.
   Status bar avtomatik toza qilinadi (10:00, to'liq batareya).
4. Haydovchi uchun xuddi shu: `app-arm64-v8a-driver-release.apk` va `capture.sh driver`.
5. Ramkaga joylash (uz va ru sarlavhalar bilan): `python3 store/tool/frame.py`

Kadrlar ro'yxati va sarlavhalar — `tool/frame.py` dagi `SHOTS`.

> Ilova tilini rus tiliga o'tkazib, ruscha xom skrinshot ham olish mumkin; hozir ikkala
> til ramkasi bir xil (o'zbekcha) ekranni ishlatadi — Play buni qabul qiladi.

## Qayta yaratish

```bash
python3 store/tool/graphics.py   # ikonka va bannerlar
python3 store/tool/frame.py      # skrinshot ramkalari
```

## Eslatmalar

- Ikonka ilovadagi launcher ikonkasining aniq nusxasi (sariq, "AT"). Ikkala ilovada bir
  xil ikonka — do'konda ularni nom ajratadi. Brendni yangilash (yashil rang, ikki ilova
  uchun farqli ikonka) — alohida ish: launcher mipmap'lari ham almashishi kerak.
- Skrinshotlarda haqiqiy mijoz/haydovchi ma'lumoti bo'lmasin — faqat DEMO ilova.
- Matnda komissiya foizi va hali yoqilmagan funksiyalarni (karta to'lovi, shaharlararo)
  va'da qilmang.
