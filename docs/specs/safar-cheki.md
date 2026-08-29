# Safar cheki — bajarish spetsifikatsiyasi

> Tuzilgan: 2026-08-19 · mavjud kod o'qib chiqilgan holda
> Asos: [TASK-yandex-parity.md](../TASK-yandex-parity.md)

---

# "Safar cheki" — fayl darajasidagi bajarish rejasi

## 0. Nima allaqachon bor, nima yo'q (o'qilgan kod asosida)

**Bor:**
| Ma'lumot | Qayerda |
|---|---|
| Yakuniy narx (chegirmadan keyin) | `orders.final_price` — `orders-completion.service.ts:279` |
| Chegirma summasi | `orders.discount_amount` — `orders-completion.service.ts:280` |
| Haqiqiy masofa / vaqt | `trips.actual_distance_km`, `trips.actual_duration_min` — `orders-completion.service.ts:169-173` |
| Safar tugagan vaqt | `trips.end_time` (faqat shu yerda) |
| To'lov usuli | `orders.payment_method` |
| Tarif nomi | `orders.tariff` relation (`tariffs.name`) |
| To'lov holati (to'landi/qarz) | `transactions` (DEBIT, `user_id`=yo'lovchi, `order_id`) — `orders-completion.service.ts:285-293` |

**YO'Q (aniq aytaman, taxmin emas):**

1. **`orders` jadvalida `completed_at` ustuni umuman yo'q.** Butun backendda `completedAt` so'zi hech qayerda uchramaydi (grep tasdiqladi).
2. **Narx tarkibi (base / km / daqiqa / surge) hech qayerda saqlanmaydi.** `TariffsService.calculatePrice` (`tariffs.service.ts:87-103`) faqat bitta `number` qaytaradi.
3. **`orders` da surge koeffitsienti saqlanmaydi.** Yaratishda `zoneSurge` hisoblanadi (`orders-creation.service.ts:137`), narxga qo'shiladi va **tashlab yuboriladi**.
4. **`attachDisplayFields` (`orders-query.service.ts:233-312`) `distanceKm` / `durationMin` / `completedAt` ni javobga QO'SHMAYDI.** Lekin mobil `Order.fromJson` (`mobile/lib/shared/models/order.dart:153-156`) aynan shularni o'qiydi → **haqiqiy serverda ular doim `null`**. Ya'ni `order_detail_screen.dart:192-206` dagi "Masofa", "Davomiyligi", "Yakunlandi" qatorlari **prodda hech qachon ko'rinmaydi** — ular faqat demo rejimida ishlaydi (`mobile/lib/core/demo/demo_data.dart:114-118, 137-141`).
5. **Mobilda ulashish paketi yo'q** — `mobile/pubspec.yaml` da `share_plus` ham, `pdf`/`printing` ham yo'q.
6. **`promoCode` relation yuklanmaydi** (`orders-query.service.ts:56,72,105,121` — faqat `passenger`, `driver`, `tariff`), shuning uchun promokod matnini ("SUMMER25") hozir ko'rsatib bo'lmaydi.

---

## 1. Entity / migratsiya o'zgarishlari

### 1.1 `/home/diyorbek/AngrenTaxi/backend/src/database/entities/order.entity.ts`

`driverEarning` dan keyin (162-qatordan keyin) uchta ustun qo'shiladi:

```ts
// Chek uchun narx tarkibi. Chekni jonli tarifdan qayta hisoblab bo'lmaydi:
// tarif bir oydan keyin o'zgarsa, o'sha safar cheki BOSHQA raqam ko'rsatadi.
// Shuning uchun safar tugagan lahzadagi tarkib to'liq shu yerda muzlatiladi.
@Column({ name: 'fare_breakdown', type: 'jsonb', nullable: true })
fareBreakdown: FareBreakdown | null;

// `updated_at` chek sanasi bo'la olmaydi — undan keyingi har qanday yozuv
// (masalan PaymentsService.settleOrderPayout) uni surib yuboradi.
@Column({ name: 'completed_at', type: 'timestamp', nullable: true })
completedAt: Date | null;

// Buyurtma yaratilgan paytdagi hudud koeffitsienti. Hozir u
// OrdersCreationService da hisoblanib, narxga qo'shilib, tashlab yuborilardi —
// natijada chekda "nega qimmat?" savoliga javob beradigan hech narsa qolmasdi.
@Column({
  name: 'surge_multiplier',
  type: 'decimal',
  precision: 4,
  scale: 2,
  default: 1.0,
  transformer: {
    to: (value: number) => value,
    from: (value: string) => parseFloat(value),
  },
})
surgeMultiplier: number;
```

`FareBreakdown` tipi `orders.types.ts` da emas, `tariffs` modulida yashaydi (1.3 ga qarang) va entity uni import qiladi.

### 1.2 Yangi migratsiya: `/home/diyorbek/AngrenTaxi/backend/src/database/migrations/001_order_receipt.ts`

Jonli katalogda faqat `000_baseline.ts` bor (klass `Baseline1700000000000`), qolganlari `_archive/` da. Konvensiya: `export class OrderReceipt1700000000024 implements MigrationInterface { name = 'OrderReceipt1700000000024'; }`.

```sql
-- up()
ALTER TABLE "orders" ADD COLUMN "fare_breakdown" jsonb;
ALTER TABLE "orders" ADD COLUMN "completed_at" TIMESTAMP;
ALTER TABLE "orders" ADD COLUMN "surge_multiplier" numeric(4,2) NOT NULL DEFAULT 1.00;

-- Eski tugagan safarlarga chek sanasini trips.end_time dan tiklaymiz.
-- Bularda fare_breakdown NULL qoladi — chek ekrani buni "tarkib mavjud emas"
-- deb ko'rsatadi, soxta tarkib O'YLAB TOPMAYDI.
UPDATE "orders" o
   SET "completed_at" = t."end_time"
  FROM "trips" t
 WHERE t."order_id" = o."id"
   AND o."status" = 'completed'
   AND t."end_time" IS NOT NULL;

-- down(): uchta DROP COLUMN
```

**Diqqat:** `app.module.ts:138` da `migrationsRun: true` — migratsiya deployda avtomatik ishlaydi. `ADD COLUMN ... DEFAULT` PG 11+ da jadval qayta yozilmaydi, lock qisqa.

### 1.3 `Trip` entity o'zgarmaydi

`actual_distance_km` / `actual_duration_min` allaqachon `trips` da. Ularni `orders` ga denormalizatsiya qilish **kerak emas** — 2.3 dagi paketli JOIN yetarli.

---

## 2. Backend

### 2.1 `/home/diyorbek/AngrenTaxi/backend/src/modules/tariffs/tariffs.service.ts`

**Muammo:** hozirgi `calculatePrice` (87-103) `Math.max(tariff.minPrice, baseTotal) * surge` va `Math.min(raw, tariff.maxPrice)` qiladi. Ya'ni **"asos + km×narx + daqiqa×narx" YIG'INDISI umumiy summaga TENG EMAS** — minPrice/maxPrice cheklovi va surge ishlaganda. Frontendda oddiy itemizatsiya qilinsa, chek qatorlari jamiga qo'shilmaydi, bu chekni yo'qligidan ham yomon qiladi.

**Yechim:** yangi metod, `calculatePrice` esa uning ustidan yupqa qobiq bo'ladi — ikkalasi hech qachon ajralib keta olmaydi.

```ts
export interface FareBreakdown {
  baseFare: number;            // tariff.basePrice
  distanceKm: number;
  pricePerKm: number;
  distanceFare: number;        // distanceKm * pricePerKm
  durationMin: number;
  pricePerMin: number;
  timeFare: number;            // durationMin * pricePerMin
  minPriceAdjustment: number;  // max(0, minPrice - subtotal) — "eng kam haq"
  surgeMultiplier: number;     // max(tariff.surgeMultiplier, zoneSurge)
  surgeFare: number;           // (subtotal) * (surge - 1), musbat yoki 0
  maxPriceCap: number;         // manfiy yoki 0 — maxPrice kesib tashlagani
  total: number;               // == calculatePrice() natijasi, aynan
}

calculatePriceBreakdown(
  tariff: Tariff,
  distanceKm: number,
  durationMin: number,
  zoneSurge?: number,
): FareBreakdown

// Eski imzo saqlanadi (23 ta chaqiruv joyi bor), lekin endi delegatsiya:
calculatePrice(tariff, distanceKm, durationMin, zoneSurge?): number {
  return this.calculatePriceBreakdown(tariff, distanceKm, durationMin, zoneSurge).total;
}
```

**Invariant:** `baseFare + distanceFare + timeFare + minPriceAdjustment + surgeFare + maxPriceCap === total`. Bu spec bilan qo'riqlanadi (4.1).

### 2.2 `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders-completion.service.ts`

**a)** 160-165-qatorlar almashtiriladi:

