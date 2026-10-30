# Angren Taxi Driver — Play Console uchun hammasi bir joyda

Paket: **`uz.angren.taxi.driver`** · Yuklanadigan fayl: `apk/angren-driver-v16-2026-10-29.aab`
(versiya 1.0.0, build 216). Tartib — Play Console'dagi tartib.

---

## 1. Create app
- App name: `Angren Taxi Driver`
- Default language: **Uzbek (uz)** — yoki English, unda o'zbek/rus tarjima bo'ladi
- App or game: **App** · Free or paid: **Free**

## 2. App content

### 2.1 Privacy policy
```
https://api.92-5-69-158.sslip.io/api/v1/legal/privacy
```

### 2.2 App access (Sign-in details)
"All or some functionality is restricted" → Add instructions:
- Name: `Driver test account`
- Username / phone: `+998900000101`
- Password: **OTP bypass kodi** (serverdagi `OTP_BYPASS_CODE` — faqat siz bilasiz)
- Any other information:
```
Enter the phone number above, tap "Davom etish" (Continue) and enter the code from the
password field. No real SMS is sent. After sign-in, tap "Onlayn bo'lish" (Go online) to
start receiving test ride requests. The app UI is in Uzbek and Russian.
```
⚠️ Review'dan OLDIN admin panelda `+998900000101` haydovchisini tasdiqlang (KYC 2026-10-17
dan beri kutmoqda) — aks holda reviewer onlayn bo'la olmaydi va ilova rad etiladi.
⚠️ Review tugaguncha OTP bypass yoqiq, raqam allowlist'da qolsin.

### 2.3 Ads
**No, my app does not contain ads.** (Reklama bannerlari faqat yo'lovchi ilovasida.)

### 2.4 Content rating (IARC)
Category: **All Other App Types**. Email: support email.
- Violence / sexuality / language / controlled substances / gambling: **No**
- Users can interact or exchange information: **Yes** (safar chati yo'lovchi bilan)
- Shares user's current physical location with other users: **Yes**
- Digital purchases: **No**

### 2.5 Target audience
**18 and over** only. Appeals to children: **No**.

### 2.6 Data safety
- Collects or shares user data: **Yes** · Encrypted in transit: **Yes**
- Account creation: **Username and other authentication** (telefon + SMS kod)
- Account deletion URL:
```
https://api.92-5-69-158.sslip.io/api/v1/legal/account-deletion
```
- Delete some data without deleting account: **No**
- Advertising ID: **No**

Har bir tur: **Collected ✔ · Shared ✘ · Ephemeral: No**

| Ma'lumot turi | Required? | Maqsad |
|---|---|---|
| Approximate location | Required | App functionality |
| Precise location | Required | App functionality · Fraud prevention, security and compliance |
| Name | Required | App functionality · Account management |
| Phone number | Required | App functionality · Account management · Fraud prevention, security and compliance |
| User IDs | Required | App functionality · Account management |
| Other info (PINFL, STIR, guvohnoma, tug'ilgan sana) | Required | App functionality · Fraud prevention, security and compliance |
| Purchase history | Required | App functionality · Fraud prevention, security and compliance |
| Other financial info (hamyon, daromad, pul yechish kartasi) | Required | App functionality · Fraud prevention, security and compliance |
| Photos (hujjat va avtomobil suratlari) | Required | App functionality · Fraud prevention, security and compliance |
| Other in-app messages | Users can choose | App functionality |
| App interactions | Required | Analytics |
| Device or other IDs | Required | App functionality · Developer communications |

Agar Location bo'limida "collected in the background" so'ralsa — **Yes** (onlayn holatda).

### 2.7 Government apps / Financial features / Health
- Government apps: **No**
- Financial features: **My app doesn't provide any financial features**
  (Play so'rasa: "The wallet is an earnings ledger for the platform's own drivers — no
  transfers between users and no stored value for general purchases.")
- Health: **No**

### 2.8 Foreground service permissions (FAQAT haydovchi)
Turi: **Location** → task: "Navigation" / "Location sharing".
```
While the driver is "Online", the app shares the driver's real-time location with the
passenger who booked the ride and with the dispatcher, so the passenger can see the car
approaching and the platform can offer nearby ride requests. Tracking runs only after the
driver taps "Go online", shows a persistent notification the whole time, and stops as soon
as the driver goes offline. Interrupting it would leave the passenger and dispatcher with
a stale or missing car position during an active ride.
```
**Video (YouTube, unlisted, 30–60 s), telefonda yozib oling:**
1. Ilovani oching → "Onlayn bo'lish" → bildirishnoma paydo bo'ladi.
2. Home tugmasi bilan ilovadan chiqing — bildirishnoma qoladi.
3. Ilovaga qayting → xaritada mashina harakatlanadi (yoki yo'lovchi ilovasida haydovchi ko'rinadi).
4. "Oflayn bo'lish" → bildirishnoma yo'qoladi.

### 2.9 Full-screen intent (USE_FULL_SCREEN_INTENT)
```
A new ride request is offered to one driver at a time for 15 seconds. When the phone is
locked, the request is shown full-screen (like an incoming call) so the driver can accept
or decline before it expires; otherwise the passenger waits longer and the request is
passed to another driver.
```
⚠️ Play bu ruxsatni asosan qo'ng'iroq/budilnik ilovalariga beradi. **Rad etilsa (B reja):**
`android/app/src/driver/AndroidManifest.xml` dan `USE_FULL_SCREEN_INTENT` qatorini olib
tashlang va qayta yig'ing — ilova oddiy heads-up bildirishnomaga o'tadi, kod tayyor.

## 3. Store settings
- Category: **Maps & Navigation** (muqobil: Business)
- Tags: Taxi
- Email (majburiy): support email · Phone: support raqami · Website: bo'sh

## 4. Main store listing

| Maydon | O'zbekcha | Русский | English |
|---|---|---|---|
| App name | `Angren Taxi Driver` | `Angren Taxi Driver` | `Angren Taxi Driver` |
| Short description | `listing/driver.md` (79) | (69) | (66) |
| Full description | `listing/driver.md` | `listing/driver.md` | `listing/driver.md` |

| Grafika | Fayl |
|---|---|
| App icon 512×512 | `graphics/icon-512.png` |
| Feature graphic 1024×500 | `graphics/feature-driver-uz.png` (ru: `feature-driver-ru.png`; en: uz versiyasi) |
| Phone screenshots (4) | `screenshots/final/driver-uz/` (ru: `driver-ru/`) |
| 7" va 10" tablet (3) | `screenshots/tablet/driver/` |

## 5. Testing → Closed testing
- Release name: `1.0.0 (216)`
- App bundle: `apk/angren-driver-v16-2026-10-29.aab`
- Release notes: `listing/release-notes.md` → "Angren Taxi Driver" bloki
- Testers: email ro'yxati (kamida **12** kishi, **14 kun** uzluksiz) — haydovchilar
- Play App Signing: **qabul qiling** (bizning kalit faqat upload key bo'lib qoladi)
