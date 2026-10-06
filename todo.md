# Angren Taxi — qolgan ishlar

Oxirgi yangilanish: 2026-10-06. Bajarilgan ishlar tarixi uchun `git log`ga qarang — bu fayl faqat **hali ochiq** ishlarni kuzatish uchun.

---

## 🗺️ Yo'l xaritasi (2026-10-05 da qaror qilindi)

- **1-versiya (hozir):** mavjud funksiyalarni barqaror ishlatish va serverga chiqarish. Yangi funksiya qo'shilmaydi.
- **2-versiya:** ✅ **posilka yetkazish** — 2026-10-05 da qilindi (backend, dispetcher paneli, mobil; PIN bilan topshirish).
- **3-versiya:** ✅ **bosh ekranda reklama banneri** — 2026-10-06 da qilindi (backend, admin paneli "Reklama", mobil karusel; ko'rish/bosish/CTR hisoboti).
- Keyinroq ko'rib chiqiladi (1-versiya ma'lumotlariga qarab): shaharlararo qatnov, Telegram bot orqali buyurtma, safarni yaqinlarga ulashish, qo'shni shaharlarga kengayish, korporativ hisoblar, zona bo'yicha tarif.

## 📣 Reklama (3-versiya) — kichik ochiq qoldiqlar

- [ ] **Do'kon banneri** hozir `MarketScreen`ni ochadi (u birinchi do'konni yuklaydi). Ikkinchi do'kon qo'shilganda `linkTarget` bo'yicha aynan o'sha do'konni ochish kerak.
- [ ] **O'chirilgan banner rasmi** bucket'da qoladi (`ObjectStorage` da `delete` yo'q). Kichik fayllar; ko'payib ketsa tozalash skripti.
- [ ] **Hisobot faqat jami son** — kunlik kesim kerak bo'lsa alohida jadval (`AdBanner` izohiga qarang).
- [ ] Mobil ilovaning yangi APK'si — karusel faqat yangi build'da ko'rinadi.

## 🚕 Taksometr — ochiq qoldiqlar (2026-10-06)

- [ ] **Yo'lga moslash (OSRM match) faqat o'z OSRM serverida ishlaydi** — ochiq demo server `match` ga ~10 nuqtadan ko'p bermaydi, shuning uchun hozir xom GPS iz ishlatiladi (sinovda aniq chiqdi). OSRM deploy qilinganda (pastdagi ro'yxat) o'zi yoqiladi.
- [ ] **Narx yaxlitlash** — narxlar tiyin bilan saqlanadi (`6499.18`). Ilova butun so'mni ko'rsatadi; 100 so'mgacha yaxlitlash kerakmi — biznes qarori.
- [ ] **Taksometr tarifi** — hozir oddiy tarif stavkalari (boshlang'ich + km + daqiqa). Alohida stavka kerak bo'lsa — biznes qarori.
- [ ] **Chek** — taksometrli safar chekida manzil "saqlanmagan" deb chiqadi; `isMetered` ni chek javobiga qo'shib, "Taksometr" deb yozish.

## 📱 Ruxsatlar — ochiq qoldiqlar (2026-10-06)

- [ ] **Google Play: fon joylashuvi deklaratsiyasi** — `FOREGROUND_SERVICE_LOCATION` uchun Play Console → App content → "Foreground service permissions": nima uchun kerakligi + 30 soniyalik video (haydovchi onlayn bo'ladi, bildirishnoma ko'rinadi, navigatorga o'tadi, joylashuv yuborilaveradi). Busiz haydovchi ilovasi chiqmaydi.
- [x] ~~Fondagi haydovchiga yangi buyurtma xabari~~ — 2026-10-06: suzuvchi tugma + ilova o'zi ochiladi + ovozli bildirishnoma (`DriverOverlay.kt`). **Qolgani:** ilova "so'nggi ilovalar"dan surib YOPILSA zakaz kelmaydi — buni faqat Firebase push hal qiladi.
- [ ] **Real telefonda sinov (fon)**: haydovchi onlayn → ilovadan chiqadi → suzuvchi tugma chiqadi → zakaz → ilova o'zi ochiladi. Android 15, Xiaomi (MIUI qalqib chiquvchi oyna ruxsati) va Samsung'da alohida.
- [ ] **Real qurilmada sinov**: Xiaomi/Redmi'da "Avtomatik ishga tushish" va batareya cheklovisiz; telefon qulflangan holda 10 daqiqa safar — taksometr izi uzilmasligi.

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
