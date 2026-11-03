# Angren Taxi — qolgan ishlar

Oxirgi yangilanish: 2026-11-03. Bu fayl faqat **hali ochiq** ishlar uchun — bajarilganlar tarixi `git log` da.

Prod: Oracle Free ARM VM (`deploy/oracle`, sslip.io domeni) — Railway 2026-10-15 dan ishlatilmaydi.
Oxirgi prod deploy: `d4a7f75` (2026-11-01). Oxirgi APK: v21 (2026-11-01, `02d5388`).

---

## 🔴 Hozir

- [ ] **v21 APK telefonda sinovi** — `apk/angren-*-v21-2026-11-01.apk`. Dispatch zanjiri 1–4 bosqich + haydovchi tayyorlik oynasi (zakaz kanali, full-screen, autostart) hali real qurilmada sinalmagan. Sinov: haydovchi onlayn → "Force stop" → ekran qulf → zakaz: ekran yonadi va jiringlaydi; yo'lovchida qidiruv kartasi, "topilmadi" → Qayta izlash / Boshqa tarif.
- [ ] **Prod `supportPhone`** — hali placeholder `+998 71 200 00 00`, ommaviy privacy va hisob o'chirish sahifalarida ko'rinadi. `LEGAL_OPERATOR_NAME` ham o'rnatilmagan (sahifalarda "Angren Taxi").
- [ ] **GitHub hisobi bloklangan (billing)** — CI va uptime monitor ishga tushmaydi (PR #3). Settings → Billing.
- [ ] **PR #3 → `main`** — CI yashil bo'lgach.

## 🔴 Bloker — tashqi shartnoma/hisob kerak

- [ ] **Eskiz SMS** — `ESKIZ_EMAIL`/`ESKIZ_PASSWORD` (lokal `.env` dagisi yaroqsiz, 401). Hozir kirish faqat `OTP_BYPASS_PHONES` ro'yxati orqali. Shablon `backend/src/modules/notifications/sms-texts.ts#otpSmsText` bilan aynan bir xil bo'lishi kerak.
- [ ] **Payme / Click merchant kalitlari** — karta to'lovi; karta bilan to'langan food/market'da kuryer to'lovi PENDING qoladi. Saqlangan kartalar uchun Payme Subscribe hujjati ham kerak (`docs/specs/saqlangan-kartalar.md`).
- [ ] **OFD / soliq.uz** — fiskal cheklar hozir `noop`.
- [ ] **Haydovchiga bank orqali pul o'tkazish** — `WithdrawalStatus.PAID` hozir faqat status.
- [ ] **Sentry DSN (Node + Flutter)** — kod tayyor, o'chiq.
- [ ] **Telegram alert** — backup/health ogohlantirishlari va kunlik biznes hisobotlari (moliya, haydovchilar, antifrod, sifat) uchun `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (server `.env.prod` va GitHub secret).
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
- [ ] **Tezlik kamerasi ogohlantirishi** — kamera haqida ogohlantiruvchi ilova O'zbekiston qonunchiligiga ziddmi, tekshirilmagan (v18 dan haydovchi ilovasida bor).

## 🟡 Biznes qarori kerak

- [ ] **Shaharlararo qatnovni yoqish** — kod prod'da; admin bekat/yo'nalishlarni kiritgach flag.
- [ ] **MapTiler shartlari** — offline hudud yuklashga ruxsat beradimi, tekshirilmagan.
- [ ] **Naqd chegarasi** — karta ulanmaguncha 200 000 so'mdan katta ovqat/market buyurtmasi berib bo'lmaydi (admin → Umumiy sozlamalar).

## 🧪 Real qurilmada sinov

- [ ] **Fon rejimi** — suzuvchi tugma → zakaz → ilova o'zi ochiladi. Android 15, Xiaomi (MIUI qalqib chiquvchi oyna ruxsati), Samsung alohida.
- [ ] **Taksometr** — Xiaomi'da avtomatik ishga tushish va batareya cheklovisiz; qulflangan telefonda 10 daqiqa safar, iz uzilmasin. O'z OSRM serveri prod'da — `match` (yo'lga moslash) ishlayotganini tekshirish.
- [ ] **Ovozli navigatsiya** — pauzalar, musiqa pasayishi, Xiaomi.
- [ ] **Force-update** — `APP_MIN_BUILD_*` dan past build "yangilang" ekranida to'xtaydi.
- [ ] SOS, qo'ng'iroq, kamera orqali KYC, xaritadan manzil tanlash, ruscha interfeys, kuryer xaritasi (ovqat/market).

## 🔧 Kod (keyinroq)

- [ ] Dizayn fazalari 3–5: haydovchi taklif halqasi, super-app `home_tab` + PMTiles, kutish hisoblagichi; tarif kartalari uchun 4 ta mashina SVG.
- [ ] **O'z ikonalari** — 302 ta Material ikona, 0 ta o'ziniki; "shablon ilova" hissining asosiy sababi.
- [ ] Doze kechiktirgan taklif push'i to'liq muddat jiringlaydi (ma'lum cheklov); Oppo/Vivo/Huawei autostart sahifasi aniqlanmagan.
- [ ] Socket (`WsException`) xabarlari tarjima qilinmaydi — hozir hech bir mijoz ularni ko'rsatmaydi (mobil faqat debugPrint); UI'ga chiqarilsa, tarjima kerak bo'ladi.
- [ ] Market "Kategoriyalar" va "Zaxira" sahifalari hali to'liq ro'yxatni oladi (sahifalanmagan).
- [ ] Prod bazasi: bitta haydovchida bir nechta faol zakaz qolmaganini tekshirish (tuzatilgan bug izi).
- [ ] Seed admin raqami `+998901234567` hujjatlarda ochiq — prod'da ishlatilmasligini tasdiqlash.
- [ ] `apk/` papkasidagi eski APK'larni tozalash.
