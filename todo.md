# Angren Taxi — qolgan ishlar

Oxirgi yangilanish: 2026-08-10. Bajarilgan ishlar tarixi uchun `git log`ga qarang — bu fayl faqat **hali ochiq** ishlarni kuzatish uchun.

---

## 🔴 Bloker — tashqi shartnoma/hisob kerak

Bularsiz platforma texnik jihatdan ishlaydi, lekin real foydalanuvchiga chiqarib bo'lmaydi.

- [ ] **Eskiz SMS shartnomasi** — `ESKIZ_EMAIL`/`ESKIZ_PASSWORD`. Busiz real foydalanuvchi ro'yxatdan o'ta olmaydi (OTP bypass o'chirilgan). **Eng birinchi imzolanishi kerak.**
- [ ] **Firebase loyihasi (FCM)** — ikkala flavor uchun haqiqiy `google-services.json` + serverga `FIREBASE_*` service-account kaliti. Hozirgi `google-services.json` placeholder (`project_number: "000000000000"`), shuning uchun push xabar umuman kelmaydi.
- [ ] **Payme / Click merchant kalitlari** — karta to'lovi va karta bog'lash. Backend tomonda oqim tayyor (food/market buyurtmalari ham qabul qilinadi), faqat kalitlar yetishmaydi.
- [ ] **Xarita va marshrut provayderi** — hozir OSM plitkalari va `router.project-osrm.org` demo serveri ishlatilyapti; ikkalasi ham tijoriy foydalanishni taqiqlaydi. MapTiler/Yandex + o'z OSRM'ingiz kerak.
- [ ] **Fayl saqlash (S3 yoki Cloudflare R2)** — KYC hujjatlari hozir konteyner diskida, har deploy'da yo'qoladi (`driver-documents.service.ts:20`).
- [ ] **Release keystore** — `mobile/android/key.properties.example` bo'yicha yarating. Gradle tayyor: fayl bo'lsa release signing, bo'lmasa ogohlantirish bilan debug kalit.

## 🟠 Serverda qo'lda qilinadigan ish

- [ ] **`.env.production`ni serverga ko'chirish** — repodagi nusxada endi `OTP_BYPASS_ENABLED=false`, `ALLOW_OTP_BYPASS_IN_PROD=false`, `CORS_ORIGIN` va `DB_SYNC=false` bor. `APP_SECRET`ni ALBATTA yangi generatsiya qiling: `openssl rand -hex 32`.
- [ ] **Seed admin raqamini o'zgartirish** — `+998901234567` hujjatlarda ochiq turibdi.

## 🟡 O'rta ustuvorlik

- [ ] **Haydovchi: ish smenasi / jadval rejalashtirish** — hozir faqat online/offline toggle.
- [ ] **Haydovchi: talab zonasi / heatmap** — "qayerda ko'proq buyurtma bor" ko'rsatilmaydi.
- [ ] **Mashina ma'lumotlarini o'zgartirish** — hozir faqat ko'rish mumkin; almashtirish operator orqali (qayta tekshiruv kerak bo'lgani uchun).
- [ ] **Backendda ESLint yo'q** — `.eslintrc*` fayli yo'q, shuning uchun CI lint bosqichini o'tkazib yuboradi (`.github/workflows/ci.yml`). Tooling masalasi, buzilgan funksiya emas.
- [ ] **i18n (UZ/RU)** — barcha matnlar kodda qattiq yozilgan. Sozlamalardagi til almashtirgich shu sababli olib tashlandi; qaytarish uchun `flutter_localizations` + ARB fayllari kerak.

## 🔵 Katta hajm — biznes qarori kerak

- [ ] **Real talab-asosli surge algoritmi** — hozir admin qo'lda `surgeMultiplier` qo'yadi.
- [ ] **Zona-asosli tarif (geofencing)** — PostGIS bor, "zona" tushunchasi yo'q.
- [ ] **Korporativ hisoblar** — kompaniya nomidan to'lov, xodim-ruxsat tizimi.
- [ ] **Admin panelda heatmap vizualizatsiyasi** — dispatcher live xaritasi bor, tahliliy heatmap yo'q.
- [ ] **Haydovchiga avtomatik pul o'tkazish** — hozir `WithdrawalStatus.PAID` shunchaki status; bank integratsiyasi yo'q.
- [ ] **iOS ilovasi** — `ios/` papkasida faqat `Info.plist` bor, Xcode loyihasi yo'q. Rejada bo'lsa `flutter create --platforms=ios .` bilan qayta yarating, bo'lmasa papkani o'chiring.

## ⚠️ Tekshirilishi kerak

- [ ] **Real qurilmada sinov** — server tomoni to'liq E2E sinovdan o'tdi (55/55), lekin quyidagilar faqat telefonda tekshiriladi:
  - SOS qo'ng'irog'i (102), haydovchiga qo'ng'iroq, navigatsiyaga o'tish — manifestga `<queries>` qo'shildi, endi ishlashi kerak
  - Push bildirishnomalar — faqat haqiqiy Firebase loyihasidan keyin
  - Kamera orqali KYC hujjat yuklash
  - Xaritadan yetkazib berish manzilini tanlash (checkout endi map picker ishlatadi)
- [ ] **Eski APK fayllari** — `apk/` papkasidagi keraksiz build'lar (`angren-go-passenger-release.apk`, `AngrenTaxi-Driver.apk`, `AngrenTaxi-Passenger.apk`).
- [ ] **Root papkadagi aloqasiz fayllar** — `Sotuv skript*`, `Xona*` — `.gitignore`da, lekin diskda turibdi.

---

## ✅ Yaqinda yopilgan (2026-08-10)

Xavfsizlik: production OTP bypass, WebSocket xonalarida egalik tekshiruvi (IDOR),
`WsJwtGuard`ni ulash, WS rate limit, JWT/OTP'ning logcat'ga oqishi, WS CORS.

Server: ro'yxatdan o'tmagan 2 entity (4 ta o'lik endpoint), ishlamaydigan
migratsiyalar → baseline, `SnakeNamingStrategy` drifti, seed skriptlaridagi
`referral_code` xatosi, dispetcherga standart ruxsatlar.

Pul: naqd bo'lmagan safarlarda pul yo'qolishi, hamyon balans tekshiruvi va
qarz bloki, ko'p to'xtashli safar masofasi, `addFunds` va promo `usedCount`
race'lari, promo chegirmasining bepul qo'llanishi, haydovchi topilmasa qayta
qidiruv.

Mobil: `<queries>` (SOS/qo'ng'iroq/navigatsiya), release signing + ProGuard,
9 ta soxta ekran haqiqiy API'ga ulandi yoki olib tashlandi, haydovchi
profilidagi 4 ta jim tugma, checkout manzili GPS bilan mos kelmasligi,
yetkazib berish narxi serverdan.