```ts
const tariff = await this.tariffsService.findById(order.tariffId);
// Chekni saqlash uchun narxning O'ZI emas, tarkibi kerak.
// order.surgeMultiplier — buyurtma yaratilgan paytdagi hudud koeffitsienti.
// Ilgari bu yerga zoneSurge umuman uzatilmasdi: yakuniy narx faqat tarifning
// o'z surgeMultiplier'ini hisobga olardi, ya'ni yo'lovchiga ko'rsatilgan
// baholash bilan undirilgan summa turli koeffitsientda hisoblanardi.
const breakdown = this.tariffsService.calculatePriceBreakdown(
  tariff,
  actualDistanceKm,
  actualDurationMin,
  order.surgeMultiplier,
);
const finalPrice = breakdown.total;
```

> **QAROR TALAB QILINADI:** `order.surgeMultiplier` ni yakuniy hisobga qo'shish — biznes o'zgarishi (narxlar surge paytida oshadi). Agar bu hozir istalmasa, `zoneSurge` uzatilmaydi va `breakdown.surgeMultiplier` da faqat tarif koeffitsienti qoladi — chek baribir rost bo'ladi, lekin "chaqim" qatori 1.0 da turadi.

**b)** Tranzaksiya ichidagi `manager.update(Order, orderId, {...})` (277-282) kengaytiriladi:

