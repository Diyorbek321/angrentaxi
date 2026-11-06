# Google Play'ga chiqarish — qo'llanma

Ikki ilova: **Angren Taxi** (`uz.angren.taxi.passenger`) va **Angren Taxi Driver**
(`uz.angren.taxi.driver`). Play Console'da ikkalasi alohida ilova — har bir qadam
ikki marta bajariladi.

## 1. Kodda tayyor (2026-10-29)

| Talab | Holat |
|---|---|
| targetSdk ≥ 36 (2026-08-31 dan majburiy) | `android/app/build.gradle` → `targetSdk = 36` |
| AAB | `BUNDLE=1 tool/build_release.sh` → `build/app/outputs/bundle/<flavor>Release/*.aab` |
| Reliz kaliti | `android/key.properties` → `~/angren-taxi-release.jks` (git'da yo'q — **zaxira nusxasini saqlang**) |
| Ilova ichida hisobni o'chirish | Profil → "Hisobni o'chirish" (`DELETE /api/v1/account`) |
| Hisobni o'chirish veb-sahifasi | `https://api.<domen>/api/v1/legal/account-deletion` |
| Maxfiylik siyosati URL | `https://api.<domen>/api/v1/legal/privacy` (`?lang=ru` — ruscha) |
| Fon joylashuvi | Hech qayerda so'ralmaydi (`ACCESS_BACKGROUND_LOCATION` yo'q) |
| Location foreground service | Faqat haydovchi ilovasida; yo'lovchidan olib tashlangan (`src/passenger/AndroidManifest.xml`) |

Yig'ish:

```bash
cd mobile
PATH=~/flutter/bin:$PATH BUNDLE=1 \
  API_BASE_URL=https://api.<domen>/api/v1 WS_URL=wss://api.<domen> \
  tool/build_release.sh
```

> Flutter "failed to strip debug symbols" desa — `~/android-sdk/cmdline-tools/latest`
> o'rnatilmagan (Flutter tekshiruvi `apkanalyzer` ga tayanadi). AAB baribir to'g'ri
> tozalanadi; tekshirish: `llvm-readelf -S lib/arm64-v8a/libapp.so | grep -c .debug_` → 0.

## 2. Play Console — deklaratsiyalar

### Haydovchi ilovasi
- **Foreground service — Location.** Sabab: onlayn haydovchining joylashuvi
  yo'lovchiga va dispetcherga real vaqtda ko'rsatiladi; xizmat faqat haydovchi
  "Onlayn" tugmasini bosganda ishlaydi, doimiy bildirishnoma bilan. Video: onlayn
  bo'lish → bildirishnoma → ilovani yopish → xaritada harakat.
- **USE_FULL_SCREEN_INTENT.** Sabab: yangi buyurtma taklifi 15 soniyalik — qulflangan
  ekranda qo'ng'iroq kabi ochiladi. ⚠️ Play bu ruxsatni asosan qo'ng'iroq/budilnik
  ilovalariga beradi. **B reja:** rad etilsa `src/driver/AndroidManifest.xml` dan
  ruxsatni olib tashlang — kod oddiy heads-up bildirishnomaga tushadi.
- `SYSTEM_ALERT_WINDOW` — maxsus deklaratsiya so'ralmaydi.

### Ikkala ilova
- **Data safety** (pastdagi jadval).
- **Kontent reytingi** so'rovnomasi (zo'ravonlik/qimor yo'q; foydalanuvchilar o'zaro
  muloqot qiladi — chat/qo'ng'iroq bor bo'lsa "Users interact").
- **Maqsadli auditoriya:** 18+.
- **Ads:** ilovada reklama bannerlari bor (`features/ads`) — "Contains ads: Yes"
  (o'z reklamamiz, uchinchi tomon SDK yo'q).

## 3. Data safety javoblari

| Ma'lumot turi | Yig'iladi | Kimga | Maqsad | Majburiy |
|---|---|---|---|---|
| Telefon raqami | Ha | Eskiz (SMS) | Hisob, aloqa | Ha |
| Ism | Ha | — | Hisob | Yo'q |
| Aniq joylashuv | Ha | — | Ilova funksiyasi | Ha |
| Fon joylashuvi (faqat haydovchi) | Ha | — | Ilova funksiyasi | Ha (onlayn bo'lish uchun) |
| To'lov tarixi | Ha | Payme/Click/Uzcard | Ilova funksiyasi | Yo'q |
| Hukumat ID (haydovchi: pasport, guvohnoma, PINFL) | Ha | — | Qonun talabi, firibgarlikka qarshi | Ha |
| Suratlar (haydovchi hujjatlari) | Ha | Cloudflare (saqlash) | Qonun talabi | Ha |
| Ilova bilan o'zaro ta'sir (anonim hisoblagich) | Ha | — | Analitika | — |
| Crash loglari | Sentry yoqilsa | Sentry | Diagnostika | — |

- Ma'lumot uzatishda shifrlanadi: **Ha** (HTTPS).
- Foydalanuvchi o'chirishni so'rashi mumkin: **Ha** (ilovada va veb-sahifada).

## 4. Yopiq test (shaxsiy akkaunt)

Shaxsiy dasturchi akkaunti (2023-11-13 dan keyin ochilgan): **har ilova uchun**
12 tester × 14 kun uzluksiz yopiq test, keyin production'ga ariza. Tashkilot
akkaunti (MChJ + D-U-N-S) bu talabdan ozod — rasmiy sahifada tekshiring.

## 5. Ochiq masalalar (kod emas)

- ⚠️ **Shaxsga doir ma'lumotlarni lokalizatsiya** ("Shaxsga doir ma'lumotlar
  to'g'risida"gi qonun, 27-1-modda): O'zbekiston fuqarolari ma'lumotlari
  O'zbekistondagi serverlarda saqlanishi talab qilinadi; hozir server Frankfurtda
  (Oracle), fayllar Cloudflare R2 (EU). Yurist bilan hal qiling **ommaviy relizdan
  oldin**. B reja: bazani va fayllarni O'zbekistondagi data-markazga (masalan
  UZCLOUD) ko'chirish — `deploy/oracle` kit Docker'da, ko'chirish = yangi VM + restore.
- Maxfiylik siyosati matni — **qoralama**, yurist ko'rib chiqsin
  (`backend/src/modules/account-deletion/legal-pages.content.ts`).
- `LEGAL_OPERATOR_NAME` (serverdagi `.env.prod`) — YaTT/MChJ rasmiy nomi; berilmasa
  sahifada platforma nomi chiqadi.
- Haqiqiy domen relizdan **oldin** (API manzili APK ichiga yoziladi).
- Do'kon materiallari: 512×512 ikonka, 1024×500 banner, 2–8 skrinshot (har ilova).
- Sentry DSN (crash reporting).
