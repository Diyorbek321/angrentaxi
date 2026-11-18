# Angren Taxi — korporativ sayt

Statik, ikki tilli (uz / ru) sayt. Bog'liqlik yo'q — faqat Node 20+.

```bash
npm run build     # dist/ ga yig'adi (DOMAIN=... bilan domenni almashtirish mumkin)
npm test          # matn to'liqligi, havolalar, xavfsizlik tekshiruvlari
npm run preview   # http://127.0.0.1:4321
```

## Nimani qayerda o'zgartirish

| Nima | Fayl |
|---|---|
| Telefon, Telegram, email, manzil, ish vaqti, yuridik nom | `site.config.json` (`null` — sahifada ko'rinmaydi) |
| Google Play havolalari | `site.config.json` → `apps` |
| Shaharlararo / karta to'lovi yoqilganda | `site.config.json` → `services` |
| Matnlar | `src/content/uz.mjs`, `src/content/ru.mjs` (tuzilmasi bir xil bo'lishi shart) |
| Dizayn | `src/assets/site.css` (ranglar ilovadagi `app_theme.dart` bilan bir xil) |

Qoida: saytga faqat haqiqatda ishlayotgan narsa yoziladi — soxta statistika,
sharh, "24/7" yoki placeholder raqam yo'q.

## Prod

`deploy/oracle/deploy.sh` saytni `web-site` konteyneri sifatida yig'adi va
bosh domenda (`https://<DOMAIN>/`, `www.` → bosh domen) chiqaradi. Smoke test
`/`, `/ru/` va 404 ni tekshiradi.
