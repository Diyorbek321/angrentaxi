# Angren Taxi — qolgan ishlar

Oxirgi yangilanish: 2026-10-13. Bajarilgan ishlar tarixi uchun `git log`ga qarang — bu fayl faqat **hali ochiq** ishlarni kuzatish uchun.

---

## 🗺️ Yo'l xaritasi (2026-10-05 da qaror qilindi)

- **1-versiya (hozir):** mavjud funksiyalarni barqaror ishlatish va serverga chiqarish. Yangi funksiya qo'shilmaydi.
- **2-versiya:** ✅ **posilka yetkazish** — 2026-10-05 da qilindi (backend, dispetcher paneli, mobil; PIN bilan topshirish).
- **3-versiya:** ✅ **bosh ekranda reklama banneri** — 2026-10-06 da qilindi (backend, admin paneli "Reklama", mobil karusel; ko'rish/bosish/CTR hisoboti).
- Keyinroq ko'rib chiqiladi (1-versiya ma'lumotlariga qarab): shaharlararo qatnov, Telegram bot orqali buyurtma, safarni yaqinlarga ulashish, qo'shni shaharlarga kengayish, korporativ hisoblar, zona bo'yicha tarif.

## ✅ Navbatdagi ishlar (2026-10-09 da qaror qilindi)

- [x] **Dispetcher: nizoni "hal qilindi" deb yopish** (2026-10-09: migratsiya 020, izoh majburiy, sotuvchi panelida ko'rinadi) — "Istisnolar" sahifasida tugma (izoh bilan), nizo yopilgani tarixda qoladi.
- [x] **Kuryer topilmasa sotuvchi "yetkazildi" qila olmaydi** (2026-10-09: kuryer chaqirilgan buyurtmada backend rad etadi, tugma yashirildi; market'ning o'z yetkazishi rejimida ruxsat qoladi) — platforma kuryeri bilan buyurtmada bu ruxsat olib tashlanadi (backend + sotuvchi panellari).
- [x] **Reklamani to'g'irlash** (2026-10-09: rasm `storage.delete` bilan o'chadi — faqat `ads/` kalitlari; migratsiya 021 kunlik jadval, admin'da "Hisobot" oynasi) — banner o'chirilganda rasmi bucket'dan ham o'chsin (`ObjectStorage`ga `delete`) va hisobotga kunlik kesim (ko'rish/bosish kun bo'yicha).
- [x] **Taksometr uchun alohida tarif** (2026-10-09: `tariffs.metered_price_per_km`, migratsiya 022, hisoblagich va yakuniy narx shundan; admin formasi + menejer taklifi maydoni, bo'sh — oddiy km narxi) — oddiy tarifdan km narxi biroz qimmatroq; admin/menejer sozlaydi.
- [x] **Safar opsiyalari uchun qo'shimcha haq** (2026-10-09: migratsiya 023 `platform_settings.trip_option_fees`; menejer paneli → Tariflar → "Safar opsiyalari haqi"; buyurtma quote'iga muzlatiladi, surge/chegaradan tashqarida, chekda har opsiya alohida qator. ⚠️ Eski APK taxminiy narxda opsiya haqini ko'rsatmaydi — haq qo'yishdan oldin yangi APK chiqarilsin)
- [x] **Server xato xabarlari ruscha ham** (2026-10-09: `backend/src/common/i18n/error-catalogue.ts` lug'ati, `HttpExceptionFilter` tarjima qiladi; mobil `Accept-Language` yuboradi, panellar doim `uz`. Inglizcha xabarlar endi o'zbekcha ham. Lug'atda yo'q xabar o'zgarmaydi — yangi xabar qo'shilsa lug'atga ham qo'shing; socket (WsException) xatolari va class-validator xabarlari hali tarjima qilinmaydi)
- [x] **NDK ogohlantirishini tuzatish** (2026-10-09: `ndkVersion` 28.1.13356709 — maplibre_gl talabi, `compileSdk` 36 — flutter_tts talabi; driver debug APK ogohlantirishsiz yig'ildi. Boshqa mashinada NDK 28.1 o'rnatilgan bo'lishi kerak)
- [x] **Buyurtma beruvchi kuryer/haydovchini xaritada jonli ko'radi** (2026-10-09: taksi va posilkada oldindan bor edi; ovqat/market uchun "Buyurtmalar" → yo'ldagi buyurtma → kuryer xaritasi qo'shildi. Real telefonda sinash kerak) — taksida yo'lovchi haydovchi qayerdan kelayotganini ko'radi; xuddi shu ovqat, market (do'kon) va posilka buyurtmalarida mijozga kuryer uchun ham ishlasin.

## 📣 Reklama (3-versiya) — kichik ochiq qoldiqlar

- [ ] Mobil ilovaning yangi APK'si — karusel faqat yangi build'da ko'rinadi.

## 🚕 Taksometr — ochiq qoldiqlar (2026-10-06)

- [ ] **Yo'lga moslash (OSRM match) faqat o'z OSRM serverida ishlaydi** — ochiq demo server `match` ga ~10 nuqtadan ko'p bermaydi, shuning uchun hozir xom GPS iz ishlatiladi (sinovda aniq chiqdi). OSRM deploy qilinganda (pastdagi ro'yxat) o'zi yoqiladi.

