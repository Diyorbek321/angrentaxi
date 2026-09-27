# Angren Taxi — qolgan ishlar

Oxirgi yangilanish: 2026-09-27. Bajarilgan ishlar tarixi uchun `git log`ga qarang — bu fayl faqat **hali ochiq** ishlarni kuzatish uchun.

---

## 🔴 Bloker — tashqi shartnoma/hisob kerak

- [ ] **Eskiz SMS shartnomasi** — `ESKIZ_EMAIL`/`ESKIZ_PASSWORD`. Busiz real foydalanuvchi ro'yxatdan o'ta olmaydi.
- [ ] **Firebase loyihasi (FCM)** — haqiqiy `google-services.json` + serverga `FIREBASE_*`. Hozirgisi placeholder, push kelmaydi.
- [ ] **Payme / Click merchant kalitlari** — karta to'lovi. Karta bilan to'langan food/market buyurtmada kuryerga to'lov ham shunga bog'liq (hozir PENDING qoladi).
- [ ] **Haydovchiga bank orqali pul o'tkazish** — `WithdrawalStatus.PAID` hozir faqat status.

## 🟠 Serverda qo'lda qilinadigan ish (RAILWAY_DEPLOY.md, 3a/3b bo'limlari)

- [ ] **OSRM servisini deploy qilish** — `cd osrm && railway up . --path-as-root --service osrm`, `PORT=5000`, backend'ga `OSRM_URL=http://osrm.railway.internal:5000`.
- [ ] **Fayl saqlash** — `STORAGE_DRIVER=s3` + bucket kalitlari (Railway Bucket / R2), yoki backend'ga `/app/uploads` volume.
- [ ] **`.env.production`ni serverga ko'chirish** — `APP_SECRET`ni yangi generatsiya qiling: `openssl rand -hex 32`.
- [ ] **Seed admin raqamini o'zgartirish** — `+998901234567` hujjatlarda ochiq.
- [ ] Migratsiyalar 010–012 (mashina so'rovlari, safar opsiyalari, yo'qolgan buyumlar) backend ishga tushganda o'zi bajariladi.

## 🟡 Biznes qarori kerak

- [ ] **Naqd food/market buyurtmada kuryer ushlagan sotuvchi puli** — kuryer mijozdan to'liq summani oladi; sotuvchi bilan hisob-kitob hozir jismoniy (tizimda kuzatilmaydi).
- [ ] **Safar opsiyalari uchun qo'shimcha haq** — hozir bepul (bola o'rindig'i, hayvon, ...).
- [ ] **Real talab-asosli surge**, **zona-asosli tarif**, **korporativ hisoblar**, **shaharlararo**.
- [ ] **Haydovchi smenasi** — hozircha kerak emas deb qaror qilindi.
- [ ] **Backend xato xabarlari tili** — ilova UZ/RU, lekin server xatolari o'zbekcha qoladi.

## ⚠️ Tekshirilishi kerak

- [ ] **Real qurilmada sinov** — SOS, qo'ng'iroq, navigatsiya, kamera orqali KYC, xaritadan manzil tanlash, ruscha interfeys.
- [ ] **NDK ogohlantirishi** — plaginlar NDK 27+ ni xohlaydi (`app/build.gradle` da `ndkVersion`). Build hozir o'tadi.
- [ ] **Eski APK fayllari** — `apk/` papkasida.
