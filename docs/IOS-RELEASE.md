# iOS reliz — Angren Taxi (yo'lovchi)

iPhone'ga **faqat yo'lovchi ilovasi** chiqadi (`uz.angren.taxi.passenger`, iOS 15+, faqat iPhone).
Haydovchi ilovasi Android'da qoladi: u ilova ustidagi tugma, avtozapusk va o'ldirilgan
ilovada "qo'ng'iroqdek jiringlash"ga tayanadi — iOS bularni taqiqlaydi, haydovchi zakaz
o'tkazib yuboradi.

Bizda Mac yo'q → build **Codemagic**'da (bulutdagi Mac). Konfiguratsiya: `codemagic.yaml`.

## Koddagi holat (2026-11-19)

| Narsa | Holat |
|---|---|
| `mobile/ios/` Xcode loyihasi | ✅ bundle `uz.angren.taxi.passenger`, iOS 15, faqat iPhone, portret |
| Ruxsat matnlari (joylashuv, kamera, galereya) | ✅ uz/ru, `Info.plist` |
| Push (APNs) | ✅ entitlement + `remote-notification`; backend APNs blokini allaqachon yuboradi |
| Ulashish oynasi | ✅ `AppDelegate.swift` (`uz.angren.taxi/share`) |
| Ikonka | ✅ `store/tool/graphics.py` → `AppIcon-1024.png` |
| Force-update | ✅ `GET /app/version?platform=ios` — `APP_*_PASSENGER_IOS` kalitlari |
| `GoogleService-Info.plist` | ❌ Firebase'dan olinadi (3-qadam), repoga **qo'yilmaydi** |
| Ekran himoyasi (`FLAG_SECURE`) | ➖ iOS'da yo'q — OTP/to'lov ekranlari skrinshotdan himoyalanmaydi |
| Qurilma identifikatori (antifrod) | ➖ iOS'da yuborilmaydi — haydovchi iOS'da yo'q, mos kelish bo'lmaydi |

Linux'da iOS build qilib bo'lmaydi: Swift kodi va Xcode loyihasi birinchi marta
**Codemagic'da kompilyatsiya qilinadi**. Birinchi build xato bersa — logni tuzatish kerak.

## Qadamlar

### 1. Apple Developer hisobi (uzoq kutiladi — birinchi qiling)
- **Tashkilot** sifatida oching (do'konda "Angren Taxi MChJ" ko'rinadi; jismoniy shaxs
  hisobida sotuvchi nomi — shaxsiy ism). Kerak: **D-U-N-S raqami** (bepul,
  https://developer.apple.com/enroll/duns-lookup/ — 1–2 hafta), yuridik nom, sayt, telefon.
- To'lov: $99/yil. Tasdiqlash 2–7 kun.

### 2. App Store Connect
- *Certificates, IDs & Profiles* → Identifiers → **App ID** `uz.angren.taxi.passenger`,
  capability: **Push Notifications**.
- *Keys* → yangi kalit, **Apple Push Notifications service (APNs)** belgilang → `.p8` faylni
  yuklab oling (bir marta beriladi!). Key ID va Team ID ni yozib qo'ying.
- *Users and Access* → *Integrations* → **App Store Connect API** kaliti (rol: App Manager).
- *My Apps* → **+ New App**: iOS, nomi "Angren Taxi", til — o'zbek yoki rus, bundle ID yuqoridagi.

### 3. Firebase
- Firebase Console → loyiha (Android bilan bir xil) → **Add app → iOS**, bundle
  `uz.angren.taxi.passenger` → `GoogleService-Info.plist` ni yuklab oling.
- *Project settings → Cloud Messaging → Apple app configuration* → 2-qadamdagi `.p8`
  kalitni yuklang (Key ID, Team ID). **Busiz iPhone'ga push kelmaydi.**

### 4. Codemagic
- codemagic.io → GitHub orqali kiring → `angrentaxi` repo'sini qo'shing.
- *Team settings → Integrations → Developer Portal* → 2-qadamdagi API kalit, nomi
  aynan **`AngrenTaxi ASC`** (codemagic.yaml shu nomni kutadi).
- *Environment variables* → guruh **`ios_passenger`** (hammasini "Secure" qiling):
  - `GOOGLE_SERVICE_INFO_PLIST` — `base64 -w0 GoogleService-Info.plist` natijasi
  - `MOBILE_DART_DEFINES_JSON` — GitHub'dagi secret bilan bir xil (MAPTILER_KEY, SENTRY_DSN)
  - `API_BASE_URL`, `WS_URL` — prod manzillar (GitHub `MOBILE_API_BASE_URL` / `MOBILE_WS_URL`)
- Build: Codemagic UI'dan **Start new build → ios-passenger**, yoki `git tag ios-v1.0.0 && git push --tags`.
- Natija avtomatik **TestFlight**'ga tushadi.

### 5. Sinov (TestFlight)
O'z iPhone'ingizga TestFlight ilovasi orqali o'rnating va tekshiring:
- [ ] Kirish (SMS kod), til tanlash, xaritada joylashuv
- [ ] Taksi chaqirish → haydovchi (Android) qabul qiladi → mashina xaritada yuradi
- [ ] Push: ilova yopiq turganda haydovchi qabul qilganini xabar qiladi
- [ ] To'lov sahifasi (Payme/Click) WebView'da ochiladi va qaytadi
- [ ] "Muammo bor" → kamera/galereyadan rasm
- [ ] Safarni ulashish → iOS ulashish oynasi
- [ ] Hisobni o'chirish

### 6. App Review'ga yuborish
App Store Connect'da formalarni `mobile/store/APP-STORE.md` bo'yicha to'ldiring,
skrinshotlar (6.7" va 6.5" iPhone) yuklang → **Submit for Review**. Odatda 1–3 kun.

Chiqqach: `.env.prod` ga `APP_UPDATE_URL_PASSENGER_IOS=https://apps.apple.com/app/id<raqam>`.

## Xavflar va B reja

| Xavf | Belgi | B reja |
|---|---|---|
| D-U-N-S / tashkilot tasdig'i cho'ziladi (>3 hafta) | Apple javob bermaydi | Jismoniy shaxs hisobi bilan chiqish, keyin "App Transfer" bilan MChJ hisobiga ko'chirish |
| Review "4.2 Minimum functionality" yoki "5.1.1" bilan rad etadi | Rejection xati | Xatda ko'rsatilgan bandni tuzatib qayta yuborish; ruxsat matnlarini aniqlashtirish |
| Codemagic bepul daqiqalari (500/oy) tugaydi | Build navbatda to'xtaydi | Pay-as-you-go ($0.095/daqiqa) yoki GitHub Actions macOS runner (billing tuzatilgach) |
| iOS build kompilyatsiya xatosi | Codemagic logi qizil | Logdagi xatoni tuzatish; Mac bor odamdan bir martalik yordam |
| Umuman chiqa olmaslik | — | iPhone egalari dispetcher (telefon/Telegram) orqali buyurtma beradi |