```ts
await manager.update(Order, orderId, {
  status: OrderStatus.COMPLETED,
  finalPrice: discountedFinalPrice,
  discountAmount: finalDiscountAmount || null,
  driverEarning: netDriverEarning,
  // Chek ma'lumotlari ayni shu tranzaksiyada yoziladi: chek pul harakatining
  // qog'ozdagi aksi, ular ajralib qolsa chek yolg'on gapiradi.
  fareBreakdown: breakdown,
  completedAt: now,
});
```

`now` allaqachon 80-qatorda mavjud.

**c)** `walletShortfall` (267) allaqachon hisoblanadi — chek servisiga u kerak emas, chunki u `transactions` dan o'qiladi (2.4).

### 2.3 `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders-query.service.ts`

**`attachDisplayFields` ga trip paketli yuklamasi qo'shiladi** (296-qator atrofida, koordinatalar bloki yonida). Bu mavjud jim buzilishni tuzatadi (0-bo'lim, 4-band):

```ts
// Mobil `Order.fromJson` distanceKm/durationMin/completedAt ni kutadi, lekin
// ular hech qachon yuborilmasdi — natijada tarix ekranida "Masofa" va
// "Davomiyligi" qatorlari prodda hech qachon ko'rinmagan (demo rejimida esa
// ko'ringan, shuning uchun bu sezilmay qolgan).
// Bitta IN-so'rov: sahifa uchun N+1 emas.
const tripByOrderId = new Map<string, { distanceKm: number | null; durationMin: number | null }>();
if (orderIds.length > 0) {
  const trips = await this.tripRepository.find({ where: { orderId: In(orderIds) } });
  ...
}
...
orderRecord.distanceKm = trip?.actualDistanceKm ?? null;
orderRecord.durationMin = trip?.actualDurationMin ?? null;
orderRecord.completedAt = order.completedAt ?? null;
```

Buning uchun `OrdersQueryService` konstruktoriga `@InjectRepository(Trip) private readonly tripRepository: Repository<Trip>` qo'shiladi. `Trip` allaqachon `orders.module.ts:24` dagi `TypeOrmModule.forFeature` da bor — modul o'zgarmaydi, lekin **har bir spec faylida `getRepositoryToken(Trip)` provideri bo'lishi shart** (5-bo'limdagi tuzoq).

### 2.4 Yangi fayl: `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders-receipt.service.ts`

Alohida servis, chunki `orders-query.service.ts` allaqachon 313 qator va chek o'z domeniga ega (repo qoidasi: 200-400 qator).

```ts
@Injectable()
export class OrdersReceiptService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Transaction) private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    private readonly queryService: OrdersQueryService,
  ) {}

  /**
   * Tugagan safar cheki.
   *
   * Kirish huquqi GET /orders/:id bilan bir xil (yo'lovchi / tayinlangan
   * haydovchi / manager), chunki javob PII va manzillarni tashiydi.
   * Komissiya va driverEarning ATAYIN yo'q: chek yo'lovchi hujjati.
   */
  async getReceipt(orderId: string, user: { id: string; role: UserRole }): Promise<OrderReceiptDto>
}
```

