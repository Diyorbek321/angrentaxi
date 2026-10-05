# Angren Taxi — qolgan ishlar

Oxirgi yangilanish: 2026-10-05. Bajarilgan ishlar tarixi uchun `git log`ga qarang — bu fayl faqat **hali ochiq** ishlarni kuzatish uchun.

---

## 🗺️ Yo'l xaritasi (2026-10-05 da qaror qilindi)

- **1-versiya (hozir):** mavjud funksiyalarni barqaror ishlatish va serverga chiqarish. Yangi funksiya qo'shilmaydi.
- **2-versiya:** ✅ **posilka yetkazish** — 2026-10-05 da qilindi (backend, dispetcher paneli, mobil; PIN bilan topshirish).
- **3-versiya:** ⏳ **super-ilova ichida reklama** — KEYINGI ISH, quyidagi "Davom etish" bo'limiga qarang.
- Keyinroq ko'rib chiqiladi (1-versiya ma'lumotlariga qarab): shaharlararo qatnov, Telegram bot orqali buyurtma, safarni yaqinlarga ulashish, qo'shni shaharlarga kengayish, korporativ hisoblar, zona bo'yicha tarif.

## ▶️ Davom etish — 3-versiya: reklama (2026-10-06 dan)

Qarorlar (foydalanuvchi tanlagan): **admin qo'lda joylaydi**, pul tizimdan tashqarida; **faqat bosh ekranda banner karuseli**. Ko'rishlar va bosishlar hisoblanadi (reklama beruvchiga hisobot).

Reja:
1. **Backend** — `ad_banners` jadvali (015 migratsiya, entity `ENTITIES` ro'yxatiga): title, imageKey, linkType (`none`/`restaurant`/`store`/`url`), linkTarget, startsAt/endsAt, isActive, sortOrder, impressions, clicks.
   - Admin (ADMIN): `GET/POST/PATCH/DELETE /ads`; POST multipart (rasm + maydonlar).
   - `GET /ads/active` (login qilgan foydalanuvchi), `GET /ads/:id/image` (ochiq, cache sarlavhalari bilan), `POST /ads/:id/impression` va `/click` (throttle).
   - Rasm: `ObjectStorage.put/get`, kalit `ads/<uuid>.<ext>`; turi baytlardan aniqlanadi (`sniffDriverUploadMime` naqshi, faqat jpeg/png/webp), max 2 MB. URL havola faqat `https://`.
2. **Admin panel** — `/dashboard/ads` sahifasi + menyuda "Reklama": ro'yxat (rasm, havola, muddat, holat, ko'rish/bosish/CTR), yaratish oynasi (fayl yuklash), yoqish/o'chirish, o'chirish. Admin proksi `content-type` ni uzatadi va tanani `arrayBuffer` qilib yuboradi — multipart shunday o'tishi kerak, lekin tekshirib ko'rish kerak.
3. **Mobil** — `home_tab.dart` da banner karuseli (PageView, avtomatik aylanish), bir sessiyada har banner uchun bitta impression, bosilganda click + restoran/do'kon ekrani yoki tashqi havola (`url_launcher`).
4. **Testlar** — backend unit, E2E (admin banner yaratadi → `/ads/active` da ko'rinadi → muddati tugagani ko'rinmaydi), mobil widget.

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

## 🟡 Biznes qarori kerak

- [ ] **Naqd food/market buyurtmada kuryer ushlagan sotuvchi puli** — kuryer mijozdan to'liq summani oladi; sotuvchi bilan hisob-kitob hozir jismoniy (tizimda kuzatilmaydi).
- [ ] **Safar opsiyalari uchun qo'shimcha haq** — hozir bepul (bola o'rindig'i, hayvon, ...).
- [ ] **Haydovchi smenasi** — hozircha kerak emas deb qaror qilindi.
- [ ] **Backend xato xabarlari tili** — ilova UZ/RU, lekin server xatolari o'zbekcha qoladi.

## ⚠️ Tekshirilishi kerak

- [ ] **Real qurilmada sinov** — SOS, qo'ng'iroq, navigatsiya, kamera orqali KYC, xaritadan manzil tanlash, ruscha interfeys.
- [ ] **NDK ogohlantirishi** — plaginlar NDK 27+ ni xohlaydi (`app/build.gradle` da `ndkVersion`). Build hozir o'tadi.
- [ ] **Eski APK fayllari** — `apk/` papkasida (eng yangisi 2026-08-29, kod 2026-09-27 gacha o'zgargan).
