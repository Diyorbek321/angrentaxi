# Angren Taxi — qolgan ishlar

Oxirgi yangilanish: 2026-11-04. Bu fayl faqat **hali ochiq** ishlar uchun — bajarilganlar tarixi `git log` da.

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

## 🛡 Hodisalar tizimi (2026-11-04, 15fe41d, push qilinmagan)

- [ ] **Push + deploy** — 047–053 migratsiyalar boot'da ishlaydi; keyin yangi APK (v22) yig'ib telefonda sinash: SOS, ulashish havolasi, ilova orqali qo'ng'iroq, "Muammo bor", kech bekor qilish, "chiqmadi", safar uzildi, yetkazib bo'lmadi.
- [ ] **Panellarni brauzerda tekshirish** — hodisalar navbati, SOS ovozi, buyurtma dalillari, yangi sozlamalar.
- [ ] **SOS/chat `created_at` timezone'siz** — vaqt 5 soat siljiydi.
- [ ] **Karta `refund_due` qaytarish** — hozir qo'lda.
- [ ] **To'ldirish qaytarilsa qarz tiklanmaydi** — qarz yopilib haydovchiga to'langan, keyin karta to'lovi bekor bo'lsa yo'lovchi qoldig'i manfiy, lekin yangi buyurtma darvozasi uni ko'rmaydi.
- [ ] **Kech bekor qilish jarimasi bonusdan olinishi mumkin** — `chargeTaxiFee` sarflanadigan qoldiqni (bonus bilan) tekshiradi, haydovchiga yechiladigan pul bo'lib o'tadi.
- [ ] **Kechirilgan qarz moliya hisobotida yo'q** — faqat audit jurnalida (`wallet.debt_written_off`).
- [ ] **Hamyon ekranidagi umumiy "To'ldirish"** — hali operator yozuvi; to'lov faqat qarz oynasida.

- [ ] **Sotilgan mahsulotni o'chirish 500 beradi** — `stock_movements` FK, `market.service.ts` `deleteProduct`: tushunarli xato yoki yashirishga o'tkazish kerak (eski xato).
- [ ] **Eski yozuvlar vaqti** — 7f04ce8 dan oldingi `created_at` lar 5 soat erta ko'rinadi (faqat ko'rinish, xulq buzilmaydi).

## 🚀 Yangi APK tarqalgach

- [ ] **Ovqat/market topshirish kodini yoqish** — `.env.prod` ga `VENDOR_HANDOVER_CODE_GATE=on`. Hozir o'chiq: v21 mijoz kodni ko'rmaydi, kuryer kirita olmaydi. O'chiq paytda kuryer eshik oldida kod so'ramaydi.
- [ ] **Posilka qiymatini hammaga majburiy qilish** — `X-Client-Features` da `parcel-declaration` yo'q mijoz (v21, dispetcher paneli) qiymatsiz posilka bera oladi. Panel formasiga qiymat va tasdiq qo'shish kerak.
- [ ] **Haydovchi oferta darvozasini yoqish** — server `.env.prod` ga `LEGAL_DRIVER_TERMS_GATE=on`, backend qayta ishga tushirish. Eski APK'da rozilik oynasi yo'q, shuning uchun hozir o'chiq.
- [ ] **Eski APK yon berishlarini olib tashlash** — `X-Client-Features` yo'q ilovaga raqam ko'rinadi va kech bekor qilish jarimasi kechiriladi.

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
- [ ] Prod bazasi: bitta haydovchida bir nechta faol zakaz qolmaganini tekshirish (tuzatilgan bug izi).
- [ ] Seed admin raqami `+998901234567` hujjatlarda ochiq — prod'da ishlatilmasligini tasdiqlash.
- [ ] `apk/` papkasidagi eski APK'larni tozalash.