Mantiq:
1. `const order = await this.queryService.findByIdForUser(orderId, user)` — huquq tekshiruvi qayta yozilmaydi.
2. `if (order.status !== OrderStatus.COMPLETED) throw new BadRequestException('Chek faqat tugagan safar uchun mavjud')`.
3. `promoCode` uchun alohida `this.orderRepository.findOne({ where: { id }, relations: ['promoCode'] })` YOKI (afzalroq) `findByIdOrThrow` dagi `relations` massiviga `'promoCode'` qo'shiladi — u eager emas, qo'shimcha JOIN arzon.
4. `trip = await this.tripRepository.findOne({ where: { orderId } })`.
5. To'lov holati:
```ts
const charge = await this.transactionRepository.findOne({
  where: { orderId, userId: order.passengerId, type: TransactionType.DEBIT },
  order: { createdAt: 'DESC' },
});
// PENDING = hamyon yetmagan yoki karta hali settle bo'lmagan (completion
// service dagi chargeStatus mantig'i).
```
6. Yig'ish:
```ts
{
  orderId, orderNumber: order.id.split('-')[0].toUpperCase(),
  completedAt, serviceType,
  pickupAddress, dropoffAddress, waypoints,
  tariffName, tariffId,
  distanceKm, durationMin,
  fare: order.fareBreakdown,          // null bo'lishi mumkin (eski safarlar)
  grossPrice: (order.finalPrice ?? 0) + (order.discountAmount ?? 0),
  discountAmount: order.discountAmount ?? 0,
  promoCode: order.promoCode?.code ?? null,
  total: order.finalPrice,
  paymentMethod, paymentStatus: charge?.status ?? null,
  unpaidAmount: charge?.status === PENDING ? charge.amount : 0,
  driver: { name, carModel, carNumber } | null,
}
```

### 2.5 Yangi DTO: `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/dto/order-receipt.dto.ts`

`@ApiProperty` bilan to'liq javob shakli (kirish DTO emas, Swagger javob modeli). `FareBreakdownDto` ichki klass sifatida.

### 2.6 `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.controller.ts`

**MUHIM tartib:** yangi marshrut `@Get(':id')` (190-qator) dan **OLDIN** turishi shart emas (chunki `:id/receipt` `:id` bilan to'qnashmaydi), lekin barcha `@Get('...')` literal marshrutlar bilan bir joyda turgani yaxshi. `@Get(':id')` dan keyin qo'yish xavfsiz:

```ts
@Get(':id/receipt')
@ApiOperation({ summary: 'Tugagan safar cheki (yo\'lovchi / haydovchi / manager)' })
@ApiParam({ name: 'id', description: 'Order UUID' })
@ApiResponse({ status: 200, description: 'Chek' })
@ApiResponse({ status: 400, description: 'Safar hali tugamagan' })
@ApiResponse({ status: 403, description: 'Bu buyurtma cheki sizga tegishli emas' })
async getReceipt(
  @CurrentUser() user: User,
  @Param('id', ParseUUIDPipe) id: string,
): Promise<OrderReceiptDto> {
  return this.ordersService.getReceipt(id, user);
}
```

Rol guard yo'q — huquq `findByIdForUser` ichida.

### 2.7 `orders.service.ts` (fasad) va `orders.providers.ts`

- `orders.providers.ts:17-28` — `OrdersReceiptService` massivga qo'shiladi.
- `orders.service.ts` — konstruktorga `private readonly receiptService: OrdersReceiptService`, va "Reads" bo'limiga:
```ts
getReceipt(id: string, user: { id: string; role: UserRole }): Promise<OrderReceiptDto> {
  return this.receiptService.getReceipt(id, user);
}
```
- `orders.module.ts` o'zgarmaydi (`Trip`, `Transaction`, `Order` allaqachon `forFeature` da, provayderlar `ORDERS_PROVIDERS` orqali keladi).

---

## 3. Mobil

### 3.1 `/home/diyorbek/AngrenTaxi/mobile/pubspec.yaml`

```yaml
  # Chekni ulashish (matn; keyinchalik PNG uchun ham shu paket)
  share_plus: ^10.1.2
```
`flutter pub get` → `pubspec.lock` yangilanadi. iOS uchun qo'shimcha sozlama shart emas; Android `share_plus` FileProvider'ini o'zi e'lon qiladi.

### 3.2 Yangi model: `/home/diyorbek/AngrenTaxi/mobile/lib/shared/models/order_receipt.dart`

```dart
class FareLine extends Equatable { final String label; final double amount; }
class OrderReceipt extends Equatable {
  final String orderId, orderNumber;
  final DateTime? completedAt;
  final String pickupAddress, dropoffAddress, tariffName;
  final double? distanceKm;
  final int? durationMin;
  final FareBreakdown? fare;     // null bo'lishi MUMKIN — eski safarlar
  final double grossPrice, discountAmount, total;
  final String? promoCode;
  final String paymentMethod;    // 'cash' | 'card' | 'wallet'
  final String? paymentStatus;   // 'completed' | 'pending' | ...
  final double unpaidAmount;
  final String? driverName, carModel, carNumber;

  factory OrderReceipt.fromJson(Map<String, dynamic> json);

  /// Ulashish uchun oddiy matn. PDF emas — matn har qanday messengerda
  /// (Telegram, SMS) o'qiladi va hech qanday render bog'liqligi yo'q.
  String toShareText();
}
```

### 3.3 `/home/diyorbek/AngrenTaxi/mobile/lib/shared/models/order.dart`

O'zgarish **shart emas** — `distanceKm`/`durationMin`/`completedAt` allaqachon parse qilinadi va 2.3 dan keyin ular haqiqiy qiymat ola boshlaydi. (Ya'ni bitta backend tuzatuvi mavjud UI ni "jonlantiradi".)

