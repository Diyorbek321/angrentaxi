# Food/Market UX v5 — API kelishuvi (backend ↔ ilova ↔ vendor panellar)

**Sana:** 2026-10-15 · **Manba:** yopiq sinovdagi foydalanuvchi fikri.
Backend shu shakllarni AYNAN shunday beradi; ilova shularga quriladi. O'zgartirish
kerak bo'lsa — shu faylni yangilang va boshqa tomonga xabar bering.
Barcha javoblar odatdagi `{success, data}` konvertida, pul — butun so'm.

## 1. Buyurtmani bekor qilish (yo'lovchi)

`POST /food/orders/:id/cancel` va `POST /market/orders/:id/cancel`
Body: `{ reason?: string }` (≤ 200 belgi).

- Faqat buyurtma egasi. Ruxsat etilgan holatlar: restoran/do'kon hali QABUL
  QILMAGAN (`new` / `pending`). Qabul qilingandan keyin → 409
  `{ code: 'ORDER_CANCEL_NOT_ALLOWED', message }` ("Restoran buyurtmani qabul
  qildi — bekor qilish uchun qo'llab-quvvatlashga yozing").
- Javob: yangilangan buyurtma (`status: 'cancelled'`, `cancelledBy: 'customer'`,
  `cancelReason`).
- Vendor panelga realtime hodisa (mavjud kanal orqali) va push.
- Kuryer tayinlangan bo'lsa — kuryer safari ham bekor qilinadi (mavjud mexanizm).
- Har bir buyurtma JSON'iga `canCancel: boolean` qo'shiladi (ilova tugmani
  shunga qarab ko'rsatadi).

Taksi buyurtmasini bekor qilish backendda bor — ilova uni topiladigan qilsin.

## 2. Promokod — ovqat va market uchun

Promokod entity'siga `serviceTypes: ServiceType[] | null` (null = hammasi,
mavjud kodlar uchun default null). Admin/manager promokod formalarida
tanlanadi.

`POST /promo-codes/validate` — body'ga ixtiyoriy `serviceType` va `amount`
(so'm) qo'shiladi. Javob (mavjud maydonlarga qo'shimcha):
`{ valid: boolean, code, discountType: 'percent'|'fixed', discountValue,
   discountAmount: number /* amount berilgan bo'lsa */, message? }`.
Xizmat turi mos kelmasa → `valid:false`, `code: 'PROMO_NOT_APPLICABLE'`.

`POST /food/orders` va `POST /market/orders` body'iga `promoCode?: string`.
Server qayta tekshiradi va hisoblaydi (klientga ishonmaydi). Buyurtma JSON'iga:
`promoCode: string|null, promoDiscount: number` (so'm). Promokod chegirmasi
PLATFORMA hisobidan (vendor ulushi kamaymaydi) — mavjud taksi qoidasiga mos.

## 3. Manzil tafsilotlari

`POST /food/orders` / `POST /market/orders` body'iga:
```
addressDetails?: {
  entrance?: string;   // Podyezd   ≤ 10
  floor?: string;      // Qavat     ≤ 10
  apartment?: string;  // Xonadon   ≤ 10
  intercom?: string;   // Domofon   ≤ 20
  landmark?: string;   // Mo'ljal   ≤ 120
  courierNote?: string // Kuryerga izoh ≤ 200
}
```
Buyurtma JSON'ida `addressDetails` (null bo'lishi mumkin) qaytadi — vendor
panel, kuryer ilovasi (haydovchi ilovasining yetkazish ekrani) va yo'lovchi
buyurtma tafsilotida ko'rsatiladi. Mavjud `note` (restoranga izoh) saqlanadi.

Saqlangan manzillar (favorites) bor bo'lsa — ularga ham shu maydonlar ixtiyoriy
qo'shiladi (keyingi buyurtmada avtomatik to'ldirish).

## 4. Restoran/do'kon chegirmalari (aksiyalar)

Vendor o'zi yaratadi. Entity `promotions`:
```
{ id, vendorType: 'restaurant'|'store', vendorId,
  title: string (≤ 60), description?: string (≤ 200),
  discountType: 'percent'|'fixed', discountValue: number,
  scope: 'all'|'category'|'items', categoryIds: string[], itemIds: string[],
  minOrderAmount?: number,
  startsAt: ISO, endsAt: ISO|null, isActive: boolean,
  createdAt, updatedAt }
```
Qoidalar: percent 1–90; fixed > 0 va taom narxidan kichik; bitta taomga bir
vaqtda faqat ENG KATTA chegirma qo'llanadi; chegirma VENDOR hisobidan
(vendor komissiyasi chegirmali narxdan hisoblanadi); promokod bilan
birga qo'llanadi (avval aksiya, keyin promokod).

Vendor API (restoran/market panel):
- `GET /food/vendor/promotions`, `POST`, `PATCH /:id`, `DELETE /:id`
- `GET /market/vendor/promotions`, `POST`, `PATCH /:id`, `DELETE /:id`

Storefront (ilova):
- `GET /food/restaurants` — har restoranga `activePromotion: { title,
  discountType, discountValue } | null` (eng kattasi).
- `GET /food/restaurants/:id` — menyu taomlariga `price` (asl),
  `finalPrice`, `discount: { title, discountType, discountValue } | null`;
  restoranga `promotions: Promotion[]` (faol).
- Market mahsulotlari uchun ham xuddi shunday `finalPrice` / `discount`.
- `GET /promotions/active?serviceType=food|market` — bosh ekrandagi
  "Chegirmalar" lentasi: `[{ id, title, description, discountType,
  discountValue, vendorType, vendorId, vendorName, vendorImageKey,
  endsAt }]`, eng katta chegirma birinchi.
- Buyurtma yaratishda server narxni `finalPrice` bo'yicha hisoblaydi;
  buyurtma qatoriga `unitPrice` (asl) va `discountAmount` yoziladi; buyurtma
  JSON'iga `promotionDiscount: number`.

## 5. Menyu kategoriyalari

`GET /food/restaurants/:id` javobida `categories: [{ id, name, sortOrder,
itemCount }]` va har bir taomda `categoryId`. Bo'sh kategoriyalar
qaytmaydi. (Mavjud bo'lsa — faqat shaklni tekshiring.)

---

## 6. Backend amalga oshirildi — aniqlashtirishlar (2026-10-16)

Migratsiya `031_food_market_ux_v5`. Yuqoridagi shakllar o'zgarmagan; quyidagilar QO'SHIMCHA
yoki aniqlashtirish:

**Bekor qilish (§1)**
- Javob 200. Ruxsat — faqat `status: 'new'` (food va market). 404 — boshqaning buyurtmasi.
  Restoran/do'kon shu lahzada qabul qilsa ham 409 `ORDER_CANCEL_NOT_ALLOWED`.
- Vendorga realtime: `food:order:cancelled` / `market:order:cancelled`,
  payload `{ orderId, cancelledBy: 'customer', cancelReason }`. Push (FCM) `event:
  food_order_cancelled|market_order_cancelled`. Mijozga `food|market:order:status`.
- Buyurtma JSON'ida: `cancelledBy: 'customer'|'vendor'|null`, `cancelReason`, `cancelledAt`.
  Restoran rad etsa — `cancelledBy: 'vendor'` (`rejectReason` avvalgidek).
- Market: bekor qilinganda zaxira qaytariladi. Promokod ishlatilishi bo'shatiladi.
- `new` holatda kuryer hali chaqirilmagan (kuryer `ready`/`shipped` da), shuning uchun kuryer
  safarini bekor qilish holati yuzaga kelmaydi.
- `canCancel` va `payableTotal` barcha buyurtma javoblarida (mijoz ro'yxati/tafsiloti,
  yaratish javobi, vendor ro'yxati).

**Promokod (§2)**
- `POST /promo-codes/validate` body: `{ code, amount?, serviceType?, orderAmount? }`
  (`orderAmount` — eski nom, `amount` ustun). `amount` berilmasa eng kam summa tekshirilmaydi,
  `discountAmount: 0`. Javob: `{ valid, code, discountType, discountValue, discountAmount,
  promoCodeId, finalAmount }`.
- `valid:false, code:'PROMO_NOT_APPLICABLE', message` (HTTP 200) — FAQAT xizmat turi mos
  kelmaganda. Boshqa xatolar (topilmadi, muddati o'tgan, limit, eng kam summa, allaqachon
  ishlatilgan) avvalgidek **HTTP 400** `{ success:false, message }` — eski taksi ilovasi shunga
  tayanadi. Ilova ikkalasini ham ko'rsatsin.
- Ovqat/market: promokod **aksiyadan keyingi tovar summasiga** (yetkazishsiz) qo'llanadi;
  chegirma tovar summasidan oshmaydi. `amount` sifatida shu summani yuboring.
- **Muhim:** `totalPrice` = tovar (aksiyadan keyin) + yetkazish, promokod KIRMAYDI.
  Mijoz to'laydigan summa — yangi `payableTotal = totalPrice − promoDiscount`. Ilova "Jami"
  da `payableTotal` ni ko'rsatsin.
- Yaroqsiz promokod bilan `POST /food|market/orders` → 400 (buyurtma yaratilmaydi).
- Admin/menejer `POST /promo-codes` body'ga `serviceTypes?: ('taxi'|'cargo'|'food'|'market'|
  'parcel')[] | null` (bo'sh/yo'q = null = hammasi). Javobda `serviceTypes`.
  Taksi/yuk/posilka buyurtmasida ham xizmat turi tekshiriladi.

**Manzil (§3)** — bo'sh joylar kesiladi; hammasi bo'sh bo'lsa `addressDetails: null`.
`POST /users/favorite-addresses` ham `addressDetails?` qabul qiladi va qaytaradi. Kuryer
ilovasi uchun kuryer safari `details.addressDetails` (+ `details.promoDiscount`) da.

**Aksiyalar (§4)**
- `minOrderAmount`li aksiya vitrinada `finalPrice` ga tushmaydi (savat noma'lum); buyurtmada
  ASL tovar summasi yetsa qo'llanadi (`activePromotion`/`promotions` da ko'rinadi).
- Qat'iy chegirma: `scope:'items'` da har tanlangan taom narxidan kichik bo'lishi shart (400);
  `all`/`category` da narxi chegirmadan kichik/teng taomga qo'llanmaydi.
- "Eng katta": foizli > qat'iy, bir turda qiymat bo'yicha (`activePromotion`, lenta tartibi).
  Bitta taomga — so'mda eng katta chegirma.
- Faol = `isActive && startsAt ≤ hozir && (endsAt null || endsAt > hozir)`. Vendor `GET`
  barcha (nofaol ham) aksiyalarni qaytaradi. `POST` da `startsAt` berilmasa — hozir. `DELETE`
  javobi `{ id }`. Begona aksiya → 404. Xatolar 400 (o'zbekcha matn).
- Buyurtma qatori: `price` = **undiriladigan** (chegirmali) narx, `unitPrice` = asl,
  `discountAmount` = BIR DONA uchun chegirma. Eski buyurtmalarda `unitPrice/discountAmount` yo'q.
- `GET /food/restaurants/:id`: `restaurant.promotions` + `restaurant.activePromotion`,
  qulaylik uchun yuqori darajada ham `promotions`. Market: `GET /market/stores` —
  `activePromotion`; `GET /market/stores/:id` — `store.promotions`, `products[].finalPrice/discount`.
- Vendor panel: `GET /food/vendor/dishes`, `GET /market/vendor/products` va
  `GET /market/vendor/products/browse` (`products[]`) da ham har elementga `finalPrice`,
  `discount` (vitrina bilan bir xil hisob).
- `GET /promotions/active` — faqat ochiq (active) restoran/do'konlar; `serviceType`siz —
  ikkalasi.

**Kategoriyalar (§5)** — `itemCount` = mavjud (isAvailable) taomlar soni; kategoriyasiz taomlar
`categoryId: null`. Market kategoriyalari shakli o'zgarmagan.

Pul oqimi va fiskal chek — `docs/LEGAL-COMPLIANCE.md` §26.

## 7. Bepul yetkazish va yetkazish vaqti (2026-10-16)

Mijoz ilovasi: **"Yetkazish 7 000 so'm · 30–50 daq · 100 000 so'mdan bepul"**. Migratsiya
`032_delivery_threshold_eta.ts` — `platform_settings` ga:

| Ustun | Tur | Standart | Ma'nosi |
|---|---|---|---|
| `free_delivery_from` | `numeric(12,2)` | 0 | Bepul yetkazish chegarasi, so'm; **0 — o'chiq** |
| `delivery_eta_min_minutes` | `int` | 30 | Yetkazish vaqti, eng kami (daq) |
| `delivery_eta_max_minutes` | `int` | 50 | Yetkazish vaqti, eng ko'pi (daq) |

- **Qoida** (`settings/delivery-pricing.ts` → `appliedDeliveryFee`): qo'llangan haq =
  `freeDeliveryFrom > 0 && itemsTotal ≥ freeDeliveryFrom ? 0 : deliveryFee`. `itemsTotal` —
  tovar summasi **aksiyadan KEYIN, promokoddan OLDIN** (`priceOrderLines().itemsTotal`, promokod
  ham shu summaga tekshiriladi). Ovqat va market `createOrder` da bir xil;
  `SettingsService.getDeliveryPricing()` → `{ deliveryFee, freeDeliveryFrom }`.
- `totalPrice = itemsTotal + qo'llangan haq` — bepulda `totalPrice = itemsTotal`. Yetkazish
  haqi alohida saqlanmaydi: hamma joyda `checkoutDeliveryFee(order) = totalPrice − Σ qty × price`
  dan olinadi, shuning uchun bepul buyurtmada kuryer safari narxi (`agreedFare`), `payVendor`,
  `collectCash`, sotuvchi fiskal cheki (`total` = tovar) — hech birida "7 000" qatori yo'q.
- Buyurtma JSON'i (mijoz javoblari, `withCustomerFields`): yangi **`deliveryFee`** —
  qo'llangan haq (bepulda 0), `canCancel`/`payableTotal` yonida.
- Fiskal: 0 so'mlik safar (bepul yetkazish kuryeri) uchun chek **yozilmaydi**
  (`recordForRide`, `total ≤ 0`).
- `GET /settings/public` va `GET/PATCH /settings/global`: `freeDeliveryFrom`,
  `deliveryEtaMinMinutes`, `deliveryEtaMaxMinutes`. Validatsiya: `freeDeliveryFrom ≥ 0`;
  vaqt butun son 5–240; joriy qiymat bilan birlashtirilgach `min ≤ max`, aks holda 400
  (o'zbekcha xabar), hech narsa yozilmaydi. PATCH endi faqat ruxsat etilgan maydonlarni
  bazaga yozadi (DTO'dan tashqari kalit o'tmaydi).
- Admin panel → "Umumiy sozlamalar" → "Ovqat va market: yetkazish" (haq, chegara, vaqt).
- Vaqt — faqat ma'lumot (ilova ko'rsatadi), hech narsani bloklamaydi.
- **OCHIQ (yoqishdan oldin hal qiling):** bepul buyurtmada kuryer safari `agreedFare = 0` —
  kuryer yetkazish uchun hech narsa olmaydi. Kim to'lashi (platforma kuryerga CREDIT qiladimi,
  promokod qoplanishi kabi — `delivery/promo-compensation.ts`) — biznes/buxgalter qarori.
  Shu hal bo'lmaguncha `freeDeliveryFrom = 0` (o'chiq) qoldiring.