## 📱 Ruxsatlar — ochiq qoldiqlar (2026-10-06)

- [ ] **Google Play: fon joylashuvi deklaratsiyasi** — `FOREGROUND_SERVICE_LOCATION` uchun Play Console → App content → "Foreground service permissions": nima uchun kerakligi + 30 soniyalik video (haydovchi onlayn bo'ladi, bildirishnoma ko'rinadi, navigatorga o'tadi, joylashuv yuborilaveradi). Busiz haydovchi ilovasi chiqmaydi.
- [x] ~~Fondagi haydovchiga yangi buyurtma xabari~~ — 2026-10-06: suzuvchi tugma + ilova o'zi ochiladi + ovozli bildirishnoma (`DriverOverlay.kt`). **Qolgani:** ilova "so'nggi ilovalar"dan surib YOPILSA zakaz kelmaydi — buni faqat Firebase push hal qiladi.
- [ ] **Real telefonda sinov (fon)**: haydovchi onlayn → ilovadan chiqadi → suzuvchi tugma chiqadi → zakaz → ilova o'zi ochiladi. Android 15, Xiaomi (MIUI qalqib chiquvchi oyna ruxsati) va Samsung'da alohida.
- [ ] **Real qurilmada sinov**: Xiaomi/Redmi'da "Avtomatik ishga tushish" va batareya cheklovisiz; telefon qulflangan holda 10 daqiqa safar — taksometr izi uzilmasligi.

## 🔊 Ovozli navigatsiya (2026-10-06)

- [x] ~~O'zbekcha ovoz bo'laklari~~ — 2026-10-06 edge-tts (kalitsiz) bilan yaratildi, 68 ta mp3, faqat haydovchi APK'sida.
- [ ] **Ilova chiqishidan oldin bo'laklarni Azure bilan qayta yaratish** — edge-tts Edge brauzerining norasmiy xizmati (tijorat uchun rasmiy ruxsat yo'q). Ovoz bir xil: Azure Speech (bepul F0) → `mobile/.env.voice` ga `AZURE_TTS_KEY`/`AZURE_TTS_REGION` → `python3 tool/generate_voice_clips.py --force`.
- [ ] **Real telefonda eshitib ko'rish** — bo'laklar orasidagi pauza, musiqa ovozi pasayishi, Xiaomi'da.

## 💵 Naqd ovqat/market (2026-10-07 qilindi) — qoldiqlar

- [ ] **Karta ulanmaguncha 200 000 so'mdan katta ovqat/market buyurtmasi berib bo'lmaydi** — naqd chegaradan oshgan, karta (Payme/Click) esa hali yo'q. Chegarani admin panelidan vaqtincha oshirish mumkin (Umumiy sozlamalar → Naqd buyurtma chegarasi).