### 3.4 `/home/diyorbek/AngrenTaxi/mobile/lib/core/network/api_endpoints.dart`

`orderById` yonida (31-qatordan keyin):
```dart
  // GET /orders/:id/receipt — tugagan safar cheki (backend/src/modules/orders/
  // orders-receipt.service.ts). GET /orders/:id dan farqi: narx tarkibi,
  // chegirma va to'lov holati bilan, lekin komissiyasiz.
  static String orderReceipt(String id) => '/orders/$id/receipt';
```

### 3.5 `/home/diyorbek/AngrenTaxi/mobile/lib/features/passenger/order_provider.dart`

Yangi holat + metod (`loadOrderHistory` yonida, ~442-qator):

```dart
OrderReceipt? _receipt;
bool _receiptLoading = false;
String? _receiptError;

OrderReceipt? get receipt => _receipt;
bool get receiptLoading => _receiptLoading;
String? get receiptError => _receiptError;

/// Chekni serverdan oladi. Chek KESHLANMAYDI: har ochilishda so'raladi,
/// chunki karta to'lovi keyin settle bo'lsa to'lov holati o'zgaradi.
Future<void> loadReceipt(String orderId) async { ... }
void clearReceipt() { ... }
```

`_apiClient.get(ApiEndpoints.orderReceipt(orderId))` → `response.data['data']` (mavjud envelope shakli, `loadOrderHistory` dagidek) → `OrderReceipt.fromJson`. Xato: `extractErrorMessage(e)`.

### 3.6 Yangi ekran: `/home/diyorbek/AngrenTaxi/mobile/lib/features/passenger/screens/trip_receipt_screen.dart`

`OrderDetailScreen` ni **kengaytirmaymiz** — u ikkala vertikal (taksi + cargo) uchun umumiy "buyurtma tafsiloti", chek esa faqat tugagan taksi safari uchun. Yangi ekran `TripReceiptScreen({required String orderId})`.

Tuzilishi (`ag_design.dart` tokenlari, hech qanday hardcode rang):

```
AgHeader(
  title: 'Safar cheki',
  subtitle: Formatters.formatDateTime(receipt.completedAt),
  onBack: ...,
  trailing: AgIconButton(              // AgHeader da `trailing` sloti BOR (ag_design.dart:210)
    icon: Icons.ios_share_rounded,
    onTap: _share,
    semanticsLabel: 'Chekni ulashish',
  ),
)
body: ListView(
  1. _ReceiptHeaderCard   — jami summa (kFontH1), status rozetkasi
  2. _RouteCard           — pickup → waypoints → dropoff (mavjud `_Point` uslubi)
  3. _TripFactsCard       — Tarif · Masofa · Davomiyligi
  4. _FareBreakdownCard   — CHEKNING YURAGI (pastda)
  5. _PaymentCard         — to'lov usuli + holati; unpaidAmount > 0 bo'lsa kError ogohlantirish
  6. _DriverCard          — driver != null bo'lsa
)
bottomNavigationBar: SafeArea + AppButton('Chekni ulashish', onPressed: _share)
```

