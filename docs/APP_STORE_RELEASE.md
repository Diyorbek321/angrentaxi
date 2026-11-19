# App Store'ga chiqarish — Angren Taxi (yo'lovchi) va Angren Driver (haydovchi)

Bitta Flutter kod bazasidan ikkita iOS ilova chiqadi (flavor):

| Ilova          | Flavor      | Entry point              | Bundle ID                  | Nomi          |
|----------------|-------------|--------------------------|----------------------------|---------------|
| Yo'lovchi      | `passenger` | `lib/main_passenger.dart`| `uz.angren.taxi.passenger` | Angren Taxi   |
| Haydovchi      | `driver`    | `lib/main_driver.dart`   | `uz.angren.taxi.driver`    | Angren Driver |

iOS plaginlari Swift Package Manager orqali ulanadi — **CocoaPods kerak emas**.

## 1. Bir martalik sozlash

1. **Apple Developer Program** (99$/yil) — developer.apple.com.
2. **Identifiers** bo'limida ikkala Bundle ID'ni ro'yxatdan o'tkazing, ikkalasida
   **Push Notifications** capability yoqilgan bo'lsin.
3. **App Store Connect → My Apps → +** — ikkita ilova yarating (yuqoridagi Bundle ID'lar bilan).
4. Xcode'da `mobile/ios/Runner.xcworkspace` ni oching → Runner target →
   **Signing & Capabilities** → *Automatically manage signing* va **Team** ni tanlang
   (barcha build configuration'lar uchun bir xil).
5. **Firebase (push)**: `mobile/ios/config/README.md` dagi qadamlar —
   ikkala `GoogleService-Info.plist` va APNs `.p8` kalit.
6. **Backend (Railway) env** — App Review uchun demo akkaunt:
   ```
   REVIEW_PHONES=+998900000001,+998900000002
   REVIEW_OTP_CODE=<6 xonali kod>
   ```
   Bu raqamlarga SMS yuborilmaydi, doim shu kod ishlaydi. Boshqa raqamlarga ta'sir qilmaydi.
   Haydovchi demo raqamini admin paneldan **tasdiqlangan haydovchi** qilib qo'ying —
   aks holda tekshiruvchi onboarding ekranida qolib ketadi.

## 2. Build va yuklash

```bash
cd mobile
# Har yangi yuklashda build raqamini oshiring: --build-number
flutter build ipa --release --flavor passenger -t lib/main_passenger.dart --build-number 1
flutter build ipa --release --flavor driver    -t lib/main_driver.dart    --build-number 1
```

`build/ios/ipa/*.ipa` ni **Transporter** ilovasi yoki
`xcrun altool --upload-app` orqali yuklang. Yoki Xcode → Product → Archive
(scheme: `passenger` / `driver`) → Distribute App.

## 3. App Store Connect'da to'ldirish kerak bo'lganlar

- **Privacy Policy URL**: `https://angrentaxi-production.up.railway.app/api/v1/legal/privacy`
- **Support URL**: `https://angrentaxi-production.up.railway.app/api/v1/legal/terms` (yoki o'z saytingiz)
- **Skrinshotlar**: iPhone 6.9" (1320×2868) — kamida 3 ta, har ilova uchun alohida.
  Ilovalar faqat iPhone uchun (iPad o'chirilgan), iPad skrinshot kerak emas.
- **App Privacy** (ma'lumot yig'ish): Contact Info → Phone Number, Name;
  Location → Precise Location; User Content → Photos (faqat haydovchi);
  Identifiers → Device ID (push token); Purchases → Purchase History.
  Hammasi "Linked to user", "Used for tracking: **No**".
- **Age rating** anketasi, **Category**: Travel (yo'lovchi), Business yoki Travel (haydovchi).
- **Export compliance**: Info.plist'da `ITSAppUsesNonExemptEncryption = NO` — savol chiqmaydi.

### App Review Notes (namuna)

> Login is by SMS code. Please use the demo account:
> phone **+998900000001**, code **XXXXXX** (passenger app) /
> phone **+998900000002**, code **XXXXXX** (driver app).
> The service operates in Angren, Uzbekistan; map and orders are centred there.
> Payments for rides are for a real-world physical service (taxi), processed by
> local providers (Payme/Click), therefore In-App Purchase is not used (guideline 3.1.3(e)).
> Account deletion: Profile → "Hisobni o'chirish".
> Driver app: background location is used only while the driver is "Online",
> to dispatch nearby rides and show the car's position to the passenger.

## 4. Apple ko'p rad etadigan joylar — bu loyihada qanday hal qilingan

| Talab | Holat |
|---|---|
| 5.1.1(v) Hisobni ilova ichida o'chirish | Profil → "Hisobni o'chirish" (`DELETE /users/me`) |
| 5.1.1 Maxfiylik siyosati havolasi | Login ekrani, Sozlamalar va Profilda |
| 2.1 Ishlamaydigan tugmalar / "tez kunda" | Profil va sozlamalardan olib tashlandi |
| 2.5.4 Fon joylashuvi asossiz | Faqat haydovchi ilovasida, faqat Onlayn rejimda |
| 5.1.1 Ruxsat matnlari | Kamera, galereya, joylashuv — o'zbekcha tushuntirish bilan |
| 2.1 Demo akkaunt | `REVIEW_PHONES` / `REVIEW_OTP_CODE` |
| 3.1.1 IAP | Taksi — jismoniy xizmat, IAP talab qilinmaydi (izohda yozing) |
