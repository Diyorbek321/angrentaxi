# Huquqiy talablar (Legal compliance)

> Holat: 2026-10-15. Backend `feat/legal-compliance` tarmog'i, migratsiyalar `025_legal_compliance`
> (1-bosqich), `026_vendor_wallet_and_shift_pass` (2-bosqich, §7–10) va
> `027_wallet_topups_and_audit` (3-bosqich, §11–17), `028_merchant_transactions_and_fiscal_refunds`
> (4-bosqich, §18–20) va `029_vendor_settlement_view_and_refund_clawback` (API v4, §21–24).
> Huquqiy manbalar 2026-10-15 holatiga ko'ra o'rganilgan. Kuchga kirishdan oldin yurist bilan tekshiring.

**Asosiy tamoyil:** standart sozlamalarda **hech narsa o'zgarmaydi**. Talablarni majburlash,
soliqni ushlab qolish va komissiya aksiyasi alohida sozlamalar bilan yoqiladi. Fiskal provayder
standart holatda `noop`.

---

## 1. Haydovchiga qo'yiladigan talablar — VMQ No. 200 (02.04.2025)

Agregator faqat quyidagi talablarga javob beradigan haydovchiga xizmat ko'rsatadi:

| Qoida | Manba | Tekshiruv | Sozlama (standart) |
|---|---|---|---|
| Hudud uchun taksi litsenziya varaqasi | VMQ 200 | `drivers.taxi_licence_number` + `taxi_licence` hujjati | — |
| O'zbekiston fuqarosi | VMQ 200 | `drivers.citizenship = 'UZ'` | — |
| Kamida 21 yosh | VMQ 200 | `drivers.birth_date` | `minDriverAgeYears` (21) |
| B toifasi, kamida 3 yil staj | VMQ 200 | `drivers.driving_licence_issued_at` | `minLicenceExperienceYears` (3) |
| Shahar ichida mashina 15 yildan eski emas | VMQ 200 | `drivers.car_year` | `maxVehicleAgeYears` (15) |
| Tibbiy ko'rik (o'zini o'zi band qilgan — yillik) | VMQ 200 | `medical_check` hujjati | — |
| Yillik texnik ko'rik | VMQ 200 | `tech_inspection` hujjati | — |
| Tashuvchining fuqarolik javobgarligi sug'urtasi | VMQ 200 | `carrier_insurance` hujjati | — |
| Soliq maqomi + JShShIR (YaTT uchun STIR ham) | PQ-247, SK 465/470 | `tax_status`, `pinfl`, `tin` | — |

Tekshiruv mantig'i — sof funksiya `backend/src/modules/drivers/driver-legal-eligibility.ts`.
U `{ eligible, reasons[] }` qaytaradi; har bir sabab `{ code, message }` (matn o'zbekcha).

**Hujjatlar** mavjud tekshiruv tizimida (`driver_verification_requirements`) taksi uchun 4 ta yangi
talab sifatida yozildi: `taxi_licence`, `medical_check`, `carrier_insurance`, `tech_inspection`.
Ularni menejer odatdagidek ko'rib chiqadi (`PATCH /drivers/verification/:id/review`, `validUntil` —
hujjatdagi sana). Menejer sanani kiritmasa, zaxira muddat 365 kun. Talablar `is_required = false`
bilan yozilgan: eski onlayn darvoza ularni hisobga olmaydi, ularni faqat huquqiy darvoza talab qiladi.

### Majburlash va muhlat

`legalComplianceEnforcedFrom` (platforma sozlamasi, standart `null`):

- `null` — **majburlanmaydi**. Sabablar haydovchi ilovasida ogohlantirish sifatida ko'rinadi.
- kelajakdagi sana — **muhlat davri**: haydovchilar ma'lumotni to'ldirishga ulguradi.
- o'tgan sana — **majburlanadi**: talablarga javob bermaydigan haydovchi taksi uchun onlayn chiqa
  olmaydi (`PATCH /drivers/status` → 400, sabablar bilan) va «Taksi» xizmatini yoqa olmaydi
  (`PATCH /drivers/me/services` → 400).

Faqat **TAKSI** xizmatiga tegishli. Kuryer/yuk tashuvchi bu darvoza bilan to'silmaydi. Taksi va
kuryer xizmati ikkalasi yoqilgan haydovchi majburlash paytida bloklanadi: u «Xizmatlar»
bo'limida taksini o'chirib, kuryer sifatida ishlashni davom ettirishi mumkin.

---

## 2. 1% soliqni ushlab qolish — PQ-247 (12.08.2025) + Soliq kodeksi 465/470 (2026)

O'zini o'zi band qilgan haydovchi/kuryer va yillik aylanmasi 1 mlrd so'mgacha bo'lgan YaTT 1%
aylanma solig'ini to'laydi. Platforma (yuridik shaxs) **soliq agenti** hisoblanadi: platforma
orqali olingan daromaddan 1% ni ushlab qoladi va har bir shaxs bo'yicha hisobot beradi.

| Sozlama | Standart |
|---|---|
| `taxWithholdingEnabled` | `false` |
| `driverTaxWithholdingRate` | `1.0` (%) |

**Qanday ishlaydi** (`orders-completion.service.ts`, komissiya bilan bitta DB tranzaksiyasida):

- `ushlab qolish = round(daromad × stavka / 100)`.
- **Daromad bazasi = komissiya bazasi**: chegirmadan keyingi yakuniy narx (`orders.final_price`).
  Sabab: komissioner modelida haydovchi (komitent) butun summani oladi, platforma komissiyasi esa
  uning xarajati bo'lib, aylanmani kamaytirmaydi. Chaqiriq (tip) bazaga kirmaydi.
- Daftarga alohida qator: `transactions` DEBIT, `external_id = 'tax_withholding'` (komissiyadagi
  `'commission'` kabi). Uning holati komissiya holati bilan bir xil: naqd — darhol; karta —
  to'lov provayderi tasdiqlaganda `settleOrderPayout` uni `COMPLETED` qiladi.
- Balans: naqd safarda `−(komissiya + soliq)`, yig'ilgan naqdsiz safarda `sof − soliq`.
- Takror yozilmaydi: `uq_transactions_tax_withholding_order` unikal qisman indeksi.
- Kuryer yetkazishlari (ovqat/market kuryer safari) ham aynan shu oqimdan o'tadi va ushlab qolinadi.
- Soliq maqomi kiritilmagan haydovchidan ham ushlanadi (konservativ yondashuv). Bunday haydovchini
  qabul qilmaslik esa 1-bo'limdagi darvozaning vazifasi.

---

## 3. Fiskal cheklar (komissioner modeli)