**`_FareBreakdownCard` qoidasi (eng muhim):**
```dart
// `fare` null bo'lsa (migratsiyadan oldingi safarlar) tarkib KO'RSATILMAYDI —
// order_detail_screen.dart dagi soxta "asos = summa * 0.85" bo'linishi aynan
// shu xatoning oldingi ko'rinishi edi. Server tarkib yubormasa, ekran faqat
// jamini ko'rsatadi va "Tarkib mavjud emas" deb ochiq aytadi.
if (receipt.fare == null) return _NoBreakdownNotice();
```
Qatorlar (nol bo'lmaganlari):
| Yorliq | Manba |
|---|---|
| Chaqiruv haqi | `fare.baseFare` |
| Masofa (`4.2 km × 1 500`) | `fare.distanceFare` |
| Vaqt (`14 daq × 300`) | `fare.timeFare` |
| Eng kam haqqa to'ldirish | `fare.minPriceAdjustment` (>0 bo'lsa) |
| Yuklama ×1.4 | `fare.surgeFare` (>0 bo'lsa) |
| Yuqori chegara | `fare.maxPriceCap` (<0 bo'lsa) |
| Chegirma (`PROMO25`) | `-discountAmount` — `kError`/mint rangda |
| **Jami** | `total` — `kFontH2`, `FontWeight.w800` |

Ajratuvchi `Divider(color: agDivider)`. Har bir bosiladigan element — `AppPressable`, minimal tegish maydoni `kMinTapTarget`.

### 3.7 Kirish nuqtalari (uchtasi)

1. **`/home/diyorbek/AngrenTaxi/mobile/lib/features/superapp/screens/order_detail_screen.dart`** — 211-215-qatordagi "Jami" qatoridan keyin, `order.status == OrderStatus.completed` bo'lsa: `AgButton('Chekni ko'rish')` → `TripReceiptScreen(orderId: order.id)`.
2. **`/home/diyorbek/AngrenTaxi/mobile/lib/features/passenger/screens/order_history_screen.dart`** — `_showOrderDetails` bottom-sheet ichida (276-286-qatorlar, "Safarni takrorlash" yonida) ikkinchi tugma "Chek". *Eslatma: bu ekran `/passenger/history` marshrutida, `app.dart:162`; superapp ichida esa `orders_screen.dart:158` `OrderDetailScreen` ga boradi — ikkita parallel tafsilot UI si bor, chek ikkalasidan ham ochilishi kerak.*
3. **`/home/diyorbek/AngrenTaxi/mobile/lib/features/passenger/screens/home_screen.dart:114-129`** — `RateDriverScreen` yopilgandan keyin ixtiyoriy "Chekni ko'rish" snackbar amali. *(Ixtiyoriy, 2-bosqich.)*

### 3.8 Marshrut

`app.dart` `routes` mapiga qo'shilmaydi — ekran `orderId` argumentini talab qiladi, shuning uchun faqat `MaterialPageRoute` orqali (mavjud `OrderDetailScreen` bilan bir xil uslub, `orders_screen.dart:156-160`).

### 3.9 Demo rejim

`/home/diyorbek/AngrenTaxi/mobile/lib/core/demo/demo_engine.dart` ga yangi tarmoq (`path.contains('/orders/') && path.endsWith('/receipt')`) → `demo_data.dart` dan tayyor chek JSON. Aks holda demo rejimda chek tugmasi xato beradi.

---

## 4. Testlar

### 4.1 `/home/diyorbek/AngrenTaxi/backend/src/modules/tariffs/tariffs.service.breakdown.spec.ts` (YANGI)
- `baseFare + distanceFare + timeFare + minPriceAdjustment + surgeFare + maxPriceCap === total` — **har bir holatda**: oddiy, `minPrice` ishlagan, `maxPrice` kesgan, surge>1, surge+maxPrice birga.
- `calculatePriceBreakdown(...).total === calculatePrice(...)` — ikki metod ajralib ketmasligi.

### 4.2 `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.service.receipt.spec.ts` (YANGI)
`ORDERS_PROVIDERS` + `fakeDataSourceProvider()` + `fakeTransactionRepository()` shabloni (`orders.service.settlement.spec.ts:1-80` ga qarang). Holatlar:
- tugagan safar → to'liq chek qaytadi;
- `status !== completed` → `BadRequestException`;
- begona foydalanuvchi → `ForbiddenException` (`findByIdForUser` orqali);
- `fareBreakdown === null` (eski safar) → chek qaytadi, `fare: null`, `total` bor — **500 emas**;
- hamyon yetmagan safar (`transactions` da PENDING DEBIT) → `unpaidAmount > 0`;
- javobda `driverEarning` va `commission` **yo'qligi** (regressiya qo'riqchisi).

### 4.3 `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.service.completion-distance.spec.ts` (YANGILANADI)
Yangi assert: `manager.update(Order, ...)` chaqiruvida `fareBreakdown` va `completedAt` bor va `fareBreakdown.total === finalPrice + discountAmount`.

### 4.4 `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.service.spec.ts` va boshqa 11 ta spec (YANGILANADI)
`OrdersQueryService` ga `Trip` repozitoriysi qo'shilgani uchun **har bir orders spec fayliga** `{ provide: getRepositoryToken(Trip), useValue: {...find: jest.fn().mockResolvedValue([])} }` provideri kerak. Ba'zilarida allaqachon bor (completion uchun) — tekshirib chiqish shart, aks holda `Nest can't resolve dependencies` bilan 12 ta spec qulaydi.

### 4.5 `/home/diyorbek/AngrenTaxi/mobile/test/widget/trip_receipt_test.dart` (YANGI)
`order_history_repeat_ride_test.dart:1-45` shabloni: `MockApiClient` (mocktail), `initializeDateFormatting('uz', null)` `setUpAll` da. Holatlar:
- to'liq tarkibli chek → barcha qatorlar chiziladi, jami to'g'ri formatlanadi;
- `fare: null` → tarkib bloki yo'q, "Tarkib mavjud emas" matni bor, **soxta bo'linish yo'q**;
- `unpaidAmount > 0` → ogohlantirish ko'rinadi;
- ulashish tugmasi bosilganda `toShareText()` da jami, sana va buyurtma raqami bor (`share_plus` platforma kanali fake qilinadi — `driver_navigation_test.dart` dagi `url_launcher_platform_interface` fake uslubi bilan bir xil).

### 4.6 `/home/diyorbek/AngrenTaxi/mobile/test/unit/order_receipt_model_test.dart` (YANGI)
`OrderReceipt.fromJson` — to'liq JSON, `fare: null`, `discountAmount: null`, `promoCode: null` holatlari.

---

## 5. TUZOQLAR (nima buziladi / nimaga e'tibor berish kerak)

1. **Eng katta tuzoq: `attachDisplayFields` da `Trip` repozitoriysi 12 ta spec ni sindiradi.** `orders.service.*.spec.ts` fayllari `ORDERS_PROVIDERS` ni to'g'ridan-to'g'ri ishlatadi — `OrdersQueryService` ga yangi bog'liqlik qo'shilishi hammasida `Nest can't resolve dependencies of OrdersQueryService` beradi. Rejaga ularni yangilash **kiritilgan** (4.4), lekin baholashda unutilmasin.

2. **Itemizatsiya jamiga qo'shilmasligi.** `tariffs.service.ts:100-102` — `Math.max(minPrice, baseTotal) * surge` va `Math.min(raw, maxPrice)`. Agar tarkib frontendda "base + km + min" deb yig'ilsa, minPrice yoki maxPrice ishlagan har bir safarda chek noto'g'ri bo'ladi. **Shuning uchun tarkib serverda hisoblanadi va `minPriceAdjustment` / `maxPriceCap` qatorlari majburiy.**

3. **`order_detail_screen.dart:207-210` dagi izoh ogohlantirish.** U yerda aynan soxta bo'linish (`amount * 0.85` + o'ylab topilgan xizmat haqi) olib tashlangani yozilgan. Yangi chek shu xatoni **qaytarmasligi** shart: server tarkib yubormasa, ekran hech narsa o'ylab topmaydi.

