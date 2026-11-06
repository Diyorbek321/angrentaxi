# Play Console → "App content" javoblari

Ikki ilova: **P** = Angren Taxi (`uz.angren.taxi.passenger`), **D** = Angren Taxi Driver
(`uz.angren.taxi.driver`). Javoblar kod bo'yicha tekshirilgan (2026-10-29).
Ilovaga yangi ma'lumot turi, reklama SDK yoki to'lov qo'shilsa — shu fayl va Play
formasi birga yangilanadi.

## 1. Privacy policy
`https://api.92-5-69-158.sslip.io/api/v1/legal/privacy` (P va D bir xil).
Haqiqiy domenga o'tganda URL'ni yangilang.

## 2. Sign-in details (App access)
"All or some functionality in my app is restricted" → har ilova uchun ko'rsatma:

- **Username:** test telefon raqami (prod `OTP_BYPASS_PHONES` ro'yxatidagi)
  - P: `+998943644401` · D: `+998900000101`
- **Password:** OTP bypass kodi (`OTP_BYPASS_CODE`, serverdagi `.env.prod`)
- **Instructions:**
  > Enter the phone number, tap "Get code", then enter the code above. No real SMS is sent.
  > Driver app: tap "Go online" to receive test orders.

⚠️ Review davomida bypass yoqiq va raqamlar allowlist'da qolsin, aks holda rad etiladi.
⚠️ D test haydovchisi (`+998900000101`) KYC'si 2026-10-17 dan beri kutmoqda — review'dan
oldin admin panelda tasdiqlang, aks holda reviewer "Onlayn" bo'la olmaydi.

## 3. Ads
- P: **Yes, my app contains ads** (bosh sahifadagi reklama bannerlari — `home_tab.dart`).
- D: **No**.

## 4. Content rating (IARC so'rovnomasi)
Kategoriya: **All Other App Types**. Email: support email.
- Violence, sexuality, language, fear, crude humour: **No**
- Controlled substances (alkogol/tamaki/narkotik): **No** — market'da maxsus bo'lim yo'q.
  ⚠️ Sotuvchilar alkogol/tamaki qo'shsa, javob o'zgaradi.
- Gambling / simulated gambling: **No**
- **Users can interact or exchange information: Yes** (safar chati haydovchi↔yo'lovchi)
- **Shares user's current physical location with other users: Yes** (haydovchi joylashuvi
  yo'lovchiga, yo'lovchi manzili haydovchiga)
- Digital purchases: **No** (pul xizmat — taksi/yetkazish — uchun, raqamli tovar emas)
- Unrestricted internet / web browser: **No**

## 5. Target audience and content
- Age groups: **18 and over** (P va D).
- "Appeals to children": **No**.

## 6. Data safety
**Umumiy:**
- Collects or shares user data: **Yes**
- Encrypted in transit: **Yes** (HTTPS)
- Users can request deletion: **Yes** → URL: `https://api.92-5-69-158.sslip.io/api/v1/legal/account-deletion`
- "Shared" — hamma turida **No**: Eskiz, Firebase, Payme/Click, Cloudflare, Oracle — bizning
  nomimizdan ishlaydigan *service provider*lar; Google ta'rifi bo'yicha bu "sharing" emas.

| Ma'lumot turi (Play kategoriyasi) | P | D | Required? | Maqsad |
|---|---|---|---|---|
| Location → Approximate location | ✔ | ✔ | Required | App functionality |
| Location → Precise location | ✔ | ✔ | Required | App functionality, Fraud prevention & security |
| Personal info → Name | ✔ | ✔ | P: Optional · D: Required | App functionality, Account management |
| Personal info → Phone number | ✔ | ✔ | Required | Account management, App functionality |
| Personal info → User IDs | ✔ | ✔ | Required | Account management |
| Personal info → Other info (D: PINFL, STIR, guvohnoma, tug'ilgan sana) | — | ✔ | Required | App functionality, Fraud prevention, Compliance |
| Financial info → Purchase history | ✔ | ✔ | Required | App functionality |
| Financial info → Other financial info (D: hamyon, daromad, pul yechish kartasi) | — | ✔ | Required | App functionality |
| Photos and videos → Photos (D: hujjat va avtomobil suratlari) | — | ✔ | Required | App functionality, Fraud prevention |
| Messages → Other in-app messages (safar chati, yordam) | ✔ | ✔ | Optional | App functionality, Customer support |
| App activity → App interactions (anonim hisoblagich) | ✔ | ✔ | Required | Analytics |
| Device or other IDs (push token) | ✔ | ✔ | Required | App functionality |

- Karta raqami: **No** — to'lov provayder sahifasida kiritiladi, biz saqlamaymiz.
- Crash logs: hozir **No** (Sentry DSN berilmagan). Sentry yoqilsa → App info and
  performance → Crash logs, Diagnostics (Analytics) qo'shing.
- Background location (D): Play "Location" turida "collected while app in background"
  degan alohida savol bo'lsa — **Yes, D uchun** (onlayn holatda foreground service).

## 6a. Advertising ID
**No** (P va D). AAB manifestida `com.google.android.gms.permission.AD_ID` yo'q
(2026-10-29, v16 tekshirildi); reklama/analitika SDK yo'q, faqat FCM.
⚠️ Firebase Analytics / Google Mobile Ads / AppsFlyer kabi SDK qo'shilsa, ular AD_ID ni
manifestga o'zi qo'shadi — shunda javob **Yes** bo'ladi va Data safety ham yangilanadi.

## 7. Government apps
**No** (P va D).

## 8. Financial features
- P: **My app doesn't provide any financial features** — foydalanuvchi faqat platforma
  xizmati uchun to'laydi (to'lovni Payme/Click qiladi).
- D: **My app doesn't provide any financial features** — hamyon haydovchining platformadagi
  daromad/komissiya hisobi, umumiy e-hamyon yoki pul o'tkazmasi emas.
  ⚠️ Bu talqin; Play so'rasa: "earnings ledger for the platform's own drivers, no
  transfers between users, no stored-value wallet for general purchases".

## 9. Health
**No** (P va D).

## 10. Category and contact details
- Category: **Maps & Navigation** (P va D). Muqobil: P — Travel & Local.
- Tags: Taxi, Ride sharing, Food delivery (P); Taxi (D).
- Email: **majburiy** — support email (hali yo'q, oching).
- Phone: support telefoni (⚠️ prod sozlamada hali `+998 71 200 00 00` — soxta).
- Website: ixtiyoriy.

## 11. Store listing
`store/README.md` — matn, ikonka, banner, skrinshotlar.