Har bir safar/buyurtma uchun fiskal chek berilishi shart (naqd to'lovda ham). Onlayn-NKT modelida
agregator — **komissioner**, haydovchi/sotuvchi — **komitent (principal)**. Chekda komitentning
STIR/JShShIR i bo'lishi kerak, aks holda butun summa platforma aylanmasi hisoblanadi.

- Jadval `fiscal_receipts`: `order_id` (unikal), `service_type`, `principal_type`
  (`driver|restaurant|store`), `principal_pinfl/tin`, `platform_role = 'komissioner'`, `total`,
  `commission_amount`, `payment_method` (`cash|card`), `status` (`pending|sent|failed|skipped`),
  `provider`, `external_id`, `fiscal_sign`, `qr_url`, `attempts`, `last_error`, `sent_at`.
- Yozuv yaratiladi:
  - taksi, yuk, posilka va kuryer safari — safar yakunlanganda (komitent — haydovchi, summa —
    yo'l haqi yoki yetkazish haqi);
  - ovqat/market tovari — kuryer «yetkazdim» deganda (komitent — restoran/do'kon, summa — tovar
    qismi, yetkazish haqisiz). Sotuvchining STIR i `restaurants.tin` / `stores.tin` ustunida
    (vendor paneli `PATCH` orqali kiritadi).
- **Yakunlashni hech qachon buzmaydi**: xato log'ga va `last_error` ga yoziladi, holati `failed`.
- Provayder `FISCAL_PROVIDER` env bilan tanlanadi (standart `noop`). `noop` → holat `skipped`,
  sabab `provider not configured`.

**Kutilmoqda (pending):** haqiqiy OFD / soliq.uz integratsiyasi — hisob ma'lumotlari hali yo'q.
Qo'shish uchun `FiscalProvider` interfeysini amalga oshiring (`modules/fiscal/fiscal-provider.ts`),
`createFiscalProvider` ga `case` qo'shing va `FISCAL_PROVIDER=<nom>` ni o'rnating. Keyin
`POST /admin/fiscal-receipts/retry-pending` orqali `skipped` emas, balki `failed/pending`
cheklarni qayta yuborish mumkin (`skipped` qayta yuborilmaydi — kerak bo'lsa alohida backfill).

---

## 4. Komissiya va ishga tushirish aksiyasi

| Sozlama | Standart |
|---|---|
| `defaultCommissionRate` | `10` (%) — mavjud mexanizm, o'zgarmagan |
| `launchPromoCommissionUntil` | `null` (aksiya yo'q) |

Qoida (`modules/orders/commission-policy.ts`): haydovchining shaxsiy stavkasi bo'lsa — u, aks holda
platforma standarti. Aksiya faol bo'lsa (`hozir < launchPromoCommissionUntil`) **taksi** safarlari
uchun stavka 0% (shaxsiy stavka faqat undan past bo'lsa yutadi). Yuk, posilka va yetkazish aksiyaga
kirmaydi.

---

## 5. API (prefiks `/api/v1`, javob `{ success, data }` konvertida)

| Metod va yo'l | Rol | Vazifa |
|---|---|---|
| `GET /drivers/me/legal` | driver | Profil + xulosa |
| `PATCH /drivers/me/legal` | driver | Profilni to'ldirish |
| `GET /drivers/:id/legal` | manager (DRIVERS_VIEW), admin | Haydovchi profili |
| `PATCH /drivers/:id/legal` | manager (DRIVERS_APPROVE), admin | Tuzatish |
| `GET /settings/legal-compliance` | manager, admin | Sozlamalar |
| `PATCH /settings/legal-compliance` | admin | Majburlash sanasi, chegaralar, ushlab qolish |
| `GET /settings/commission` | manager (TARIFFS_MANAGE), admin | `+ launchPromoCommissionUntil, launchPromoActive` |
| `PATCH /settings/commission/launch-promo` | admin | `{ launchPromoCommissionUntil: ISO \| null }` |
| `GET /admin/tax-withholding/report?month=YYYY-MM` | admin | Oylik hisobot (JSON) |
| `GET /admin/tax-withholding/report.csv?month=YYYY-MM` | admin | CSV (UTF-8 BOM, konvertsiz) |
| `GET /admin/fiscal-receipts` | admin | Ro'yxat: `status, serviceType, principalType, orderId, from, to, page, limit` |
| `POST /admin/fiscal-receipts/:id/retry` | admin | Bitta chekni qayta yuborish (`failed/pending`) |
| `POST /admin/fiscal-receipts/retry-pending` | admin | Hammasini (50 tagacha) qayta yuborish |

Vendor: `PATCH /food/vendor/restaurant` va `PATCH /market/vendor/store` endi
ixtiyoriy `tin` (9 raqam) maydonini qabul qiladi.

`GET /drivers/me/legal` javobi:

```json
{
  "profile": { "taxStatus": "self_employed|individual_entrepreneur|null", "pinfl": "14 raqam|null",
               "tin": "9 raqam|null", "birthDate": "YYYY-MM-DD|null", "drivingLicenceIssuedAt": "YYYY-MM-DD|null",
               "taxiLicenceNumber": "…|null", "taxiLicenceRegion": "…|null", "citizenship": "UZ" },
  "eligibility": { "eligible": false, "enforced": false, "enforcedFrom": null, "appliesToTaxi": true,
                   "blocking": false, "reasons": [{ "code": "pinfl_missing", "message": "…" }] }
}
```

Sabab kodlari: `birth_date_missing`, `age_below_minimum`, `licence_date_missing`,
`licence_experience_too_short`, `vehicle_year_missing`, `vehicle_too_old`, `tax_status_missing`,
`pinfl_missing`, `tin_missing`, `citizenship_not_uz`, `taxi_licence_missing`, `document_<kod>`.

---

## 6. Hali qilinmagan / ochiq savollar

- **OFD/soliq.uz integratsiyasi** — hisob ma'lumotlari yo'q; hozir `noop`.
- **Soliq to'lovi** — ushlab qolingan summani byudjetga o'tkazish va soliq organiga elektron
  hisobot yuborish qo'lda (CSV asosida). Avtomatik integratsiya yo'q.
- ~~**Hudud cheklovi**~~ — 2026-10-27 qilindi (migratsiya 044). `taxiLicenceRegion` endi ISO 3166-2:UZ
  kodi (`UZ-TO`); eski erkin matn DTO'da kodga aylantiriladi, tanilmasa 400. `cities.region` — shahar
  hududi; taksi zakazida matching faqat litsenziyasi shu yoki **chegaradosh** hududga tegishli
  haydovchiga taklif yuboradi (`backend/src/common/regions/uz-regions.ts`). Hudud noma'lum bo'lsa
  (haydovchi kiritmagan, eski matn tanilmagan, shaharga hudud berilmagan) — cheklanmaydi, panelda
  belgilanadi (mahsulot qarori: pilotda dispetcherlik to'xtamasin). Ovqat/market/yuk — cheklovsiz.
  ⚠️ Chegaradoshlik xaritasi yuridik tekshiruvdan o'tmagan (ishonch past: Navoiy — Qashqadaryo).
  Shaharlarni boshqarish sahifasi panelda yo'q — `cities.region` migratsiya yoki API orqali.
- **«Taksi pasporti»** mashinada bo'lishi — tizim tekshirmaydi (jismoniy hujjat).
- Haydovchining o'zi kiritgan maydonlar (tug'ilgan sana, staj) — menejer hujjat bilan solishtirishi
  kerak; tasdiqlash oqimi faqat 4 ta hujjat uchun bor.
- ~~Daromad ekrani faqat komissiyani ayiradi~~ — 2-bosqichda hal qilindi (§9).
- 2-bosqich ochiq savollari — §10.

---

# 2-bosqich (2026-10-15, migratsiya 026)

## 7. Sotuvchi bilan hamyon orqali hisob-kitob — e-tijorat qonuni, 23-modda

E-tijorat qonuniga o'zgartishlar (imzolangan 10.09.2026, kuchga kirishi **2026-12-12**): kuryer
mijozdan olingan naqd pulni faqat sotuvchiga oldindan **elektron** o'tkazgan summasi doirasida
ushlab qola oladi. Bugungi oqim (kuryer do'konga naqd to'laydi, `delivery/vendor-cash.ts`,
migratsiya 019) shu sanadan keyin ruxsat etilmaydi.

| Sozlama | Standart |
|---|---|
| `vendorSettlementMode` | `'cash'` |
| `vendorWalletSettlementFrom` | `2026-12-12T00:00:00+05:00` (`null` — sana yo'q) |

**Amaldagi rejim** (`delivery/vendor-settlement-mode.ts`, sof funksiya): `wallet`, agar admin uni
yoqqan bo'lsa **yoki** `hozir ≥ vendorWalletSettlementFrom`; aks holda `cash`. Ya'ni 2026-12-12
dan hamyon rejimi qo'lda hech narsa qilmasdan yoqiladi.

**`cash` rejim** — bugungi xulq aynan saqlanadi (mavjud testlar o'zgarmagan).

**`wallet` rejim** (faqat NAQD ovqat/market buyurtma; karta buyurtmasi o'zgarmaydi):

1. **Qabul qilish** (`PATCH /orders/:id/accept`): kuryer hamyonidagi sarflanadigan qoldiq
   (`computeSpendableBalance`) tovar summasidan (`details.payVendor`) kam bo'lsa — 400:
   «Hamyonda mablag' yetarli emas: do'konga X so'm o'tkazish kerak, balansingiz Y so'm…».
2. **Olib ketish** — `PATCH /orders/:id/vendor-paid` (bugungi «To'ladim» tugmasi) yoki
   `PATCH /orders/:id/start` (avtomatik): bitta DB tranzaksiyasida, kuryer hamyoni qulfi ostida
   (`delivery/vendor-wallet-settlement.ts`):
   - kuryer `DEBIT` tovar summasi — `external_id = 'vendor_settlement_debit_<vendorOrderId>'`;
   - sotuvchi egasi `CREDIT` tovar summasi — `'vendor_settlement_credit_<vendorOrderId>'`;
   - sotuvchi egasi `DEBIT` komissiya — `'vendor_settlement_commission_<vendorOrderId>'`,
     formula bugungi bilan bir xil: `round(totalPrice × commissionRate / 100)`.
   Sotuvchining sof tushumi = tovar − komissiya. Buyurtmada `vendor_wallet_settled_at`,
   `vendor_cash_paid_at`, `vendor_cash_confirmed_at` qo'yiladi. Takror chaqiruv hech narsa
   yozmaydi (shartli yozuv + `uq_transactions_vendor_settlement` unikal indeksi). Balans yetmasa —
   400 va hech narsa yozilmaydi. Sotuvchiga `vendor:wallet_settled`
   `{ kind, vendorOrderId, amount, commission, net }` realtime hodisasi yuboriladi.
3. Sotuvchining «oldim/olmadim» qadami **o'tkazib yuboriladi** — urinilsa 400.
4. Yetkazilganda `food.service`/`market.service` komissiyani **qayta yozmaydi**
   (`vendorWalletSettledAt` belgisi).
5. Kuryer mijozdan naqd pulni (tovar + yetkazish) odatdagidek oladi; yetkazish safari
   komissiyasi va 1% soliq odatdagidek.

Ilovalar rejimni `GET /settings/public` dan (`vendorSettlementMode` — AMALDAGI qiymat) va
`PATCH /orders/:id/vendor-paid` javobidan (`{ amount, method: 'cash' | 'wallet' }`) biladi.
Sotuvchi buyurtmasi JSON'ida yangi `vendorWalletSettledAt` maydoni bor.

## 8. Haydovchi smenasi (kunlik obuna)

Biznes qarori: haydovchi har safar uchun komissiya (standart 10%) **yoki** kunlik smenani tanlaydi.

| Sozlama | Standart |
|---|---|
| `shiftPassEnabled` | `false` |
| `shiftPassPrice` | `25000` so'm |
| `shiftPassDurationHours` | `24` |
| `shiftPassServiceTypes` | `["taxi"]` |

- Jadval `driver_shift_passes`: `driver_id` (→ `users.id`), `starts_at`, `ends_at`, `price`,
  `status` (`active|expired|cancelled`), `service_types` (sotib olingan paytdagi NUSXA),
  `transaction_id`, `created_at`.
- **Sotib olish** — bitta tranzaksiyada, hamyon qulfi ostida: smena o'chiq → 400; faol smena bor
  → 409 (ustma-ust tushmaydi); `balans < narx` → 400 «Hamyonda mablag' yetarli emas…»; aks holda
  hamyondan `DEBIT` (`external_id = 'shift_pass_<passId>'`, `WALLET`, `COMPLETED`) va
  `drivers.balance` ham kamayadi (komissiya kabi).
- **Fiskal yozuv**: `principal_type = 'platform'`, `platform_role = 'seller'`,
  `service_type = 'shift_pass'`, `order_id` = smena id, `total = commission_amount = narx`
  (butun summa platforma daromadi). Best-effort — xato sotib olishni buzmaydi.
- **Taqqoslash** (`GET /drivers/me/shift-pass` → `comparison`): oxirgi 7 kunda smena qamraydigan
  xizmatlarda to'langan komissiya va «har ish kuniga bitta smena» narxi. Taxminiy: ish kuni —
  Toshkent sanasi bo'yicha kamida bitta yakunlangan safar bor kun.

### Komissiya ustuvorligi (`orders/commission-policy.ts`)

Birinchi mos kelgani yutadi:

1. **Faol smena** — safar yakunlangan payt `[startsAt, endsAt)` oralig'ida, safar xizmat turi
   smenaning `serviceTypes` ida, holati `cancelled` emas → **0%**.
2. **Ishga tushirish aksiyasi** (faqat taksi) → `min(shaxsiy stavka, 0%)`.
3. Haydovchining shaxsiy stavkasi.
4. Platforma standarti (10%).

**1% soliq ushlab qolish bu qoidadan tashqarida** — u haydovchining solig'i, platforma daromadi
emas; smena yoki aksiya uni o'chirmaydi. Safarning fiskal yozuvi baribir yaratiladi
(`commissionAmount = 0`). Smena tekshiruvi xato bersa — komissiya olinadi (yakunlash to'xtamaydi).

## 9. Daromad ekrani (`GET /orders/earnings/breakdown`)

Har bir davr (`today` / `week` = 7 kun / `month` = 30 kun) endi:

```json
{ "gross": 20000, "commission": 2000, "taxWithheld": 200, "shiftPassCost": 25000,
  "net": -7200, "trips": 1 }
```

`net = gross − commission − taxWithheld − shiftPassCost`. Eski maydonlar (`gross, commission, net,
trips`) saqlangan; soliq o'chiq va smena yo'q bo'lsa `net` avvalgidek. `shiftPassCost` — davrda
**boshlangan**, bekor qilinmagan smenalar narxi.

## 10. 2-bosqich API (prefiks `/api/v1`, `{ success, data }` konvertida)

| Metod va yo'l | Rol | Javob (`data`) |
|---|---|---|
| `GET /settings/public` | har qanday kirgan | `{ platformName, supportPhone, deliveryFee, maxCashVendorOrder, vendorSettlementMode: 'cash'\|'wallet' (amaldagi), vendorWalletSettlementFrom: ISO\|null }` |
| `GET /settings/vendor-settlement` | manager, admin | `{ vendorSettlementMode, vendorWalletSettlementFrom, effectiveVendorSettlementMode }` |
| `PATCH /settings/vendor-settlement` | admin | body `{ vendorSettlementMode?, vendorWalletSettlementFrom?: ISO\|null }` → yuqoridagi shakl |
| `GET /settings/shift-pass` | manager, admin | `{ shiftPassEnabled, shiftPassPrice, shiftPassDurationHours, shiftPassServiceTypes }` |
| `PATCH /settings/shift-pass` | admin | shu maydonlar (ixtiyoriy) → shu shakl |
| `PATCH /orders/:id/vendor-paid` | driver (kuryer) | `{ amount, method: 'cash'\|'wallet' }` |
| `GET /drivers/me/shift-pass` | driver | `{ enabled, price, durationHours, serviceTypes, current: ShiftPass\|null, comparison }` |
| `POST /drivers/me/shift-pass` | driver | `ShiftPass` (400 o'chiq/balans, 409 faol smena bor) |
| `GET /admin/shift-passes?from&to` | admin | `{ from, to, totals: { count, revenue, cancelled, activeNow }, items: (ShiftPass & { driverPhone, driverName })[] }` |
| `GET /orders/earnings/breakdown` | driver | §9 |

`ShiftPass = { id, driverId, startsAt, endsAt, price, status: 'active'|'expired'|'cancelled',
serviceTypes, transactionId, createdAt }`.
`comparison = { periodDays: 7, commissionPaid, workingDays, passCost, cheaperOption:
'shift_pass'|'commission'|'equal', savings }`.
`/admin/shift-passes`: standart oraliq — oxirgi 30 kun; `from`/`to` ISO; eng ko'pi 500 qator,
`totals` esa butun oraliq bo'yicha. `revenue` bekor qilinganlarsiz.

Realtime: `vendor:wallet_settled` (sotuvchi egasiga).

**To'lov tuzatishi.** `PaymentsService.findPaymentTransaction` endi faqat to'lovchining
(yo'lovchi/mijoz) qatorini tanlaydi va `'commission'` / `'tax_withholding'` belgili qatorlarni
hech qachon olmaydi — ilgari karta safarida provayder callback'i haydovchining komissiya yoki soliq
qatorini topib, summa tekshiruvida haqiqiy to'lovni rad etardi.

### 2-bosqich ochiq savollari

Quyidagilar 3-bosqichda (§11–17) yopildi: matching hamyon filtri (§14), olib ketilgandan keyin
bekor qilishda teskari o'tkazma (§14), smenani bekor qilish/qaytarish (§15), kuryer hamyonini
o'zi to'ldirishi (§11) va 2026-12-12 oldidan ogohlantirish (§16), `drivers.balance` yagona manba
(§13), platforma STIR'i (§15).

---

# 3-bosqich (2026-10-15, migratsiya 027)

## 11. Hamyonni Payme / Click / UZPS orqali o'zi to'ldirish

| Sozlama | Standart |
|---|---|
| `walletTopupEnabled` | `false` (merchant kalitlari ulanganda admin yoqadi) |
| `walletTopupMin` / `walletTopupMax` | `10 000` / `2 000 000` so'm |
| `walletTopupPresets` | `[50000, 100000, 200000]` (min ≤ har biri ≤ max, saralanadi) |

- Jadval `wallet_topups`: `id`, `seq` (bigserial — Click `merchant_prepare_id`), `user_id`,
  `amount`, `provider` (`payme|click|uzcard`), `status` (`pending|paid|failed|cancelled|expired`),
  `external_id` (provayder tranzaksiyasi, unikal), `created_at`, `paid_at`, `cancelled_at`.
- Merchant havolasi — **`topup_<id>`** (Payme `account.order_id`, Click `merchant_trans_id`,
  UZPS `order_id`). Buyurtma to'lovlari yalang UUID bilan boradi — callback oqimi prefiksdan
  ajraladi; Payme'ning faqat `id` keladigan chaqiruvlari `wallet_topups.external_id` bo'yicha.
  Imzo tekshiruvi buyurtma to'lovlari bilan umumiy (kalitsiz — rad).
- **Kirim faqat `paid` ga o'tishda**: bitta tranzaksiya, hamyon + qator qulfi, `pending → paid`,
  daftar CREDIT `wallet_topup_<id>` (unikal indeks `uq_transactions_wallet_topup`),
  `drivers.balance` sinxroni. Takroriy callback hech narsa yozmaydi. Keyin push «Hamyoningiz N
  so'mga to'ldirildi» + realtime `wallet:updated`.
- To'langandan keyin bekor/refund → `cancelled` + DEBIT `wallet_topup_reversal_<id>` (manfiyga
  tushsa — oflayn). To'lanmagan bekor → `cancelled`/`failed`, daftarga tegmaydi. 12 soatdan
  eski `pending` → `expired` (soatlik cron).
- Protokollar: **Payme va Click — buyurtma to'lovi bilan umumiy implementatsiya (§18)**;
  UZPS (`payments/wallet-topup-callbacks.service.ts`): `PAID` → kirim (tiyin), `FAILED|CANCELLED` → bekor.
- Provayder kalitlari sozlanmagan bo'lsa yaratish 400 («Bu to'lov tizimi hali ulanmagan»).

## 12. Qo'lda to'ldirish (`PATCH /drivers/:id/balance`) va amallar jurnali

- `note` **majburiy** (bo'sh/yo'q → 400 «Izoh majburiy: ...», ≤200 belgi). web-manager va
  web-admin formalarida majburiy maydon.
- Bitta tranzaksiyada: `audit_logs` yozuvi (`wallet.manual_adjustment`, aktyor, haydovchi, summa,
  izoh) + daftar qatori `manual_adjustment_<auditId>` (izoh endi `external_id` ga yozilmaydi) +
  ustun sinxroni. Keyin push: «Hamyoningizga N so'm qo'shildi: <izoh>» /
  «Hamyoningizdan N so'm yechildi (tuzatish): <izoh>» + `wallet:updated`.
- Javob: `Driver & { walletBalance }`.
- «Amallar tarixi» (`dispatch_overrides`) faqat buyurtma qayta biriktirish uchun — shuning uchun
  umumiy jadval `audit_logs` va `GET /admin/audit-log` qo'shildi (panel sahifasi hali yo'q).

## 13. `drivers.balance` — yagona haqiqat manbai daftar

Ustun endi daftarning **keshi**: har pul harakati (safar/komissiya/soliq, chaqiq, smena va uning
qaytarimi, sotuvchiga o'tkazma va teskarisi, to'ldirish va teskarisi, qo'lda tuzatish, yechish va
rad etilgan yechish, bonus, referal) o'z tranzaksiyasida `syncDriverBalanceColumn` ni chaqiradi:
`balance = SUM(completed credit) − SUM(completed debit)`. Avtomatik oflayn qilish ham daftar
bo'yicha (`< 0`, onlayn darvoza bilan bir qoida). `DriversService.adjustBalanceWithin` endi
`balance + delta` emas, sinxron qiladi. Migratsiya 027 barcha haydovchilar ustunini bir marta
tenglashtiradi. Qaror qabul qiladigan hech bir joy ustunni o'qimaydi.
(Topilgan xato: avvalgi `UPDATE … RETURNING` natijasi TypeORM'da `[rows, count]` bo'lib keladi,
shu sabab `wentOffline` hech qachon `true` bo'lmasdi — tuzatildi.)

## 14. Hamyon rejimi: matching va teskari o'tkazma

- **Taklif filtri**: naqd ovqat/market yetkazishi (`details.payVendor > 0`) hamyon rejimida
  sarflanadigan qoldig'i `payVendor` dan kam kuryerga taklif qilinmaydi (birinchi qidiruv va
  qayta qidiruv; balanslar bitta guruhlangan so'rovda). Filtr xato bersa — filtrsiz (qabul
  qilishdagi tekshiruv baribir himoya qiladi).
- **Teskari o'tkazma**: kuryer safari `cancelled` bo'lsa (`DeliveryEventsService`) va sotuvchi
  buyurtmasi hamyon orqali hisoblangan, **yetkazilmagan** va hali shu safarga bog'langan bo'lsa:
  kuryer CREDIT `vendor_settlement_reversal_debit_<id>`, sotuvchi DEBIT
  `…_reversal_credit_<id>`, sotuvchi CREDIT `…_reversal_commission_<id>` (summalar asl
  qatorlardan). Buyurtmada `vendor_wallet_settled_at`, `vendor_cash_paid_at/confirmed_at`
  tozalanadi, `vendor_wallet_reversal_count` +1. Keyingi kuryer o'tkazmasi `_2`, `_3` …
  qo'shimchali belgilar bilan. Bir martalik (shartli yozuv + unikal indeks). Hodisalar:
  sotuvchiga `vendor:wallet_reversed { kind, vendorOrderId, amount, commission }`, kuryerga
  `wallet:updated`.

## 15. Smenani bekor qilish va platforma STIR'i

- `POST /admin/shift-passes/:id/cancel` `{ refund: boolean, reason: string }` (admin):
  holat `cancelled` (+ `cancelled_at`, `cancel_reason`, `refund_amount`), `refund: true` bo'lsa
  **`refund = floor(narx × (endsAt − max(hozir, startsAt)) / (endsAt − startsAt))`**
  (boshlanmagan — to'liq, tugagan — 0) CREDIT `shift_pass_refund_<id>`; `audit_logs`
  (`shift_pass.cancel`); push «Smenangiz bekor qilindi: hamyoningizga N so'm qaytarildi».
  Allaqachon bekor — 409, topilmasa — 404.
- `platformTin` (9 raqam | null) — `PATCH /settings/legal-compliance` orqali; smena fiskal
  yozuvida (`principal_type = 'platform'`) `principal_tin` sifatida.

## 16. 2026-12-12 oldidan kuryerlarga ogohlantirish

Cron har kuni 10:00 (Asia/Tashkent): `vendorWalletSettlementFrom` dan 14 kun oldin boshlab sana
kelguncha (hamyon rejimi hali amalda bo'lmasa) `service_types` da `food`/`market` bo'lgan faol
kuryerlarga push «12-dekabrdan restoran/do'kon bilan hisob-kitob hamyon orqali bo'ladi —
hamyoningizni to'ldiring». Idempotent: `courier_wallet_reminders (user_id, reminder_date)`.

## 17. 3-bosqich API (`/api/v1`, `{ success, data }`)

| Metod va yo'l | Rol | Javob (`data`) |
|---|---|---|
| `POST /payments/wallet/topup` `{ amount: int, provider: 'payme'\|'click'\|'uzcard' }` | driver | `WalletTopup & { topupId, checkoutUrl }` |
| `GET /payments/wallet/topup/:id` | driver (o'ziniki) | `WalletTopup` |
| `GET /payments/wallet/topups` | driver | `WalletTopup[]` (oxirgi 20) |
| `GET /settings/public` | kirgan | + `walletTopupEnabled, walletTopupMin, walletTopupMax, walletTopupPresets` |
| `GET` / `PATCH /settings/wallet-topup` | manager,admin / admin | `{ walletTopupEnabled, walletTopupMin, walletTopupMax, walletTopupPresets }` |
| `GET` / `PATCH /settings/legal-compliance` | | + `platformTin: string\|null` |
| `PATCH /drivers/:id/balance` `{ amount, note }` | manager(DRIVERS_FINANCE), admin | `Driver & { walletBalance }` |
| `GET /admin/audit-log?action&targetType&targetId&page&limit` | manager(DRIVERS_FINANCE), admin | `{ items: AuditLog[], total, page, limit }` |
| `POST /admin/shift-passes/:id/cancel` `{ refund, reason }` | admin | `ShiftPass & { cancelledAt, cancelReason, refundAmount }` |

`WalletTopup = { id, amount, provider, status, createdAt, paidAt, cancelledAt, expiresAt }`.
`AuditLog = { id, actorUserId, action, targetType, targetId, amount, note, metadata, createdAt }`.

Realtime: `wallet:updated { balance, delta, reason: 'topup'|'topup_reversal'|'manual_adjustment'|
'shift_pass_refund'|'vendor_settlement_reversal', topupId?|auditLogId?|shiftPassId?|vendorOrderId? }`
(haydovchiga; ilova shu bilan hamyon ekranini yangilaydi), `vendor:wallet_reversed` (sotuvchiga).
Push `data.event`: `wallet_topup_paid`, `wallet_topup_reversed`, `wallet_manual_adjustment`,
`shift_pass_cancelled`, `courier_wallet_settlement_reminder`.

### 3-bosqich ochiq savollari

- Merchant kalitlari (Payme/Click) yo'q — haqiqiy kassada sinalmagan. Dev `.env` dagi
  `PAYME_MERCHANT_ID` placeholder bo'lgani uchun dev'da Payme «sozlangan» ko'rinadi.
- ~~Buyurtma oqimidagi Click `action === 2`, Payme JSON-RPC konverti, kuryer qayta biriktirilganda
  teskari o'tkazma, smena qaytarimining fiskal cheki~~ — 4-bosqichda yopildi (§18–20).
- `audit_logs` uchun web-manager sahifasi yo'q (faqat API).

# 4-bosqich — go-live tuzatishlari (2026-10-15, migratsiya 028)

## 18. Payme Merchant API va Click SHOP API — yagona implementatsiya

Buyurtma to'lovi (havola — buyurtma UUID'i) va hamyonni to'ldirish (`topup_<id>`) endi BITTA
protokol kodidan o'tadi: `payments/merchant/payme-merchant.service.ts`,
`payments/merchant/click-shop.service.ts`. Protokol holati — yangi jadval `merchant_transactions`
(`provider`, `external_id` [Payme `id` / Click `click_trans_id`, `(provider, external_id)` unikal],
`target_kind` `order|topup`, `target_ref`, `amount` so'mda, `state` 1/2/−1/−2, `seq` [Click
`merchant_prepare_id`, Payme `transaction`], `provider_time` [Payme `time`], `account`,
`create_time`, `perform_time`, `cancel_time`, `reason`). Pul qoidalari nishonning o'z servisida
(`PaymentTargetsService` → `PaymentsService.completeOrderPayment/refundOrderPayment` yoki
`WalletTopupsService.markPaid/cancel`), bir martalik: daftardagi `external_id` = `payme_<id>` /
`click_<click_trans_id>`; xuddi shu tranzaksiya takrori — o'zgarishsiz, boshqa tranzaksiya bilan
to'langan nishon — rad.

**Javob konverti.** `POST /api/v1/payments/payme/callback` va `/click/callback` — `@RawResponse()`
(global interseptor `{ success, data }` ga o'ramaydi), `@SkipThrottle()`, HTTP 200. Payme yo'lidagi
har qanday istisno ham 200 + JSON-RPC (buzilgan JSON → −32700, boshqasi → −32400;
`HttpExceptionFilter`). Boshqa yo'llar o'zgarmagan.

**Payme** (developer.help.paycom.uz): `{ jsonrpc: '2.0', id, result }` /
`{ jsonrpc: '2.0', id, error: { code, message: { uz, ru, en }, data? } }`. Basic auth faqat
`Paycom:<PAYME_SECRET_KEY>` (avvalgi spetsifikatsiyadan tashqari sha1 varianti olib tashlandi) —
aks holda −32504. Summalar tiyinda (×100), `account.order_id`.

| Metod | Natija | Xatolar |
|---|---|---|
| `CheckPerformTransaction` | `{ allow: true }` | −31001 summa; −31050 buyurtma topilmadi, −31051 to'lab bo'lmaydi, −31052 boshqa faol tranzaksiya (`data: 'order_id'`) |
| `CreateTransaction` | `{ create_time, transaction, state: 1 }` | mavjud tranzaksiya state≠1 yoki 12 soatdan eski (43 200 000 ms → state −1, reason 4) → −31008; nishonda bitta faol tranzaksiya (unikal indeks) |
| `PerformTransaction` | `{ transaction, perform_time, state: 2 }` (takror — o'sha) | −31003; state≠1 yoki muddati o'tgan → −31008 |
| `CancelTransaction` `{ id, reason }` | `{ transaction, cancel_time, state }` — 1→−1 (nishon bo'shatiladi), 2→−2 (refund: buyurtma `refunded`, to'ldirish teskari DEBIT); takror — o'sha | −31003 |
| `CheckTransaction` | `{ create_time, perform_time, cancel_time, transaction, state, reason }` (yo'q vaqt — 0) | −31003 |
| `GetStatement` `{ from, to }` | `{ transactions: [{ id, time, amount, account, create_time, perform_time, cancel_time, transaction, state, reason }] }` (Payme `time` bo'yicha) | — |
| boshqa (`ChangePassword` ham) | — | −32601 (`data` = metod); `params` yo'q → −32600 |

**Click SHOP API** (docs.click.uz, click-llc/click-integration-php): **action 0 = Prepare,
1 = Complete** (avvalgi buyurtma oqimi `2` ni kutardi — to'lov hech qachon yakunlanmasdi).
Imzo `md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + [merchant_prepare_id —
faqat Complete] + amount + action + sign_time)`. Javob: Prepare —
`{ click_trans_id, merchant_trans_id, merchant_prepare_id, error, error_note }`; Complete —
`{ click_trans_id, merchant_trans_id, merchant_confirm_id, error, error_note }`. Xatolar: 0 Success,
−1 SIGN CHECK FAILED!, −2 Incorrect parameter amount, −3 Action not found, −4 Already paid,
−5 User does not exist, −6 Transaction does not exist (noto'g'ri `merchant_prepare_id`), −7 Failed to
update user (ichki xato), −8 Error in request from click (majburiy maydon yo'q), −9 Transaction
cancelled (Complete'da Click `error < 0` → bekor, to'ldirish `failed`). Summa so'mda.

Buyurtma: to'lanmagan Payme/Click tranzaksiyasi bekor bo'lsa karta to'lovi qatori `pending` qoladi
(mijoz qayta to'lay oladi); to'ldirish esa bir martalik checkout — `cancelled`/`failed`.

## 19. Kuryer qayta biriktirilganda hamyon o'tkazmasi teskari

`OrdersDispatchService.reassignDriver` kuryer safarida oldingi kuryer bo'lsa
`DeliveryEventsService.publish(ride, 'reassigned', { previousCourierUserId })` qiladi.
`VendorCashService` §14 dagi mexanizm bilan teskari qiladi (`reverseVendorWalletSettlement`,
`courierUserId` — faqat SHU kuryer o'tkazgan bo'lsa; aks holda `other_courier`), keyingi kuryer olib
ketishda `_2`, `_3` … belgilari bilan yangidan o'tkazadi. Bir martalik, yetkazilgan buyurtmaga
tegilmaydi; kuryerga `wallet:updated`, sotuvchiga `vendor:wallet_reversed`. Mijozga
`food|market:order:courier { stage: 'accepted' }` (yangi kuryer).

## 20. Smena qaytarimining fiskal cheki

`fiscal_receipts` ga `receipt_type` (`sale|refund`, standart `sale`) va `original_receipt_id`;
unikallik `(order_id, receipt_type)`. `POST /admin/shift-passes/:id/cancel` qaytarim > 0 bo'lsa
`FiscalReceiptsService.recordShiftPassRefund`: `receipt_type = 'refund'`, `order_id` = smena id'si,
`original_receipt_id` = asl smena cheki (topilmasa null + ogohlantirish), summa = qaytarim (musbat,
turi belgilaydi), platforma sotuvchi (`principal_type = 'platform'`, `platform_role = 'seller'`).
Provayder payload'iga `receiptType`, `originalReceiptId`, `originalExternalId` qo'shildi. Bir
martalik; xato bekor qilishni buzmaydi.

### 4-bosqich ochiq savollari

- Merchant kalitlari hali yo'q — Payme sandbox (test.paycom.uz) va Click test kabinetida protokol
  sinovi kerak. `ChangePassword` qo'llab-quvvatlanmaydi (kalit env'da; −32601).
- ~~To'langan buyurtma qaytarilsa ulush qaytarib olinmaydi~~ — v4 da hal qilindi (§23).
- ~~Click Prepare tozalash cron'i yo'q~~ — v4 da hal qilindi (§24).

---

# API o'zgarishlari (v4) — 2026-10-15, migratsiya 029

Hammasi **qo'shimcha**: mavjud maydonlar o'chirilmagan, nomi o'zgarmagan. Prefiks `/api/v1`,
muvaffaqiyatli javob `{ success: true, data }` konvertida.

## 21. Xato konverti: mashina o'qiydigan `code`

Xato javobi avvalgidek `{ success: false, message, statusCode, timestamp, path }`. Kodli xatolarda
**qo'shimcha** maydonlar (faqat bor bo'lsa; oddiy xatolarda yo'q):

```json
{ "success": false, "statusCode": 400, "message": "Taksi uchun onlayn chiqa olmaysiz: …",
  "code": "LEGAL_NOT_ELIGIBLE",
  "reasons": [{ "code": "pinfl_missing", "message": "JShShIR (PINFL, 14 raqam) kiritilmagan" }],
  "details": { "…": "…" },
  "timestamp": "…", "path": "/api/v1/drivers/status" }
```

`message` va har bir `reasons[].message` `Accept-Language` bo'yicha o'giriladi (`ru…` → ruscha,
qolgani o'zbekcha; ichma-ich: sabablar va hujjat nomlari ham). `code`/`reasons[].code` — tilsiz,
o'zgarmas kontrakt; ilova shularga tayansin.

| `code` | HTTP | Qayerda | `details` |
|---|---|---|---|
| `LEGAL_NOT_ELIGIBLE` | 400 | `PATCH /drivers/status` (onlayn, taksi), `PATCH /drivers/me/services` (taksini yoqish) | — (`reasons[]` §5 dagi kodlar) |
| `WALLET_NEGATIVE_BALANCE` | 400 | `PATCH /drivers/status` (onlayn) | `{ balance }` |
| `WALLET_INSUFFICIENT_FOR_VENDOR` | 400 | `PATCH /orders/:id/accept`, `/vendor-paid`, `/start` (hamyon rejimi) | `{ required, balance }` |
| `SHIFT_PASS_DISABLED` | 400 | `POST /drivers/me/shift-pass` | — |
| `SHIFT_PASS_ACTIVE` | 409 | `POST /drivers/me/shift-pass` | — |
| `SHIFT_PASS_INSUFFICIENT_BALANCE` | 400 | `POST /drivers/me/shift-pass` | `{ price, balance }` |
| `WALLET_TOPUP_DISABLED` | 400 | `POST /payments/wallet/topup` | — |
| `WALLET_TOPUP_AMOUNT_OUT_OF_RANGE` | 400 | `POST /payments/wallet/topup` | `{ min, max }` |
| `WALLET_TOPUP_PROVIDER_UNAVAILABLE` | 400 | `POST /payments/wallet/topup` | — |
| `WALLET_TOPUP_PROVIDER_ERROR` | 400 | `POST /payments/wallet/topup` | — |
| `WALLET_TOPUP_TOO_MANY_PENDING` | 409 | `POST /payments/wallet/topup` (3 ta ochiq to'ldirish bor) | `{ maxPending }` |
| `WALLET_WITHDRAWAL_ON_HOLD` | 400 | `POST /payments/wallet/withdraw` (yangi karta to'ldirishi ushlab turilgan) | `{ available, held, holdDays }` |
| `LEGAL_PROFILE_LOCKED` | 403 | `PATCH /drivers/me/legal` (hujjat tasdiqlangan; PINFL/STIR/soliq maqomi/tug'ilgan sana) | — |
| `LEGAL_PROFILE_DUPLICATE` | 409 | `PATCH /drivers/me/legal`, `PATCH /drivers/:id/legal` | `{ field: 'pinfl'\|'tin' }` |
| `MANUAL_ADJUSTMENT_LIMIT` | 403 | `PATCH /drivers/:id/balance` (menejer) | `{ limit }` |

Summalar `details` da so'mda (son). Kodlar ro'yxati: `backend/src/common/errors/coded-error.ts`.

**RU tarjimalari** (`common/i18n/error-catalogue.ts`): yuqoridagi barcha xabarlar, §5 dagi barcha
sabab matnlari va 4 ta hujjat nomi. Muvaffaqiyatli javoblarda ham:
- `GET /drivers/me/legal`, `PATCH /drivers/me/legal` — `eligibility.reasons[].message` tilda;
- `GET /drivers/me/verification` — `taxi_licence`, `medical_check`, `carrier_insurance`,
  `tech_inspection` elementlarining `label`/`hint` va `blockedReason` tilda
  (manba: `drivers/legal-document-texts.ts`). Panellar (`/drivers/:id/legal`) — o'zbekcha.

## 22. Yangi maydonlar

**`GET /drivers`** (web-manager, web-admin; `DRIVERS_VIEW`) — har haydovchida:
```json
"legal": { "eligible": false, "blocking": true, "issueCount": 3 }   // yoki null (hisob xato bergan)
```
`blocking` — majburlash yoqilgan va taksi xizmati yoqilgan bo'lsa true; `issueCount` = `reasons`
soni (to'liq ro'yxat — `GET /drivers/:id/legal`). Sahifa uchun 3 ta so'rov (sozlama, talablar,
yuborilganlar), N+1 yo'q.

**`GET /admin/audit-log`** — har elementda `actor` (bitta so'rovda):
```json
"actor": { "id": "uuid", "name": "Ali Valiyev" | null, "phone": "+998…" | null, "role": "admin|manager|…" } | null
```
`null` — tizim amali (`actorUserId = null`) yoki o'chirilgan foydalanuvchi. Yangi `action` lar:
`vendor.tin_update`, `payment.refund_clawback`.

**Ovqat/market sotuvchi buyurtmasi JSON'i** (vendor/admin/mijoz qaytaradigan har joyda) —
`vendorWalletSettledAt`, `vendorWalletReversalCount` yoniga:
```json
"vendorWalletAmount": 145000 | null, "vendorWalletCommission": 15200 | null,
"vendorWalletReversedAt": "ISO" | null,
"vendorWalletSettlement": { "amount": 145000, "commission": 15200, "net": 129800,
                            "settledAt": "ISO" | null, "reversedAt": "ISO" | null, "reversalCount": 0 } | null
```
Summalar o'tkazma PAYTIDA saqlanadi (komissiya stavkasi keyin o'zgarsa ham o'sha raqam).
`null` — hech qachon hamyon orqali o'tkazilmagan. `settledAt != null` — hozir hisoblangan;
`settledAt == null && reversedAt != null` — teskari qilingan; ikkalasi bor — teskaridan keyin qayta
o'tkazilgan (`reversedAt` — oxirgi teskari payt). Migratsiya 029 mavjud buyurtmalarni daftardan
(oxirgi raund qatorlari) to'ldiradi.

**`GET /orders/earnings/breakdown`** — har davrda qo'shimcha:
```json
{ "gross": 20000, "commission": 2000, "taxWithheld": 0, "shiftPassCost": 0, "net": 18000, "trips": 1,
  "tips": 3000, "netWithTips": 21000 }
```
`net` ma'nosi **o'zgarmagan**: yo'l haqidan sof daromad, chaqiq kirmaydi. `tips` — davrdagi
yakunlangan safarlarning `orders.tip_amount` yig'indisi (komissiya/soliqsiz, to'liq hamyonga
tushadi). `netWithTips = net + tips` — haydovchining jami sof tushumi. **Hamyon bilan farq:** hamyon
qoldig'i naqd safarda faqat −komissiya −soliq, karta safarida +sof, chaqiqda +tips o'zgaradi; naqd
yo'l haqi haydovchining qo'lida — shu sabab `net` ≠ hamyon o'zgarishi (ekranda «Hamyon» uchun
`GET /payments/wallet` dan foydalaning).

**`GET /admin/shift-passes?from&to&page&limit`** — `page` (standart 1), `limit` (standart va eng
ko'pi 500 — avvalgi chegara). Javobga qo'shildi: `total, page, limit`. `totals.activeNow` endi
butun oraliq bo'yicha (SQL), faqat sahifadagilar emas.

**`GET /admin/tax-withholding/report.csv`** — oxirgi ustun `pending_withheld_amount` (JSON'dagi
`pendingWithheldAmount`); ustunlar tartibi avvalgidek, yangisi oxirida.

## 23. Yangi endpointlar va xulq

| Metod va yo'l | Rol | Body | Javob |
|---|---|---|---|
| `PATCH /food/admin/restaurants/:id/tin` | admin | `{ "tin": "123456789" \| null }` | `Restaurant` |
| `PATCH /market/admin/stores/:id/tin` | admin | `{ "tin": "123456789" \| null }` | `Store` |

`tin` — majburiy maydon: 9 raqam yoki `null` (tozalash). O'zgarish va `audit_logs`
(`vendor.tin_update`, `targetType: 'restaurant'|'store'`, `metadata: { previousTin, tin, name }`)
bitta tranzaksiyada; qiymat o'zgarmasa hech narsa yozilmaydi. 404 — topilmasa.

**Karta to'lovi qaytarilganda ulushni qaytarib olish (biznes qarori).** Payme `CancelTransaction`
(state 2 → −2) yoki UZPS `CANCELLED` (to'langan to'lovda) → `PaymentsService.refundOrderPayment` →
`OrderRefundClawbackService`:
- taksi safari: haydovchiga ochilgan sof ulush (yo'l haqi CREDIT − `commission` − `tax_withholding`,
  faqat COMPLETED karta oyoqlari) DEBIT `refund_clawback_driver_<orderId>`;
- ovqat/market: sotuvchi egasidan `<kind>_order_<id>` − `<kind>_order_commission_<id>` → DEBIT
  `refund_clawback_vendor_<vendorOrderId>`; kuryer safari (`deliveryOrderId`) — haydovchi qoidasi;
- hali ochilmagan (PENDING) oyoqlar → `refunded` (DEBIT kerak emas, endi ochilmaydi);
- bir martalik: oldindan tekshiruv + `uq_transactions_refund_clawback`; takroriy callback hech narsa
  yozmaydi (avvalgisi yiqilgan bo'lsa tiklaydi);
- `drivers.balance` sinxroni, manfiyga tushsa oflayn (+Redis); `audit_logs`
  (`payment.refund_clawback`, `actorUserId: null`, `amount`, `metadata: { userId, role, orderId,
  ledgerTag, providerExternalId, balanceAfter, wentOffline }`) — pul bilan bitta tranzaksiyada;
- push `data.event = 'payment_refund_clawback'` + realtime `wallet:updated { reason: 'refund_clawback',
  delta: −N, orderId }`;
- fiskal qaytarish cheki `FiscalReceiptsService.recordOrderRefund(orderId)` (taksi safari,
  sotuvchi buyurtmasi va kuryer safari uchun): asl SOTUV chekidan nusxa, `receipt_type = 'refund'`,
  `original_receipt_id`. Asl chek yo'q bo'lsa — yozilmaydi (ogohlantirish).
- Xatolar provayder javobini buzmaydi (log). Click SHOP API'da Complete'dan keyin bekor qilish
  protokoli yo'q — Click kabinetidan qilingan qaytarim avtomatik kelmaydi (qo'lda tuzatish §12).

## 24. Hamyonni to'ldirish: ilovaga qaytish va Click tozalash

**`WALLET_TOPUP_RETURN_URL`** (env, ixtiyoriy). `{id}` — to'ldirish id'si bilan almashtiriladi.
Masalan `angrengo://wallet/topup/{id}` yoki `https://angrengo.uz/app/wallet/topup/{id}` (deep link'ga
yo'naltiradigan sahifa). Payme checkout'da `c=`, Click'da `return_url`, UZPS'da `return_url` bo'lib
ketadi. Bo'sh — avvalgi xulq (Click/UZPS standart manzil; Payme'da `c` yo'q).
Payme checkout havolasi hujjatdagi formatga o'tkazildi: `https://checkout.paycom.uz/<base64("m=…;
ac.order_id=…;a=<tiyin>;l=ru[;c=…]")>` (avval JSON va `c` = callback API'si edi).

**Flutter ilovasi ro'yxatdan o'tkazishi kerak:** `angrengo` sxemasi (Android `intent-filter`
`<data android:scheme="angrengo" android:host="wallet" android:pathPrefix="/topup/"/>`, iOS
`CFBundleURLSchemes: [angrengo]`), yoki https varianti uchun App Links / Universal Links. Ilova
`angrengo://wallet/topup/<id>` ni ochganda `GET /payments/wallet/topup/<id>` ni so'raydi (holat
callback bilan kelgan bo'ladi; `pending` bo'lsa bir necha soniya so'rab turadi yoki
`wallet:updated` ni kutadi). Qaytish to'lovni TASDIQLAMAYDI — faqat callback tasdiqlaydi.

**Click Prepare tozalash:** soatlik cron (`click-prepare-cleanup`) — Prepare'dan keyin
`CLICK_PREPARE_TTL_MINUTES` (standart 60) ichida Complete kelmagan Click qatorlari → `state = −1`,
`cancel_time`. Pul va nishonga ta'siri yo'q; kech kelgan Complete → −9.

**Xavfsizlik — boolean env.** `OTP_BYPASS_ENABLED` endi aniq o'qiladi (`common/utils/env-boolean.util.ts`):
`true`/`1` → true; `false`/`0`/`no`/`off`/bo'sh/yo'q → false; boshqa qiymat — ilova ko'tarilmaydi.
Avval global implicit conversion `"false"` ni `true` qilardi (ConfigService validatsiyadan o'tgan
qiymatni qaytaradi) — ya'ni `OTP_BYPASS_ENABLED=false` yozilgan **dev/test** server bypass'ni yoqiq
deb o'qirdi. Productionda ikkinchi darvoza `ALLOW_OTP_BYPASS_IN_PROD === 'true'` (aynan satr) o'zgarmagan.

Yangi env: `WALLET_TOPUP_RETURN_URL` (bo'sh), `CLICK_PREPARE_TTL_MINUTES` (60).


---

# 25. Xavfsizlik tuzatishlari (security review, 2026-10-15, migratsiya 030)

Hammasi regressiya testlari bilan (`*.security.spec.ts`, `merchant-security.spec.ts`,
`payments.service.withdrawal-hold.spec.ts`, `drivers.controller.pii.spec.ts` va b.).

**Pul oqimlari**
- **Bitta to'ldirish — bitta provayder, bitta tranzaksiya (#1).** `topup.provider` callback
  provayderiga teng bo'lishi shart (boshqasi: Payme −31051, Click Prepare −9). To'ldirish birinchi
  faol tranzaksiyaga bog'lanadi (`wallet_topups.external_id` = `payme_<id>` / `click_<click_trans_id>`
  / UZPS `transaction_id`, Payme `CreateTransaction` va Click Prepare'da); boshqa tranzaksiya — Payme
  −31052, Click −9. `markPaid`: PAID + boshqa `externalId` → `invalid_state` (Payme Perform −31008,
  Click −4/−9) — ikkinchi yechim capture qilinmaydi.
- **Perform/Cancel poygasi (#8).** Payme `Perform`/`Cancel` va Click `Complete` — bitta DB
  tranzaksiyasida, `merchant_transactions` qatori `FOR UPDATE` ostida; holat o'tishi va pul effekti
  (to'ldirish kirimi / buyurtma to'lovi + haydovchi ulushi) birga commit bo'ladi. Push/Redis —
  commit'dan keyin. Buyurtma refund'i (clawback, fiskal chek) — commit'dan keyin, bir martalik.
- **Summalar butun tiyinda (#10)** (`payments/tiyin.ts`): Payme `amount` butun musbat tiyin bo'lishi
  shart, qat'iy tenglik (1 tiyin farq yoki kasr → −31001); Click/UZPS/buyurtma — `round(x·100)`
  qat'iy teng, kasr tiyin rad.
- **Click `error` (#11).** `error` imzoga kirmaydi — bekor qilish faqat mos (`click_trans_id`,
  `merchant_prepare_id`, `merchant_trans_id`, **summa**) tayyorlangan tranzaksiyada.
- **UZPS (#7).** Imzo `status`/`transaction_id` ni qamramaydi. Endi: `terminal_id` =
  `UZCARD_TERMINAL_ID` (aks holda imzo xatosi); `transaction_id` majburiy va to'ldirishda saqlangan id
  bilan teng; PAID → kirimdan oldin status API (`UzcardProvider.fetchStatus`, `GET /payment/status/<id>`)
  `PAID` deyishi shart (aks holda `NOT_CONFIRMED`); to'langan to'ldirish/buyurtmani CANCELLED/FAILED
  bilan qaytarish — status API `PAID` emasligini tasdiqlasagina; `failed/cancelled` dan PAID ga o'tish
  yo'q. Buyurtma oqimida ham xuddi shunday (status API), lekin buyurtma qatorida provayder id'si
  bog'lanmagan (bir buyurtmaga bir necha `initiate`) — ochiq savol.
- **Ochiq to'ldirishlar (#13).** Foydalanuvchida ko'pi bilan 3 ta `pending` (12 soatdan yosh);
  o'sha summa + provayder (Payme/Click, hali bog'lanmagan) — mavjudi qaytariladi (o'sha `topupId`).
- **Yechish ushlab turilishi (#3a).** `available = max(0, balance − Σ paid top-ups (oxirgi
  walletTopupHoldDays kun))`. To'ldirilgan pul komissiya/smena/sotuvchiga o'tkazmaga sarflanadi,
  lekin shu muddatda yechib olinmaydi (`WALLET_WITHDRAWAL_ON_HOLD`). Tekshiruv hamyon qulfi ichida.
- **Sotuvchi hamyoni qulfi (#3b, #9).** O'tkazma ham, teskari o'tkazma ham avval kuryer + sotuvchi
  hamyonini (`lockWalletsForUpdate`, id bo'yicha saralangan), keyin buyurtma qatorini qulflaydi.
  Sotuvchi yechishi o'sha advisory kalit (`hashtext(userId)`) ostida — teskari DEBIT bilan ketma-ket.
- **Qo'lda tuzatish (#6).** `amount` butun so'm, `−5 000 000 … 5 000 000`, ≠ 0 (DTO + servis);
  menejer |summa| ≤ `manualAdjustmentManagerLimit` (aks holda 403 `MANUAL_ADJUSTMENT_LIMIT`), admin —
  5 000 000 gacha.

**Shaxsiy ma'lumotlar**
- **#2.** `GET /drivers`, `GET /drivers/:id`, `PATCH /drivers/:id/approve|balance|commission-rate|tariff-tier`
  javoblarida **`pinfl`, `tin`, `birthDate` yo'q**. Faqat `GET /drivers/:id/legal`; DRIVERS_APPROVE'siz
  menejerga PINFL/STIR niqoblangan (`**********1234`, `*****6789`). Panellar (web-admin/web-manager)
  bu maydonlarni ro'yxatdan o'qimaydi — huquqiy kartochka `/drivers/:id/legal` dan.
  Soliq hisoboti (`/admin/tax-withholding/report[.csv]`, faqat admin) — to'liq qiymatlar
  (deklaratsiya uchun kerak), ataylab niqoblanmagan.
- **#4.** PINFL/STIR/soliq maqomining har o'zgarishi `audit_logs` da (`driver.legal_update`,
  `metadata: { self, changes: { pinfl: { from, to } … } }`, PINFL/STIR niqoblangan) — profil yozuvi
  bilan bitta tranzaksiyada. `drivers.pinfl` / `drivers.tin` — qisman unikal indekslar
  (`uq_drivers_pinfl`, `uq_drivers_tin`, `WHERE … IS NOT NULL`); takror → 409 `LEGAL_PROFILE_DUPLICATE`.
  Migratsiya mavjud takrorlarni topsa indeksni yaratmaydi (log ogohlantirishi; dev bazada takror yo'q).
  Taksi huquqiy hujjatlaridan biri tasdiqlangan (`ok|due_soon|overdue`) bo'lsa haydovchi PINFL, STIR,
  soliq maqomi, tug'ilgan sanani o'zi o'zgartira olmaydi (403 `LEGAL_PROFILE_LOCKED`); DRIVERS_APPROVE
  menejer/admin — `PATCH /drivers/:id/legal`. O'zgarmagan qiymatni qayta yuborish — ruxsat.
- **#5.** Profil yozuvi `update(id, o'zgarganlar)` — eski nusxa `balance`/`is_online` ni ustidan
  yozmaydi.

**Infratuzilma (#12).** Callback yo'llarini (`/api/v1/payments/{payme,click,uzcard}/callback`) Caddy
darajasida provayder IP'lari bilan cheklash tavsiya etiladi (IP ro'yxatini Payme/Click/UZPS kabinetidan
oling), masalan:
```
@payme_cb { path /api/v1/payments/payme/callback
            not remote_ip <PAYME_IP_1> <PAYME_IP_2> }
respond @payme_cb 403
```
`deploy/oracle/Caddyfile` deploy egasiniki — bu yerda faqat tavsiya.

**Yangi sozlamalar** (`GET`/`PATCH /settings/wallet-topup`, admin): `walletTopupHoldDays` (int, standart 7,
0 — o'chiq, ≤ 90), `manualAdjustmentManagerLimit` (so'm, standart 2 000 000, ≤ 5 000 000).
`GET /settings/public` ga `walletTopupHoldDays` qo'shildi (menejer chegarasi chiqmaydi).

**API o'zgarishlari (mijozlar moslashishi kerak)**
- `GET /payments/wallet` → `{ userId, balance, availableForWithdrawal, withdrawalHold, withdrawalHoldDays }`
  (qo'shimcha). Ilova "Yechish" uchun `availableForWithdrawal` ni ko'rsatsin.
- `POST /payments/wallet/topup` — bir xil summa+provayder qayta bosilsa avvalgi `topupId` qaytadi; 4-chisi 409.
- `GET /drivers` / `GET /drivers/:id` — `pinfl`, `tin`, `birthDate` olib tashlandi (BREAKING, faqat panellar uchun;
  ular foydalanmaydi).
- `GET /drivers/:id/legal` — DRIVERS_APPROVE'siz niqoblangan PINFL/STIR.
- `PATCH /drivers/me/legal` — 403 `LEGAL_PROFILE_LOCKED`, 409 `LEGAL_PROFILE_DUPLICATE`.
- `PATCH /drivers/:id/balance` — kasr/±5 mln dan katta → 400; menejer chegarasi → 403.
- UZPS callback javobi: yangi `message` qiymatlari `NOT_CONFIRMED`, `INVALID_REQUEST`.

---

## 26. Aksiya va promokod: kim ko'taradi, chek va hisob-kitob (migratsiya 031)

Manba: `docs/specs/food-market-ux-v5.md` §2, §4. Ovqat/market buyurtmasida ikki xil chegirma:

| | Aksiya (`promotions`) | Promokod (`promo_codes`) |
|---|---|---|
| Kim beradi | sotuvchi (panelda o'zi) | platforma (admin/menejer) |
| Kim ko'taradi | **sotuvchi** | **platforma** |
| Qayerda | qator narxi: `items[].price = finalPrice`, `unitPrice` (asl), `discountAmount` (bir dona) | `promoDiscount` ustuni, `totalPrice` ga KIRMAYDI |
| Tartib | avval | keyin (aksiyadan keyingi tovar summasiga) |

- **`totalPrice` = tovar (aksiyadan keyin) + yetkazish** — ma'nosi o'zgarmagan. Shu sabab
  sotuvchi komissiyasi (`round(totalPrice × rate / 100)`), hamyon o'tkazmasi (`payVendor` =
  aksiyali tovar summasi), yetkazilgandagi `settle*Earnings` va fiskal chek (`total` = tovar
  qismi) **chegirmali (haqiqiy) narxdan** hisoblanadi — aksiya sotuvchi ulushini kamaytiradi.
- Mijoz to'laydi: `payableTotal = totalPrice − promoDiscount` (JSON'da). Naqd buyurtmada kuryer
  `collectCash = totalPrice − promoDiscount` oladi (`DeliveryRideDetails.promoDiscount`).
- **Promokod qoplanishi** (`delivery/promo-compensation.ts`): naqd buyurtma yetkazilganda
  (komissiya bilan bir xil shartli o'tishda, bir martalik) naqdni olgan tomonga — platforma
  kuryeri yoki o'zi yetkazgan sotuvchi — `CREDIT promoDiscount`, `external_id =
  '<food|market>_order_promo_<id>'`, `payment_method = wallet`; kuryer bo'lsa `drivers.balance`
  keshi yangilanadi. Natijada sotuvchi ham, kuryer ham promokodsiz buyurtmadagidek oladi.
  Karta buyurtmasida yozuv yo'q: mijozdan kam undiriladi, sotuvchiga odatdagidek to'liq
  `totalPrice` CREDIT — farq platforma xarajati.
- **Fiskal chek:** komitent (sotuvchi/kuryer) cheki o'z sotuv summasi bilan (aksiyadan keyingi
  tovar / yetkazish haqi). Promokod — platformaning mijoz nomidan qisman to'lovi (marketing
  xarajati); chekda alohida "platforma to'lagan" qatori OFD integratsiyasida qo'shilishi kerak
  (provayder hali `noop`) — **yurist/buxgalter bilan tasdiqlang**.
- Promokod ishlatilishi ovqat/market buyurtmasida **yaratilganda** band qilinadi
  (`promo_code_usages.food_order_id|market_order_id`), mijoz yoki sotuvchi bekor qilsa
  bo'shatiladi (qator o'chadi, `used_count − 1`). Taksida avvalgidek safar yakunida.
- Ochiq: yetkazilgan buyurtma refund'ida (`order-refund-clawback`) promokod qoplanishi qaytarib
  olinmaydi — kerak bo'lsa alohida.

## 27. Pul oqimi auditi tuzatishlari (2026-10-16, migratsiya 033)

Besh agentli audit (hamyon, buyurtma pullari, bir vaqtdagi amallar,
algoritmlar) topgan xatolar va egasi tasdiqlagan to'rt biznes qarori.

### 27.1 Bonus pul yechib olinmaydi

Bonus pullar — haydovchi bonuslari (`bonus_rule_id`), referal bonuslari
(ikkala tomon, `referral_bonus_*`), bonus hisobidan berilgan chaqiriq
(`tip_bonus`) va hamyon bilan to'langan safar haqining yo'lovchi bonusidan
qoplangan qismi (`fare_bonus`) — hamyonda SARFLANADI, lekin yechib
olinmaydi. Bonus birinchi navbatda platforma to'lovlariga ketadi: komissiya,
1% soliq ushlovi, smena xaridi va sotuvchi komissiyasi. Hisob XRONOLOGIK:
bonusdan oldingi to'lovlar uni kamaytirmaydi.

`yechish mumkin = max(0, balans − ushlab turilgan karta to'ldirishlari −
sarflanmagan bonus)`; sarflanmagan bonus `GET /payments/wallet` da
`bonusBalance` bo'lib alohida chiqadi, haydovchi ilovasi uni izoh bilan
ko'rsatadi. Qo'lda tuzatish, promo kompensatsiya, safar daromadi va
ushlov muddati o'tgan to'ldirishlar — yechib olinadi.

Yo'lovchi hamyonini to'ldira olmaydi, ya'ni uning qoldig'i amalda bonus.
Shuning uchun u bonusni chaqiriq yoki hamyon bilan safar orqali
haydovchiga o'tkazsa, haydovchiga ham yechib bo'lmaydigan bo'lib tushadi
("soxta yo'lovchini taklif qilish → bonus → naqd" yo'li yopilgan).

Yo'lovchining NAQD yoki KARTA to'lovi hamyon qoldig'ini kamaytirmaydi
(ilgari naqd safar referal bonusini "yeb" qo'yardi); haydovchining naqd
safar komissiyasi va soliq qarzi esa hisobga olinadi.

Yechish so'rovi: butun so'm, 10 000 – 99 999 999.

### 27.2 Taksi promo kodini platforma to'laydi

§26 dagi ovqat/market modeli kabi. Yo'lovchi chegirmali narxni to'laydi
(`orders.final_price`, chek jami). Komissiya va 1% soliq CHEGIRMAGACHA yo'l
haqidan (`fare_breakdown.total`), `driver_earning = chegirmagacha − komissiya`
— haydovchi promo bilan ham, promosiz ham bir xil topadi. Karta/hamyon:
haydovchiga chegirmagacha to'liq summa CREDIT. Naqd: haydovchi chegirmali
summani qo'liga oladi, platforma chegirmani darhol yechib olinadigan
hamyoniga qoplaydi (`ride_promo_<orderId>`, buyurtmaga bitta).

Misol: 20 000 yo'l haqi, 5 000 promo, 10% komissiya → yo'lovchi 15 000,
komissiya 2 000, soliq 200, haydovchi sof 18 000 − 200; platforma xarajati
5 000. Daromad va 1% soliq hisobotlari yalpi daromadni
`final_price + discount_amount` dan oladi.

⚠️ Buxgalter uchun ochiq savol: chekda jami 15 000 va komissiya 2 000
turadi; platforma qoplagan 5 000 — marketing xarajati. OFD chegirma
qatorini talab qiladimi — aniqlash kerak.

### 27.3 Sotuvchi komissiyasi faqat tovardan

Restoran/do'kon komissiyasi tovar summasidan (`totalPrice − yetkazish
haqi`, aksiyadan keyingi narxlar), hech qachon yetkazish haqidan emas:
50 000 tovar + 8 000 yetkazish, 12% → 6 000 (ilgari 6 960). Platforma
kuryeri yetkazsa sotuvchi `tovar − komissiya` oladi (yetkazish haqi
kuryerniki); sotuvchi o'zi yetkazsa yetkazish haqi uning daromadi
(komissiyasiz) va chek buyurtma "yetkazildi" deb belgilanganda bir marta
yoziladi. Hamyon rejimi, yetkazishdagi hisob-kitob va chek bitta formulani
(`vendorOrderCommission`) ishlatadi.

### 27.4 Haydovchi qidiruvi

3 daqiqa (ilgari 60 s), radius 2 → 3 → 5 km — joriy radiusda bo'sh
haydovchi qolmaganda kengayadi. Taklif 15 s. Topilmasa yo'lovchiga push
ham boradi. Haydovchi faqat O'ZIGA taklif qilingan buyurtmani qabul qila
oladi (taklif tugagach ~5 s imtiyoz), aks holda 409; dispetcherning qo'lda
biriktirishi bundan mustasno, lekin band haydovchiga biriktirib bo'lmaydi
(409). Bloklangan haydovchi darhol oflayn bo'ladi va taklif olmaydi.
Yo'lovchi bekor qilsa yoki vaqt tugasa, taklifni ko'rib turgan haydovchiga
`order:cancelled {orderId}` boradi. Xato tufayli "qidirilmoqda"da qolgan
buyurtmalarni har 30 s reaper yopadi.

Surge talabi — oxirgi 10 daqiqada taksi buyurtma bergan ALOHIDA
yo'lovchilar (60 s ichida bekor qilinganlar va kuryer safarlari
sanalmaydi); taklif — onlayn, faol, taksi xizmatidagi haydovchilar.

### 27.5 Bir vaqtdagi amallar

- Safar ikki marta yakunlanmaydi: tranzaksiya ichidagi birinchi yozuv —
  `WHERE status = 'in_progress'` shartli da'vo; yutqazgan chaqiruv 409.
- Yechish so'rovini tasdiqlash/rad etish/to'landi — shartli o'tish;
  qaytarim bir marta (`uq_transactions_withdrawal_refund`), provayder bir
  marta (`withdrawal_requests.payout_started_at`). Jarayon provayder
  chaqiruvi o'rtasida o'lsa, so'rov `approved` + `payout_started_at`
  bilan qoladi: admin provayderda tekshirib, ustunni qo'lda tozalaydi.
- Referal bonusi buyurtmaga bir marta (`uq_transactions_referral_bonus`).
- Rejalashtirilgan safarda kutish `max(arrivedAt, scheduledAt)` dan
  hisoblanadi (yakuniy narx, taksometr va ilova hisoblagichi bir xil).

### 27.6 Kod ko'rigidan keyingi tuzatishlar va deploy eslatmalari

- Chaqim: to'lovchining bonusi DEBIT yozilishidan OLDIN o'lchanadi
  (aks holda bonusdan berilgan chaqim oddiy `tip` bo'lib, naqdga aylanardi).
- Hamyon bilan safar: yo'lovchi DEBIT'ining bonus qismi alohida
  `fare_bonus_spend` qatori — u bonus hisobini kamaytiradi. Jami DEBIT
  o'zgarmaydi; yo'lovchi tarixida bitta safar ikki qator bo'lib ko'rinishi
  mumkin.
- Promokod safar yakuni tranzaksiyasi ICHIDA band qilinadi (rollback
  bo'lsa foydalanish ham qaytadi).
- Buyurtma qulfi (`matching:lock:<id>`): TTL 30 s, bo'shatish — Lua
  compare-and-delete (faqat o'z tokeni).
- **Migratsiya 033 deploy'da:** `drivers.balance` keshini yangi formula
  bilan qayta hisoblaydi. Naqd/karta bilan safar qilgan foydalanuvchilar
  qoldig'i bir martalik OSHADI — bu eski xato tuzatilishi (avval ular
  noto'g'ri ayirilgan edi). Prod'da deploy'dan oldin va keyin
  `SELECT sum(balance) FROM drivers` ni solishtiring.
- **Osilib qolgan to'lov** (`approved` + `payout_started_at` bor, `paid`
  emas): avval provayder kabinetida pul ketganini tekshiring. Ketgan
  bo'lsa — `UPDATE withdrawal_requests SET status='paid', processed_at=now()
  WHERE id=$1 AND status='approved'`; ketmagan bo'lsa —
  `UPDATE withdrawal_requests SET payout_started_at=NULL WHERE id=$1` va
  paneldan qayta "to'landi" bosing.
- Dev'da `DB_SYNC=true` va daftarda takroriy `withdrawal_refund_%` /
  `referral_bonus_%` bo'lsa, synchronize yiqiladi (entity'da unikal
  indeks) — avval takrorlarni tuzating.
- Soliq hisoboti va haydovchi daromadi bazasi — `driver_earning +
  komissiya` (`driverGrossFareSql`). Yangi safarda bu chegirmagacha narx,
  §26a dan OLDINGI safarlarda — chegirmali narx (o'sha paytda komissiya va
  1% soliq shundan olingan). O'tgan oylar hisoboti ushlangan soliq bilan
  mos qoladi.