4. **Yakuniy narx va baholash turli surge da hisoblanadi.** `orders-completion.service.ts:161` `zoneSurge` siz chaqiriladi, `orders-creation.service.ts:137-146` esa u bilan. Ya'ni bugun yo'lovchiga ×1.4 baholansa ham, yakuniy hisob ×1.0 (yoki faqat tarif koeffitsienti) bo'ladi. Chek buni **ko'rinadigan** qiladi — shuning uchun 2.2(a) dagi qaror biznes bilan kelishilishi kerak, aks holda birinchi chek "nega baholash 28 000 edi-yu, hisob 20 000?" savolini keltirib chiqaradi.

5. **`updatedAt` chek sanasi emas.** `PaymentsService.settleOrderPayout` karta callback kelganda buyurtmaga qayta yozadi → `updated_at` suriladi. `completed_at` alohida ustun bo'lishi shart.

6. **Migratsiyadan oldingi tugagan safarlar.** `fare_breakdown` ular uchun `NULL`. Chek ekrani, DTO va spec buni **birinchi darajali holat** sifatida ko'rishi kerak, `!` bilan majburlash emas. `completed_at` esa `trips.end_time` dan tiklanadi (1.2).

7. **`promoCode` relation.** Hozir yuklanmaydi (`orders-query.service.ts:56,72,105,121`). `findByIdOrThrow` ga `'promoCode'` qo'shilsa, u **barcha** o'qish yo'llariga (dispatcher board, web-manager `/orders/active` polling) qo'shimcha JOIN keltiradi. Xavfsizroq: chek servisida alohida `findOne` qilish.