## 🖼️ Katalog rasmlari (2026-10-10 qilindi) — qoldiqlar

Restoran/do'kon muqovasi, taom va mahsulot fotosi: migratsiya 024 (`image_key`), ochiq `GET /media/catalog/<uuid>.jpg`, mobil `CatalogImage`. Demo katalog: `cd backend && npm run seed:demo` (5 restoran, 39 taom, 22 mahsulot, 3 banner; rasmlar `backend/demo-assets/`, Unsplash, mualliflar `CREDITS.json`).

- [x] **Sotuvchi panellaridan rasm yuklash** (2026-10-11: `PUT/DELETE …/vendor/{restaurant|store}/image` va `…/{dishes|products}/:id/image`; restoran — taom formasi + Sozlamalar muqovasi, market — yangi mahsulot formasi, jadvaldagi belgini bosish, Sozlamalar muqovasi. Panel rasmni brauzerda 1200 px JPEG'ga kichraytiradi, server chegarasi 2 MB. Brauzerda qo'lda sinalmagan — kichraytirish faqat brauzerda ishlaydi)
- [x] **Rasm almashtirilganda/o'chirilganda eski fayl o'chadi** (2026-10-11: `CatalogImageService`; taom/mahsulot o'chirilganda ham. Boshqa qator ishlatayotgan fayl — demo seed rasmlari — o'chirilmaydi)
- [x] **Rasmlar diskda keshlanadi** (2026-10-13: `CatalogImage` → `cached_network_image`; yangi APK'da ishlaydi)
- [x] **Katalog rasmlari 429 olmaydi** (2026-10-13: `GET /media/catalog/*` uchun `short`/`medium` limit o'chirildi, `long` 1000/daqiqa — bitta ekran 20–30 rasm so'raydi, 10/s limiti ularni kesardi; panel jadvalida ham, mobil menyuda ham)
- [x] **Paneldan rasm yuklash brauzerda sinaldi** (2026-10-13: e2e — 4000×3000 foto market va restoran panelida 1200 px JPEG'ga kichraytirilib yuklanadi)

## 🔴 Bloker — tashqi shartnoma/hisob kerak

- [ ] **Railway'ni tiklash** — 2026-10-05 holatida backend ham, 4 ta panel ham `404 "Application not found"` qaytaradi. Qayta yaratilsa panel domenlari o'zgaradi → `CORS_ORIGIN`ni yangilash.
- [ ] **Eskiz SMS shartnomasi** — `ESKIZ_EMAIL`/`ESKIZ_PASSWORD`. Busiz real foydalanuvchi ro'yxatdan o'ta olmaydi (production'da OTP bypass o'chiq).
- [ ] **Firebase loyihasi (FCM)** — haqiqiy `google-services.json` + serverga `FIREBASE_*`. Hozirgisi placeholder, push kelmaydi.
- [ ] **Payme / Click merchant kalitlari** — karta to'lovi. Karta bilan to'langan food/market buyurtmada kuryerga to'lov ham shunga bog'liq (hozir PENDING qoladi).
- [ ] **Haydovchiga bank orqali pul o'tkazish** — `WithdrawalStatus.PAID` hozir faqat status.

## 🟠 Serverda qo'lda qilinadigan ish (RAILWAY_DEPLOY.md)

- [ ] **`feat/production-readiness` → `main` PR** — Railway backend'ni `main`dan deploy qiladi.
- [ ] **YANGI `APP_SECRET`** (`openssl rand -hex 32`) — eskisi ochiq repoda (`RAILWAY_DEPLOY.md` tarixida) turgan. Majburiy.
- [ ] **Seed admin raqamini o'zgartirish** — `+998901234567` hujjatlarda ochiq.
- [ ] **Fayl saqlash** — Cloudflare R2 tanlandi; lokalda ulangan va sinalgan. Serverga `STORAGE_DRIVER=s3` + 6 ta `S3_*` (tokenni yangilab).
- [ ] **OSRM servisini deploy qilish** — `cd osrm && railway up . --path-as-root --service osrm`, `PORT=5000`, backend'ga `OSRM_URL=http://osrm.railway.internal:5000`.
- [ ] **4 ta web panelni `railway up` bilan qayta deploy** — GitHub'dan avtomatik deploy bo'lmaydi (sessiya cookie nomlari o'zgargan).
- [ ] **Server bazasini tekshirish** — bitta haydovchida bir nechta faol zakaz (tuzatilgan bug'dan qolgan) bor-yo'qligi.
- [ ] Migratsiyalar 010–013 backend ishga tushganda o'zi bajariladi. Baza chala bo'lsa: bir marta `DB_SYNC=true`, keyin `false`.

## 🔧 Barqarorlik (hozirgi fokus — server kerak emas)

Hammasi 2026-10-05 da bajarildi (`git log`). Keyingi navbat — haqiqiy qurilmada sinov (pastda).

## 🖥️ Web panellar tezligi (2026-10-11 qilindi)

- [x] **Restoran va market panellari socket orqali** — yangi buyurtma, kuryer topilmadi, naqd to'lov hodisasi kelishi bilan ro'yxat yangilanadi (sinovda 35 ms; avval 15–30 s poll). Manager panelidagi usul: `server.js` + `server/upgrade-proxy.js`, token sahifaga berilmaydi. Poll zaxira bo'lib qoldi. ⚠️ `npm run dev` endi `node server.js`; Dockerfile `server.js` va `server/` ni nusxalaydi.
- [x] **Panel proksisi katalog rasmlarini brauzerda keshlaydi** (`lib/server/proxy-cache.ts`).
- [x] **Admin: grafiklar kechiktirib yuklanadi** — bosh sahifa 259→157 KB, Reklama 275→176, Hisobotlar 252→150.
- [x] **Admin moderatsiyasi server tomonida sahifalanadi va qidiradi** (`?page&limit&search`).
- [x] **Panel mijoz IP'sini backendga uzatadi** (2026-10-13: `lib/server/client-ip.ts` — kiruvchi `X-Forwarded-For` ning oxirgi qiymati, proksi + login/refresh/logout. OTP va boshqa limitlar endi har foydalanuvchiga alohida. ⚠️ Faqat panel backendni **ichki tarmoq** orqali chaqirsa ishlaydi — ochiq domen orqali chaqirsa Railway chekkasi panel IP'sini oxiriga qo'shadi. Pastdagi `API_URL` ishi shu sababli muhim.)
- [ ] **Railway: panel proksisini ichki tarmoqqa yo'naltirish** — 4 panelga `API_URL=http://<backend>.railway.internal:<port>/api/v1` (manager/admin socket uchun `SOCKET_URL` ham). Railway tiklanganda.
- [x] **Market "Mahsulotlar" server tomonida sahifalanadi** (2026-10-13: `GET /market/vendor/products/browse?page&limit&search&status&categoryId` + `counts`; tanlov sahifalar orasida saqlanadi. Kategoriyalar va Zaxira sahifalari hali eski to'liq ro'yxatni oladi)
- [x] **Admin moderatsiyasida taom/mahsulot rasmi** (2026-10-13: jadvalda kichik rasm, bosilsa kattasi yangi oynada; admin proksisi ham rasmni keshlaydi)

## 🟡 Biznes qarori kerak

- [ ] **Haydovchi smenasi** — hozircha kerak emas deb qaror qilindi.

## ⚠️ Tekshirilishi kerak

- [ ] **Real qurilmada sinov** — SOS, qo'ng'iroq, navigatsiya, kamera orqali KYC, xaritadan manzil tanlash, ruscha interfeys.
- [ ] **Eski APK fayllari** — `apk/` papkasida (eng yangisi 2026-08-29, kod 2026-09-27 gacha o'zgargan).
