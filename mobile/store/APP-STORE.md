# App Store Connect javoblari — Angren Taxi (yo'lovchi, iOS)

Faqat yo'lovchi ilovasi (`uz.angren.taxi.passenger`). Javoblar Play uchun tekshirilgan
`APP-CONTENT.md` bilan mos — ma'lumot turi qo'shilsa ikkalasi birga yangilanadi.
Sozlash bosqichlari: `docs/IOS-RELEASE.md`.

## App Information
- **Name:** Angren Taxi · **Subtitle** (30 belgi): `Taksi, yetkazish, ovqat`
- **Category:** Travel (asosiy), Food & Drink (qo'shimcha)
- **Content Rights:** uchinchi tomon kontenti yo'q (sotuvchi rasmlari — o'z platformamiz)
- **Age Rating:** 17+ emas — so'rovnomada hammasi **None**, "Unrestricted Web Access": **No**
  (WebView faqat to'lov sahifalari uchun, allowlist bilan). Natija odatda **4+**.
  ⚠️ Market'da alkogol/tamaki paydo bo'lsa — "Alcohol, Tobacco" → Frequent, reyting oshadi.

## Pricing
Free. **In-App Purchase yo'q** — to'lovlar jismoniy xizmat (taksi, yetkazish) uchun,
Guideline 3.1.3(e)/3.1.5 bo'yicha Apple to'lov tizimi talab qilinmaydi. Hamyon to'ldirish
ham faqat shu xizmatlar uchun ishlatiladi.

## App Privacy ("Nutrition label")
- Privacy Policy URL: `APP-CONTENT.md` §1 dagi URL.
- **Tracking:** No (reklama ID yo'q, uchinchi tomon reklama/analitika SDK yo'q).

| Apple kategoriyasi | Yig'iladi | Foydalanuvchiga bog'langan | Maqsad |
|---|---|---|---|
| Location → Precise Location | ✔ | Yes | App Functionality |
| Contact Info → Phone Number | ✔ | Yes | App Functionality |
| Contact Info → Name | ✔ (ixtiyoriy) | Yes | App Functionality |
| Identifiers → User ID | ✔ | Yes | App Functionality |
| Identifiers → Device ID (push token) | ✔ | Yes | App Functionality |
| Purchases → Purchase History | ✔ | Yes | App Functionality |
| User Content → Photos | ✔ (shikoyat dalili) | Yes | App Functionality |
| User Content → Other User Content (chat, murojaat) | ✔ | Yes | App Functionality, Customer Support |
| Usage Data → Product Interaction (anonim voronka) | ✔ | **No** | Analytics |
| Diagnostics → Crash Data | faqat `SENTRY_DSN` berilsa | No | App Functionality |

Karta raqami yig'ilmaydi — to'lov provayder sahifasida kiritiladi.

## App Review Information
- **Sign-in required:** Yes
  - User name: yo'lovchi test raqami (`APP-CONTENT.md` §2, prod `OTP_BYPASS_PHONES`)
  - Password: `OTP_BYPASS_CODE` qiymati
- **Notes** (inglizcha):
  > Login is by phone number + SMS code. Use the number above, tap "Get code", and enter
  > the code above — no real SMS is sent. The service operates in Angren, Uzbekistan:
  > if your device location is elsewhere, choose a pickup point on the map manually.
  > Payments are for physical services (rides, delivery) and use local providers (Payme, Click).
  > Account deletion: Profile tab → "Hisobni o'chirish" / "Удалить аккаунт" (bottom of the page).

⚠️ Review davomida bypass yoqiq va raqam allowlist'da qolsin. Reviewer AQShda —
Angren tashqarisida buyurtma "hudud tashqarisi" bo'lishi mumkin: test haydovchisi
onlayn tursin yoki eslatmada shuni ayting.

## Export Compliance
`ITSAppUsesNonExemptEncryption = NO` (`Info.plist`) — faqat HTTPS, so'rov chiqmaydi.

## Skrinshotlar
Majburiy: **6.9"** (1320×2868 yoki 1290×2796) — Apple undan kichiklarini o'zi yasaydi.
`store/screenshots/final` dagi Android skrinshotlari o'lchamga mos emas — iPhone'dan
(TestFlight build) yoki simulyatordan olinadi.