8. **Web-manager sinmaydi, lekin tekshirish kerak.** `web-manager/src/lib/api.ts:130` da `Order` tipi bor — yangi maydonlar qo'shimcha (additive), TS xato bermaydi. Lekin `getActiveOrders()` javob shakli `Order[]` bo'lib qolishi shart (`orders-query.service.ts:86-93` dagi izohga qarang).

9. **`GET /orders/:id/receipt` marshrut tartibi.** `orders.controller.ts` da `@Get(':id')` 190-qatorda va u `/orders/history`, `/orders/stats` kabi literal marshrutlardan **keyin** turadi. `:id/receipt` `:id` bilan to'qnashmaydi (segment soni farqli), lekin `:id` dan oldin qo'yilsa ham xavfsiz — asosiysi `@Get('history')` guruhidan keyin bo'lishi.

10. **`share_plus` va Flutter 3.32.2.** `share_plus: ^10.x` Dart 3.8 bilan mos, lekin `mobile/android/build.gradle` o'zgartirilganini (git status) hisobga olib, `flutter pub get` dan keyin **Android build ni albatta bir marta yig'ib ko'rish** kerak — plugin registrant (`GeneratedPluginRegistrant.m`) ham yangilanadi.

11. **PII va rol.** Chekda haydovchi ismi/mashinasi bor. `findByIdForUser` haydovchiga ham ruxsat beradi — bu holda haydovchi yo'lovchining chegirmasini ko'radi. Bu maqbul (u allaqachon `GET /orders/:id` orqali ko'radi), lekin **komissiya va `driverEarning` chek DTO siga hech qachon qo'shilmasligi** shart — aks holda yo'lovchi platforma marjasini ko'radi.

12. **`orders.controller.ts` da spec fayli yo'q.** Repo konvensiyasi "har yangi endpoint uchun spec" deydi; mavjud amaliyot — controller emas, **servis darajasida** spec (`orders.service.*.spec.ts`). Shu amaliyotga rioya qilinadi (4.2).

---

## 6. Baho (kun hisobida)

| Bosqich | Kun |
|---|---|
| 1. Entity + migratsiya + `calculatePriceBreakdown` | 0.5 |
| 2. `orders-completion.service.ts` saqlash + `attachDisplayFields` trip yuklamasi | 0.5 |
| 3. `OrdersReceiptService` + DTO + endpoint + fasad/provayderlar | 0.5 |
| 4. Backend spec lar (yangi 2 ta + 12 ta mavjudni tuzatish) | 1.0 |
| 5. Mobil: model + provider + endpoint + `share_plus` | 0.5 |
| 6. Mobil: `TripReceiptScreen` + 3 ta kirish nuqtasi + demo engine | 1.0 |
| 7. Mobil testlar (widget + unit) | 0.5 |
| 8. Qo'lda tekshirish (haqiqiy safar, hamyon qarzi, eski safar, ulashish) | 0.5 |
| **JAMI** | **5.0 kun** |

Ixtiyoriy 2-bosqich (rejaga kirmagan): chekni **PNG/PDF** qilib ulashish (`RepaintBoundary` → `toImage` → `XFile.fromData`) — **+1 kun**; email orqali yuborish — **+1 kun** (backendda `notifications` moduli hozir faqat FCM/push, SMTP yo'q).

---

## 7. Ochiq savollar (kod javob bermaydi)

1. **"chaqim" nimani anglatadi?** Vazifadagi ro'yxatda "chegirma, chaqim" ketma-ket kelgan. Ikki o'qish bor: (a) *chaqiruv haqi* = `tariff.basePrice`, (b) *yuklama/surge koeffitsienti*. Reja **ikkalasini ham** alohida qator qilib beradi (`baseFare` va `surgeFare`), lekin yorliq matnini tasdiqlash kerak.
2. **Yakuniy narxga hudud surge si qo'shilsinmi?** (5-tuzoq). Hozir qo'shilmaydi — chek buni fosh qiladi.
3. **Cargo safarlari uchun ham chek kerakmi?** `serviceType` `orders` da bor; chek servisi vertikalga bog'liq emas, lekin UI matnlari ("Safar cheki") taksi uchun yozilgan.
