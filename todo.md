# Angren Taxi — qolgan ishlar

Oxirgi yangilanish: 2026-10-27. Bu fayl faqat **hali ochiq** ishlar uchun — bajarilganlar tarixi `git log` da.

Prod: Oracle Free ARM VM (`deploy/oracle`, sslip.io domeni) — Railway 2026-10-15 dan ishlatilmaydi.
Oxirgi prod deploy: `30e9d24` (2026-10-28). Oxirgi APK: v15 (2026-10-28, build 207).

---

## 🔴 Hozir

- [ ] **GitHub hisobi bloklangan (billing)** — CI va uptime monitor ishga tushmaydi (PR #3). Settings → Billing.
- [ ] **PR #3 → `main`** — CI yashil bo'lgach.

## 🔴 Bloker — tashqi shartnoma/hisob kerak

- [ ] **Eskiz SMS** — `ESKIZ_EMAIL`/`ESKIZ_PASSWORD` (lokal `.env` dagisi yaroqsiz, 401). Hozir kirish faqat `OTP_BYPASS_PHONES` ro'yxati orqali. Shablon `backend/src/modules/notifications/sms-texts.ts#otpSmsText` bilan aynan bir xil bo'lishi kerak.
- [ ] **Payme / Click merchant kalitlari** — karta to'lovi; karta bilan to'langan food/market'da kuryer to'lovi PENDING qoladi. Saqlangan kartalar uchun Payme Subscribe hujjati ham kerak (`docs/specs/saqlangan-kartalar.md`).
- [ ] **OFD / soliq.uz** — fiskal cheklar hozir `noop`.
- [ ] **Haydovchiga bank orqali pul o'tkazish** — `WithdrawalStatus.PAID` hozir faqat status.
- [ ] **Sentry DSN (Node + Flutter)** — kod tayyor, o'chiq.
- [ ] **Telegram alert** — backup/health ogohlantirishlari uchun `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (server `.env.prod` va GitHub secret).
- [ ] **Haqiqiy domen** — hozir `92-5-69-158.sslip.io`; almashtirilsa `DOMAIN` + panellarni qayta yig'ish.
- [ ] **Azure TTS** — ovoz bo'laklari edge-tts bilan (tijorat uchun rasmiy ruxsat yo'q). `mobile/.env.voice` ga `AZURE_TTS_KEY`/`AZURE_TTS_REGION` → `python3 tool/generate_voice_clips.py --force`.

## 📱 Google Play Console

- [ ] **`FOREGROUND_SERVICE_LOCATION` deklaratsiyasi** + 30 soniyalik video (haydovchi onlayn → bildirishnoma → navigator → joylashuv yuborilaveradi). Busiz haydovchi ilovasi chiqmaydi.
- [ ] **`USE_FULL_SCREEN_INTENT` deklaratsiyasi** — zakaz taklifi qulf ustida (kiruvchi qo'ng'iroq kabi).
- [ ] **Data Safety** — anonim voronka ("App interactions", identifikatorsiz).

## ⚖️ Huquqiy

- [ ] Soliq maslahatchisining 3 ta yozma javobi; yopiq pilotdan oldin yurist tekshiruvi.
- [ ] **Hudud chegaradoshligi xaritasini tasdiqlatish** — `backend/src/common/regions/uz-regions.ts` (ishonch past juftlik: Navoiy — Qashqadaryo).
- [ ] **KYC hujjatlari ro'yxati** — seed vaqtinchalik; haqiqiy ro'yxat kerak (nomi · kimga · davriyligi · muhlati).
- [ ] **Shaharlarni boshqarish sahifasi yo'q** — `cities.region` hozir migratsiya 044 (Angren → `UZ-TO`) yoki API orqali.

## 🟡 Biznes qarori kerak

- [ ] **Bitta faol buyurtma** — yo'lovchi bir vaqtda ikki taksi chaqira olsinmi (backend guard yo'q).
- [ ] **Shaharlararo qatnovni yoqish** — kod prod'da; admin bekat/yo'nalishlarni kiritgach flag.
- [ ] **MapTiler shartlari** — offline hudud yuklashga ruxsat beradimi, tekshirilmagan.
- [ ] **Naqd chegarasi** — karta ulanmaguncha 200 000 so'mdan katta ovqat/market buyurtmasi berib bo'lmaydi (admin → Umumiy sozlamalar).

## 🧪 Real qurilmada sinov

- [ ] **Data-only push** — haydovchi onlayn → ilova "Force stop" → ekran qulf → zakaz: ekran yonadi, qo'ng'iroqdek jiringlaydi.
- [ ] **Fon rejimi** — suzuvchi tugma → zakaz → ilova o'zi ochiladi. Android 15, Xiaomi (MIUI qalqib chiquvchi oyna ruxsati), Samsung alohida.
- [ ] **Taksometr** — Xiaomi'da avtomatik ishga tushish va batareya cheklovisiz; qulflangan telefonda 10 daqiqa safar, iz uzilmasin. O'z OSRM serveri prod'da — `match` (yo'lga moslash) ishlayotganini tekshirish.
- [ ] **Ovozli navigatsiya** — pauzalar, musiqa pasayishi, Xiaomi.
- [ ] **Force-update** — `APP_MIN_BUILD_*` dan past build "yangilang" ekranida to'xtaydi.
- [ ] SOS, qo'ng'iroq, kamera orqali KYC, xaritadan manzil tanlash, ruscha interfeys, kuryer xaritasi (ovqat/market).

## 🔧 Kod (keyinroq)

- [ ] Dizayn fazalari 3–5: haydovchi taklif halqasi, super-app `home_tab` + PMTiles, kutish hisoblagichi; tarif kartalari uchun 4 ta mashina SVG.
- [ ] Socket (`WsException`) va class-validator xabarlari tarjima qilinmaydi.
- [ ] Market "Kategoriyalar" va "Zaxira" sahifalari hali to'liq ro'yxatni oladi (sahifalanmagan).
- [ ] Prod bazasi: bitta haydovchida bir nechta faol zakaz qolmaganini tekshirish (tuzatilgan bug izi).
- [ ] Seed admin raqami `+998901234567` hujjatlarda ochiq — prod'da ishlatilmasligini tasdiqlash.
- [ ] `apk/` papkasidagi eski APK'larni tozalash.
