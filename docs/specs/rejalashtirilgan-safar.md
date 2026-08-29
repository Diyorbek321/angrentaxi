# Rejalashtirilgan safar — bajarish spetsifikatsiyasi

> Tuzilgan: 2026-08-19 · mavjud kod o'qib chiqilgan holda
> Asos: [TASK-yandex-parity.md](../TASK-yandex-parity.md)

---

# Rejalashtirilgan safar — bajarish rejasi

O'qilgan fayllar: `order.entity.ts`, `matching.service.ts`, `orders-creation.service.ts`, `orders-completion.service.ts`, `orders-query.service.ts`, `orders-dispatch.service.ts`, `order-status-transition.service.ts`, `orders.controller.ts`, `orders.module.ts`, `orders.providers.ts`, `orders.testing.ts`, barcha `orders/dto/*.ts`, `tariffs.service.ts`, `surge.service.ts`, `notifications.service.ts`, `refresh-token-cleanup.service.ts`, `matching.module.ts`, `app.module.ts`, `main.ts`, `000_baseline.ts`, `_archive/010_order_waypoints.ts`, `tariff_select_screen.dart`, `order_provider.dart`, `order.dart`, `api_endpoints.dart`, `app.dart`, `home_screen.dart`.

---

## 0. ASOSIY QAROR — narx qachon hisoblanadi

**Javob: narx IKKI marta hisoblanadi, va buyurtmaga yoziladigan haqiqiy narx — dispatch paytidagisi.**

Sabab kodda ko'rinib turibdi: `OrdersCreationService.create()` (satr 137-147) `surgeService.snapshotFor(pickupLat, pickupLng)` ni **shu daqiqada** chaqiradi, `SurgeService.snapshotFor` esa oxirgi 10 daqiqadagi buyurtmalar / hozir onlayn haydovchilar nisbatini o'qiydi (`DEMAND_WINDOW_MINUTES = 10`). Ertaga 08:00 uchun bugun 21:00 da hisoblangan surge — ertangi 08:00 ga umuman aloqasi yo'q raqam.

Shuning uchun:

| Vaqt | Nima hisoblanadi | Qayerga yoziladi |
|---|---|---|
| Buyurtma berilganda (T-24h) | **Indikativ narx**, `zoneSurge = 1.0` bilan (surge ATAYLAB qo'llanmaydi) | `orders.quoted_price` (yangi ustun) + `orders.estimated_price` (NOT NULL bo'lgani uchun majburan to'ldiriladi) |
| Dispatch paytida (T-10min) | **Haqiqiy narx**: `surgeService.snapshotFor(...)` LIVE chaqiriladi, `tariffsService.calculatePrice(tariff, km, min, liveSurge)` | `orders.estimated_price` UPDATE qilinadi |
| Safar tugaganda | Mavjud `OrdersCompletionService.completeTrip` (o'zgarmaydi) | `orders.final_price` |

**Yo'lovchi himoyasi (MAJBURIY, aks holda bu funksiya ishonchni yo'qotadi):** dispatch paytidagi narx `quoted_price` dan `SCHEDULED_PRICE_CAP_RATIO` (tavsiya: `1.3`) barobardan ko'proq oshmasligi kerak. Ya'ni:

```
finalQuote = Math.min(livePrice - discount, quotedPrice * 1.3)
```

Farqni yo'lovchiga socket + push orqali aytish shart ("Narx 12 000 → 15 600 so'm, hozir talab yuqori"). Bu `tariff_select_screen.dart` dagi mavjud `_buildSurgeNotice` falsafasining davomi: "Tushuntirilmagan qimmatlashuv o'zboshimchalik bo'lib ko'rinadi".

---

## 1. Entity / migratsiya o'zgarishlari

### 1.1 `backend/src/database/entities/order.entity.ts`

**`OrderStatus` enum ga yangi qiymat:**
```ts
SCHEDULED = 'scheduled',   // CREATED dan oldin qo'shiladi
```

**Yangi ustunlar (`Order` klassi ichida, `note` dan keyin):**

| Maydon | TS tipi | Postgres tipi | Nullable | Default |
|---|---|---|---|---|
| `scheduledAt` | `Date \| null` | `timestamptz` | ha | `NULL` |
| `quotedPrice` | `number \| null` | `numeric(10,2)` | ha | `NULL` |
| `quotedSurgeMultiplier` | `number \| null` | `numeric(3,1)` | ha | `NULL` |
| `scheduledReminderSentAt` | `Date \| null` | `timestamptz` | ha | `NULL` |
| `scheduledReleasedAt` | `Date \| null` | `timestamptz` | ha | `NULL` |

- `scheduledAt = NULL` → hozirgi buyurtma, mavjud xatti-harakat 1:1 saqlanadi.
- `quotedPrice`/`quotedSurgeMultiplier` — dispatch paytida "narx qancha o'zgardi" ni ko'rsatish va cap hisoblash uchun.
- `scheduledReminderSentAt` — eslatma cron'i idempotent bo'lishi uchun (aks holda har 5 daqiqada push yuboradi).
- `scheduledReleasedAt` — audit; kechikish (SLA) o'lchash uchun.

**MUHIM:** `quotedPrice` uchun `estimatedPrice` dagi bilan bir xil `transformer: { to, from: parseFloat }` yozish shart — `numeric` TypeORM'da `string` bo'lib qaytadi.

**Yangi indeks (klass ustidagi `@Index` bloklariga qo'shiladi):**
```ts
@Index('idx_orders_status_scheduled_at', ['status', 'scheduledAt'])
```
Cron har daqiqada `WHERE status='scheduled' AND scheduled_at <= :cutoff` deb so'raydi — bu indekssiz to'liq jadval skani bo'ladi. Mavjud izoh blokiga (54-57 satr) shu indeks nima uchun kerakligi ham yoziladi.

### 1.2 Migratsiya — **IKKI ta alohida fayl**

`backend/src/database/migrations/` (glob `migrations/*{.ts,.js}` — `_archive/` ga kirmaydi, tekshirildi).

**`001_scheduled_order_status.ts`** — `ScheduledOrderStatus1760000000001`:
```sql
ALTER TYPE "public"."orders_status_enum" ADD VALUE IF NOT EXISTS 'scheduled' BEFORE 'created';
```
`down()` — bo'sh + izoh (Postgres enum qiymatini o'chira olmaydi; rollback uchun butun tipni qayta yaratish kerak, bu esa jadval ustunini qayta yozishni talab qiladi).

**`002_scheduled_orders.ts`** — `ScheduledOrders1760000000002`:
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quoted_price NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quoted_surge_multiplier NUMERIC(3,1);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_released_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_status_scheduled_at ON orders (status, scheduled_at);
```

**NEGA ikkita fayl va nega shu tartibda — bu TUZOQ:** `app.module.ts` da `migrationsRun: true`, `migrationsTransactionMode` berilmagan → TypeORM default `'all'`, ya'ni **barcha kutayotgan migratsiyalar BITTA tranzaksiyada** bajariladi. Postgres 12+ da `ALTER TYPE ... ADD VALUE` tranzaksiya ichida ishlaydi, **lekin yangi qiymatni o'sha tranzaksiya ichida ISHLATIB bo'lmaydi**. Shuning uchun: hech bir migratsiya `'scheduled'` qiymatini `DEFAULT`, `UPDATE`, yoki `CHECK` ichida ishlatmasligi kerak. Yuqoridagi ikkala migratsiya ham ishlatmaydi — xavfsiz. Agar keyinchalik ma'lumot ko'chirish kerak bo'lsa, u **uchinchi deploy'da** alohida migratsiya bo'lishi shart.

Postgres versiyasi: `docker-compose.yml` → `postgis/postgis:16-3.4-alpine`. PG16 — mos.

---

## 2. Backend

### 2.1 `backend/src/modules/orders/dto/create-order.dto.ts` — o'zgartiriladi

`CreateOrderDto` ga qo'shiladi:
```ts
@ApiPropertyOptional({
  example: '2026-08-20T03:00:00.000Z',
  description: "Rejalashtirilgan olib ketish vaqti (ISO-8601, UTC). Berilmasa — darhol qidiruv.",
})
@IsOptional()
@IsISO8601({ strict: true })
scheduledAt?: string;
```

**TUZOQ:** `main.ts` (52-59 satr) `ValidationPipe` ni `enableImplicitConversion: true` bilan ishga tushiradi. `@IsDate() + @Type(() => Date)` bu yerda ishonchsiz — implicit conversion sanani kutilmaganda mangle qiladi. **String sifatida qabul qilib, servisda `new Date(...)` qilish** — yagona xavfsiz yo'l. Shuningdek `forbidNonWhitelisted: true` bo'lgani uchun DTO ga qo'shmasdan mobil `scheduledAt` yuborsa — `400 property scheduledAt should not exist`.

`create-dispatch-order.dto.ts` ga ham xuddi shu maydon qo'shiladi (call-centre operatori ham rejalashtirilgan safarni qabul qila olishi kerak; `createForDispatch` allaqachon `create()` ga delegate qiladi, 217-238 satr).

### 2.2 `backend/src/modules/orders/scheduled-orders.constants.ts` — YANGI fayl

```ts
export const SCHEDULED_MIN_LEAD_MINUTES = 30;      // hozirdan kamida 30 daqiqa keyin
export const SCHEDULED_MAX_AHEAD_DAYS = 14;        // 14 kundan uzoqqa emas
export const SCHEDULED_DISPATCH_LEAD_MINUTES = 10; // qidiruv olib ketishdan 10 daq oldin boshlanadi
export const SCHEDULED_PRICE_CAP_RATIO = 1.3;      // dispatch narxi kotirovkadan 30% dan ko'p oshmaydi
export const SCHEDULED_REMINDER_MINUTES = 30;      // T-30 daq da eslatma
export const SCHEDULED_STALE_AFTER_MINUTES = 30;   // scheduled_at dan 30 daq o'tsa — bekor
export const SCHEDULED_DISPATCH_BATCH = 50;        // bir tick'da nechta buyurtma
```

### 2.3 `backend/src/modules/orders/orders-creation.service.ts` — o'zgartiriladi

**(a) Yangi private metod — `estimateRouteMetrics`** (117-135 satrdagi mavjud mantiq shu yerga ko'chiriladi, `create()` uni chaqiradi):
```ts
private estimateRouteMetrics(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  waypoints?: { lat: number; lng: number }[],
): { distanceKm: number; durationMin: number }
```
NEGA: `ScheduledOrdersService` dispatch paytida masofa/vaqtni **ayni shu formula bilan** qayta hisoblashi kerak, aks holda kotirovka va dispatch narxi bir xil kirish ma'lumotidan chiqmaydi va cap noto'g'ri ishlaydi.

**(b) Yangi public metod — `quoteForOrder`:**
```ts
async quoteForOrder(orderId: string): Promise<{
  distanceKm: number;
  durationMin: number;
  surgeMultiplier: number;
  price: number;
}>
```
Buyurtma ID si bo'yicha PostGIS dan koordinatalarni o'qiydi (`SELECT ST_Y(pickup_location::geometry) ...` — `matching.service.ts` 317-330 satrdagi so'rovning aynan nusxasi), `estimateRouteMetrics` + `surgeService.snapshotFor` + `tariffsService.calculatePrice` ni chaqiradi. `ScheduledOrdersService` shuni ishlatadi.

**(c) `create()` metodi o'zgaradi:**

1. `dto.scheduledAt` bo'lsa — validatsiya (**shu servisda, controller'da emas** — `createForDispatch` ham shu yo'ldan o'tadi):
   - `scheduledAt <= now + SCHEDULED_MIN_LEAD_MINUTES` → `BadRequestException("Rejalashtirilgan safar hozirdan kamida 30 daqiqa keyin bo'lishi kerak")`
   - `scheduledAt > now + SCHEDULED_MAX_AHEAD_DAYS` → `BadRequestException(...)`
2. Surge: `const zoneSurge = dto.scheduledAt ? 1.0 : (await this.surgeService.snapshotFor(...)).multiplier;`
   Izoh (o'zbekcha): *"Rejalashtirilgan buyurtmada surge hozir olinmaydi — u dispatch paytidagi bozor holatini aks ettirmaydi. Kotirovka surge'siz, haqiqiy narx ScheduledOrdersService.releaseDueOrder da hisoblanadi."*
3. `INSERT` SQL (166-194 satr) o'zgaradi:
   - `status` = `dto.scheduledAt ? OrderStatus.SCHEDULED : OrderStatus.CREATED`
   - yangi ustunlar: `scheduled_at`, `quoted_price`, `quoted_surge_multiplier` (`$18, $19, $20`)
   - `quoted_price` = `finalEstimatedPrice`, `estimated_price` = `finalEstimatedPrice` (NOT NULL, keyin UPDATE bo'ladi)
4. Emit: rejalashtirilganda `'order:created'` o'rniga `'order:scheduled'` yuboriladi (mobil `_listenToOrderEvents` ni ishga tushirmasligi uchun).

**(d) `getOutstandingWalletDebt` tekshiruvi (87-115 satr) rejalashtirilgan buyurtmada ham ishlaydi** — ATAYLAB o'zgarmaydi, lekin **dispatch paytida QAYTA tekshiriladi** (pastga qarang). Yo'lovchi kecha qarzsiz edi, ertaga qarzdor bo'lishi mumkin.

### 2.4 `backend/src/modules/orders/scheduled-orders.service.ts` — YANGI fayl (asosiy ish)

```ts
@Injectable()
export class ScheduledOrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    private readonly creationService: OrdersCreationService,
    private readonly queryService: OrdersQueryService,
    private readonly statusTransition: OrderStatusTransitionService,
    private readonly tariffsService: TariffsService,
    private readonly promoCodesService: PromoCodesService,
    private readonly matchingService: MatchingService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}
```

**Metodlar:**

**1) `@Cron(CronExpression.EVERY_MINUTE, { name: 'scheduled-orders-dispatch' }) async handleDispatchTick(): Promise<void>`**
`refresh-token-cleanup.service.ts` (50-59 satr) namunasi bo'yicha: butun tanani `try/catch` ga o'rab, xatoni `logger.error` qiladi — cron hech qachon yiqilmasligi kerak.

**2) `async dispatchDueOrders(now = new Date()): Promise<number>`** (test uchun to'g'ridan-to'g'ri chaqiriladigan, `now` inject qilinadigan)
```ts
const cutoff = new Date(now.getTime() + SCHEDULED_DISPATCH_LEAD_MINUTES * 60_000);
const due = await this.orderRepository.find({
  where: { status: OrderStatus.SCHEDULED, scheduledAt: LessThanOrEqual(cutoff) },
  order: { scheduledAt: 'ASC' },
  take: SCHEDULED_DISPATCH_BATCH,
  select: ['id'],
});
for (const { id } of due) { try { await this.releaseDueOrder(id); } catch (e) { log } }
```
Har bir buyurtma alohida `try/catch` — bitta buzuq buyurtma butun batch'ni to'xtatmasligi kerak.

**3) `async releaseDueOrder(orderId: string): Promise<void>`** — YURAK METODI:
```
 1. order = await this.queryService.findByIdOrThrow(orderId)
 2. if (order.status !== OrderStatus.SCHEDULED) return;            // idempotentlik
 3. tariff = await this.tariffsService.findById(order.tariffId)
    if (!tariff.isActive) → cancelScheduled(order, 'Tarif mavjud emas') ; return
 4. debt = await this.creationService.getOutstandingWalletDebt(order.passengerId)   // private → public qilinadi
    if (debt > 0) → cancelScheduled(order, "To'lanmagan qarz") + push ; return
 5. quote = await this.creationService.quoteForOrder(orderId)   // LIVE surge shu yerda olinadi
 6. discount = 0
    if (order.promoCodeId) {
      try { promo = await this.promoCodesService.findById(order.promoCodeId);
            r = await this.promoCodesService.validate(promo.code, order.passengerId, quote.price);
            discount = r.discountAmount; }
      catch { discount = 0; logger.warn(...) }   // completeTrip dagi degradatsiya namunasi (176-206 satr)
    }
 7. capped = Math.min(quote.price - discount, (order.quotedPrice ?? quote.price) * SCHEDULED_PRICE_CAP_RATIO)
    finalQuote = Math.max(0, capped)
 8. await this.statusTransition.updateOrderStatusAtomic(
      orderId,
      [OrderStatus.SCHEDULED],                                   // shartli UPDATE = exactly-once
      { status: OrderStatus.CREATED,
        estimatedPrice: finalQuote,
        discountAmount: discount > 0 ? discount : null,
        scheduledReleasedAt: new Date() },
    )
 9. this.realtimeGateway.emitToUser(order.passengerId, 'order:scheduled_released', {
      orderId, price: finalQuote, quotedPrice: order.quotedPrice,
      surgeMultiplier: quote.surgeMultiplier,
    })
10. if (finalQuote > (order.quotedPrice ?? 0)) →
      await this.notificationsService.notifyScheduledRidePriceChanged(passenger, order, finalQuote)
11. await this.matchingService.startSearch(orderId)               // qidiruvni boshlaydi
```
8-qadamdagi shartli UPDATE — **exactly-once kafolati**. Ikki instans bir vaqtda bir buyurtmani ko'rsa ham, `WHERE status IN ('scheduled')` faqat bittasida 1 qatorga tegadi; ikkinchisi `ConflictException` oladi, u `catch` da yutiladi va `startSearch` ikkinchi marta chaqirilmaydi.

**4) `@Cron(CronExpression.EVERY_5_MINUTES, { name: 'scheduled-orders-reminder' }) handleReminderTick()` → `async sendReminders(now = new Date())`**
`WHERE status='scheduled' AND scheduled_reminder_sent_at IS NULL AND scheduled_at <= now + 30min` → push + `UPDATE ... SET scheduled_reminder_sent_at = NOW()`.

**5) `@Cron(CronExpression.EVERY_10_MINUTES, { name: 'scheduled-orders-stale' })` → `async cancelStaleScheduled(now = new Date())`**
`WHERE status='scheduled' AND scheduled_at < now - 30min` → `updateOrderStatusAtomic(..., { status: CANCELLED, cancelReason: 'Rejalashtirilgan vaqt o'tib ketdi' })`. Backend bir necha soat o'chib turgan holat uchun himoya — aks holda o'tgan haftadagi buyurtma bugun to'satdan haydovchi qidira boshlaydi.

**6) `private async cancelScheduled(order: Order, reason: string): Promise<void>`** — `updateOrderStatusAtomic` + socket `'order:cancelled'` + push.

### 2.5 `backend/src/modules/orders/orders-query.service.ts` — o'zgartiriladi

Yangi metod:
```ts
async getScheduledOrders(passengerId: string): Promise<Order[]>
// where: { passengerId, status: OrderStatus.SCHEDULED }
// order: { scheduledAt: 'ASC' }
// relations: ['passenger', 'driver', 'tariff']
// return this.attachDisplayFields(orders)
```
`attachDisplayFields` MAJBURIY — mobil `Order.fromJson` `json['pickup']`/`json['dropoff']` ni kutadi, xom `pickupLocation` esa PostGIS geometry (izoh 235-238 satrda).

**`getActiveOrders()` (94-115 satr) — QARO'R: o'zgarmaydi.** Rejalashtirilgan buyurtma dispatcher board'da ko'rinmaydi. Sabab: board 200 qator bilan cheklangan va faqat jonli safarlar uchun. Rejalashtirilganlar uchun alohida endpoint (2.6) beriladi.

### 2.6 `backend/src/modules/orders/orders.controller.ts` — o'zgartiriladi

**Yangi endpoint'lar (`@Get(':id')` DAN OLDIN joylashtirilishi SHART):**

```ts
@Get('scheduled')
@Roles(UserRole.PASSENGER)
@ApiOperation({ summary: "Yo'lovchining kelgusi rejalashtirilgan safarlari" })
async getScheduled(@CurrentUser() user: User): Promise<Order[]>
  → this.ordersService.getScheduledOrders(user.id)
```

```ts
@Patch(':id/reschedule')
@Roles(UserRole.PASSENGER)
@ApiOperation({ summary: 'Rejalashtirilgan safar vaqtini o\'zgartirish' })
async reschedule(@CurrentUser() user, @Param('id', ParseUUIDPipe) id, @Body() dto: RescheduleOrderDto): Promise<Order>
```

**TUZOQ:** `orders.controller.ts` da `@Get(':id')` 194-satrda turibdi. Nest marshrutlarni **e'lon tartibida** ro'yxatdan o'tkazadi — `@Get('scheduled')` undan keyin qo'yilsa, `GET /orders/scheduled` `findOne('scheduled')` ga tushadi va `ParseUUIDPipe` 400 qaytaradi. `app.module.ts` dagi `FavoritesModule` izohi (168-175 satr) aynan shu muammoni tasvirlaydi.

`createOrder` (60-73 satr) o'zgaradi:
```ts
const order = await this.ordersService.create(user.id, dto);
// Rejalashtirilgan buyurtmada qidiruv HOZIR boshlanmaydi — uni
// ScheduledOrdersService cron'i vaqti kelganda ishga tushiradi.
if (order.status !== OrderStatus.SCHEDULED) {
  this.matchingService.startSearch(order.id).catch(...);
}
return order;
```
`createDispatchOrder` (76-88 satr) ham xuddi shunday.

**Yangi DTO:** `backend/src/modules/orders/dto/reschedule-order.dto.ts`
```ts
export class RescheduleOrderDto {
  @IsISO8601({ strict: true })
  scheduledAt: string;
}
```

### 2.7 `backend/src/modules/orders/orders.service.ts` (fasad) — o'zgartiriladi

Konstruktorga `private readonly scheduledService: ScheduledOrdersService` qo'shiladi va uchta delegat metod:
```ts
getScheduledOrders(passengerId: string): Promise<Order[]>
reschedule(orderId: string, passengerId: string, scheduledAt: string): Promise<Order>
releaseDueOrder(orderId: string): Promise<void>   // faqat testlar/admin uchun
```
Fasad izohi (1-8 satr) "yagona injectable yuza" deydi — buni buzmaslik uchun boshqa modullar `ScheduledOrdersService` ga to'g'ridan-to'g'ri tegmaydi.

### 2.8 `backend/src/modules/orders/orders.providers.ts` — o'zgartiriladi
`ORDERS_PROVIDERS` massiviga `ScheduledOrdersService` qo'shiladi. **Bu bitta qator o'zgarish barcha 12 ta spec faylida avtomatik ishlaydi** — providers.ts izohi aynan shu uchun yozilgan.

### 2.9 `backend/src/modules/orders/orders.module.ts` — o'zgarmaydi
`MatchingModule`, `TariffsModule`, `PromoCodesModule`, `RealtimeModule`, `NotificationsModule`, `UsersModule` allaqachon import qilingan. `ScheduleModule.forRoot()` `app.module.ts` da global (159-166 satr izohi) — `@Cron` avtomatik topiladi. **Aylanma bog'liqlik yo'q:** `MatchingModule` `OrdersModule` ni import qilmaydi (tekshirildi, `matching.module.ts`).

### 2.10 `backend/src/modules/matching/matching.service.ts` — kichik o'zgarish

`handleNoDriversFound` (satr ~395-420) ga qo'shiladi:
```ts
// Rejalashtirilgan safarda yo'lovchi ilovaga qaramaydi — soket eventi
// unga yetib bormaydi. Push yagona kanal.
if (order.scheduledAt) {
  const passenger = await this.usersService.findById(passengerId);
  if (passenger) await this.notificationsService.notifyScheduledRideNoDriver(passenger, order);
}
```

### 2.11 `backend/src/modules/notifications/notifications.service.ts` — o'zgartiriladi

Uchta yangi metod, mavjud `notifyOrderAccepted`/`notifyOrderCancelled` shabloni bo'yicha (`firebaseService.sendPush` + `logNotification`):
```ts
async notifyScheduledRideReminder(passenger: User, order: Order): Promise<void>
async notifyScheduledRidePriceChanged(passenger: User, order: Order, newPrice: number): Promise<void>
async notifyScheduledRideNoDriver(passenger: User, order: Order): Promise<void>
```

---

## 3. Mobil

### 3.1 `mobile/lib/shared/models/order.dart` — o'zgartiriladi

- `enum OrderStatus` ga `scheduled` qo'shiladi.
- `OrderStatusExtension.label` ga: `case OrderStatus.scheduled: return 'Rejalashtirilgan';`
- `orderStatusFromString` ga: `case 'scheduled': return OrderStatus.scheduled;`
- `Order` klassiga `final DateTime? scheduledAt;` — konstruktor, `fromJson` (`json['scheduledAt'] != null ? DateTime.parse(...).toLocal() : null`), `copyWith`, **va `props`**.
- **`isActive` (186-190 satr) O'ZGARMAYDI** — `scheduled` unga KIRMAYDI. Aks holda `checkActiveOrder()` rejalashtirilgan safarni topib, bosh ekran "haydovchi izlanmoqda" holatiga qulflanadi.

**TUZOQ:** `Order extends Equatable`. `scheduledAt` ni `props` ga qo'shmasa, `copyWith(scheduledAt: ...)` natijasi eski obyektga teng deb hisoblanadi va `notifyListeners()` UI'ni yangilamaydi.

### 3.2 `mobile/lib/core/network/api_endpoints.dart` — o'zgartiriladi
```dart
static const String scheduledOrders = '/orders/scheduled';
static String rescheduleOrder(String id) => '/orders/$id/reschedule';
```

### 3.3 `mobile/lib/features/passenger/widgets/schedule_ride_sheet.dart` — YANGI fayl

`showModalBottomSheet` ichida ochiladigan, `Future<DateTime?>` qaytaradigan widget: `ScheduleRideSheet`.

- Yuqorida: kun chiplari — "Bugun", "Ertaga", so'ng 5 kun (`ListView` gorizontal). Har biri `AppPressable(pressedScale: 0.95, haptic: AppHapticLevel.select)`.
- Pastda: 15 daqiqalik qadamli vaqt ro'yxati (`ListWheelScrollView` yoki `GridView`), hozirgi vaqt + `SCHEDULED_MIN_LEAD_MINUTES` (30) dan oldingi slotlar `kInkSubtle` bilan o'chirilgan.
- Pastki CTA: `kGradientCta` + `kOnPrimary` matn, `kControlHeight`, `kRadiusMd` — `tariff_select_screen.dart` dagi "Buyurtma" tugmasi bilan bir xil.
- Fon `kSurface`, radius `kRadiusXl` (sheet uchun), padding `kSpace4/kSpace5`.
- Har bir tegish maydoni `kMinTapTarget` (48dp).
- Barcha ranglar `app_theme.dart` tokenlaridan; hech qanday `Color(0x...)` yozilmaydi.

**NEGA maxsus sheet, `showTimePicker` emas:** `showTimePicker`/`showDatePicker` Material dialog temasini olib keladi va u loyihaning mint dizayn tizimiga qarshi turadi — `app_theme.dart` da `TimePickerThemeData` sozlanmagan. Arzon variant sifatida ular ham mumkin, lekin unda `app_theme.dart` ga `timePickerTheme`/`datePickerTheme` qo'shish shart bo'ladi (qo'shimcha ~0.5 kun).

### 3.4 `mobile/lib/features/passenger/order_provider.dart` — o'zgartiriladi

Yangi holat va metodlar:
```dart
DateTime? _scheduledAt;
List<Order> _scheduledOrders = [];

DateTime? get scheduledAt => _scheduledAt;
bool get isScheduledBooking => _scheduledAt != null;
List<Order> get scheduledOrders => List.unmodifiable(_scheduledOrders);

void setScheduledAt(DateTime? when) { _scheduledAt = when; notifyListeners(); }

Future<void> loadScheduledOrders() async { ... GET ApiEndpoints.scheduledOrders ... }
Future<bool> cancelScheduledOrder(String id) async { ... PATCH ApiEndpoints.cancelOrder(id) ... }
Future<bool> rescheduleOrder(String id, DateTime when) async { ... }
```

`createOrder()` (satr ~228-290) o'zgarishlari:
1. `data` map'ga:
   ```dart
   if (_scheduledAt != null) 'scheduledAt': _scheduledAt!.toUtc().toIso8601String(),
   ```
2. Javobdan keyin **shoxlanadi**:
   ```dart
   if (_scheduledAt != null) {
     _scheduledOrders = [..._scheduledOrders, Order.fromJson(...)];
     // _activeOrder o'rnatilmaydi, _listenToOrderEvents() chaqirilmaydi —
     // rejalashtirilgan buyurtmada kuzatiladigan hech narsa yo'q.
   } else {
     _activeOrder = Order.fromJson(...);
     _listenToOrderEvents();
   }
   ```

`clearPendingOrder()` (satr ~430) ga `_scheduledAt = null;` qo'shiladi.
**TUZOQ:** buni unutsa, keyingi oddiy safar jimgina o'tgan vaqtga rejalashtiriladi va backend 400 qaytaradi.

`_listenToOrderEvents()` ga yangi listener:
```dart
_socketService.on(SocketEvents.scheduledReleased, (data) { ... narx yangilanadi ... });
```
va `mobile/lib/core/socket/socket_service.dart` dagi `SocketEvents` ga `scheduledReleased = 'order:scheduled_released'`, `orderScheduled = 'order:scheduled'` qo'shiladi.

### 3.5 `mobile/lib/features/passenger/screens/tariff_select_screen.dart` — o'zgartiriladi

**(a) `_buildPaymentRow()` (satr ~478-497) yoniga uchinchi chip:**
```dart
_ScheduleChip(
  scheduledAt: provider.scheduledAt,
  onTap: () async {
    final picked = await showModalBottomSheet<DateTime>(... ScheduleRideSheet ...);
    if (picked != null) provider.setScheduledAt(picked);
  },
)
```
Yorliq: `scheduledAt == null ? 'Hozir' : Formatters.formatScheduleLabel(scheduledAt)` (masalan "Ertaga, 08:30"). `_PaymentChip` bilan bir xil vizual til.

**(b) CTA matni** (satr ~366): `'Buyurtma'` → `provider.isScheduledBooking ? 'Rejalashtirish' : 'Buyurtma'`.

**(c) Narx bloki:** rejalashtirilganda tugmadagi narx yoniga `~` prefiksi va CTA ostida izoh:
> "Taxminiy narx. Aniq narx safardan 10 daqiqa oldin, o'sha paytdagi talabga qarab hisoblanadi."

Bu `_buildSurgeNotice` bilan bir xil konteynerda (`kInfoLight` fon + `kInfoDeep` matn), `kRadiusMd`.

**(d) `_onConfirmOrder()` (satr ~130-190):** rejalashtirilgan buyurtmada karta to'lovi bloki **o'tkazib yuboriladi** — u allaqachon `COMPLETED` buyurtmani talab qiladi (izoh 145-160 satrda). Navigatsiya `/passenger/home` o'rniga `/passenger/scheduled` ga o'tadi + snackbar.

### 3.6 `mobile/lib/features/passenger/screens/scheduled_orders_screen.dart` — YANGI fayl

- `Consumer<OrderProvider>`, `initState` da `loadScheduledOrders()`.
- Har bir safar uchun karta: sana/vaqt (yirik, `kFontH3`), manzillar (`_buildRouteRow` bilan bir xil ustunli marker), taxminiy narx, "Bekor qilish" / "Vaqtni o'zgartirish" tugmalari (`AppPressable`).
- Bo'sh holat: `AppEmptyState(icon: Icons.schedule_rounded, title: 'Rejalashtirilgan safarlar yo\'q')`.
- Yuklanishda `AppSkeletonList`.

### 3.7 `mobile/lib/app.dart` — o'zgartiriladi
`_buildRoutes` ga (161-satr atrofi):
```dart
'/passenger/scheduled': (_) => const ScheduledOrdersScreen(),
```

### 3.8 `mobile/lib/features/passenger/screens/home_screen.dart` — o'zgartiriladi
`_buildBottomSheet()` (262-satr) ichidagi `_buildSavedPlaces()` ostiga: agar `provider.scheduledOrders.isNotEmpty` bo'lsa, "Kelgusi safar: Ertaga 08:30" banneri (`AppPressable` → `/passenger/scheduled`).

### 3.9 `mobile/lib/shared/utils/formatters.dart` — o'zgartiriladi
```dart
static String formatScheduleLabel(DateTime when)   // "Bugun, 18:30" / "Ertaga, 08:00" / "22-avg, 08:00"
```
O'zbekcha oy nomlari bilan.

---

## 4. Testlar

### Backend (yangi)
| Fayl | Qamrov |
|---|---|
| `backend/src/modules/orders/scheduled-orders.service.spec.ts` | **Eng muhimi.** `dispatchDueOrders` faqat `scheduled_at <= now+10min` ni tanlashi; `releaseDueOrder` LIVE surge bilan narxni qayta hisoblashi (surge 1.0→1.8 bo'lganda `estimatedPrice` o'zgarishi); **cap** (surge 3.0 bo'lsa ham `quotedPrice * 1.3` dan oshmasligi); tarif nofaol → bekor; qarz bor → bekor; `status !== SCHEDULED` → hech narsa qilmaslik (idempotentlik); `updateOrderStatusAtomic` `ConflictException` tashlaganda `startSearch` CHAQIRILMASLIGI; promo bekor bo'lganda to'liq narx bilan davom etish; `startSearch` ayni bir marta chaqirilishi |
| `backend/src/modules/orders/orders.service.scheduled-creation.spec.ts` | `create()` `scheduledAt` bilan → `status: SCHEDULED`, `quoted_price` to'ldirilgan, `surgeService.snapshotFor` **CHAQIRILMAGAN**; o'tgan vaqt → 400; `now+10min` → 400 (min lead); `now+20 kun` → 400; `scheduledAt` bo'lmasa — mavjud xatti-harakat 1:1 |
| `backend/src/modules/orders/scheduled-orders.reminder.spec.ts` | `sendReminders` faqat `reminder_sent_at IS NULL` bo'lganlarga yuborishi; ikkinchi chaqiruvda takror yubormasligi; `cancelStaleScheduled` 30 daq o'tganlarni bekor qilishi |

Barchasi `ORDERS_PROVIDERS` + `fakeDataSourceProvider()` + `fakeTransactionRepository()` (`orders.testing.ts`) namunasidan foydalanadi — `orders.service.spec.ts` (43-90 satr) wiring shabloni.

### Backend (yangilanadi)
| Fayl | Nima qo'shiladi |
|---|---|
| `backend/src/modules/matching/matching.service.spec.ts` | `handleNoDriversFound` `order.scheduledAt` bo'lganda `notifyScheduledRideNoDriver` chaqirishi. `makeOrder()` helper'iga `scheduledAt: null` default qo'shiladi |
| `backend/src/modules/orders/orders.service.spec.ts` | Yangi provider qo'shilgach ham buzilmasligini tekshirish (regressiya) |
| `backend/src/modules/orders/orders.service.active-orders.spec.ts` | `getActiveOrders` SCHEDULED buyurtmani QAYTARMASLIGI |
| `backend/src/modules/orders/orders.service.access-control.spec.ts` | `getScheduledOrders` faqat o'z buyurtmalarini qaytarishi |

### Mobil (yangi)
| Fayl | Qamrov |
|---|---|
| `mobile/test/unit/order_provider_scheduled_test.dart` | `setScheduledAt` → `createOrder` `scheduledAt` ni UTC ISO da yuborishi; rejalashtirilganda `_activeOrder` o'rnatilmasligi va soket listener'lari qo'shilmasligi; `clearPendingOrder()` `_scheduledAt` ni tozalashi |
| `mobile/test/unit/order_model_scheduled_test.dart` | `orderStatusFromString('scheduled')`; `scheduledAt` parse; `copyWith` + `props` tengligi |
| `mobile/test/widget/schedule_ride_sheet_test.dart` | 30 daqiqadan yaqin slotlar o'chirilganligi; tanlov `DateTime` qaytarishi; barcha tegish maydonlari ≥48dp |
| `mobile/test/widget/tariff_schedule_chip_test.dart` | Chip "Hozir" dan tanlangan vaqtga o'zgarishi; CTA matni "Rejalashtirish" ga aylanishi |

---

## 5. TUZOQLAR — nimaga e'tibor berish kerak

1. **Marshrut tartibi (Nest).** `@Get('scheduled')` `@Get(':id')` DAN OLDIN turishi shart, aks holda `ParseUUIDPipe` 400 qaytaradi. `app.module.ts` 168-175 satrdagi `FavoritesModule` izohi bu tuzoqning oldingi qurboni haqida.

2. **Enum migratsiyasi va tranzaksiya.** `migrationsRun: true` + default `migrationsTransactionMode: 'all'` → barcha migratsiyalar bitta tranzaksiyada. `ALTER TYPE ... ADD VALUE` PG16 da tranzaksiya ichida ishlaydi, **lekin yangi qiymatni o'sha tranzaksiyada ISHLATIB bo'lmaydi**. Hech bir migratsiya `'scheduled'` ni `DEFAULT`/`UPDATE`/`CHECK` ichida ishlatmasligi kerak.

3. **`enableImplicitConversion: true` va sana.** `main.ts` 52-59. `@IsDate() + @Type(() => Date)` bu rejimda ishonchsiz. `@IsISO8601({ strict: true })` bilan `string` qabul qilib, servisda `new Date()` qilinadi.

4. **`forbidNonWhitelisted: true`.** DTO ga `scheduledAt` qo'shilmasa, mobil ilova `400 property scheduledAt should not exist` oladi. Ikkala DTO (`CreateOrderDto` VA `CreateDispatchOrderDto`) yangilanishi shart.

5. **`estimated_price` NOT NULL.** `orders.estimated_price` — `numeric(10,2) NOT NULL` (baseline 108-satr). Rejalashtirilgan buyurtma yaratishda uni `NULL` qoldirib bo'lmaydi; kotirovka narxi bilan to'ldiriladi va dispatch paytida UPDATE qilinadi.

6. **`numeric` → `string`.** TypeORM `numeric` ni string qaytaradi. `quotedPrice` uchun `estimatedPrice` dagi `transformer` (110-116 satr) nusxalanmasa, `quotedPrice * 1.3` string konkatenatsiyasiga aylanadi va cap butunlay buziladi.

7. **`SurgeService.countRecentRequests` rejalashtirilgan buyurtmalarni ham sanaydi.** `surge.service.ts` 155-166 satr: `WHERE created_at > NOW() - INTERVAL '10 minutes'` — status filtri YO'Q. Ya'ni bugun 21:00 da 5 ta odam ertangi safarni rejalashtirsa, hozirgi surge sun'iy ravishda ko'tariladi. **Tuzatish shart:** so'rovga `AND status <> 'scheduled'` qo'shiladi va `surge.service.spec.ts` ga regressiya testi yoziladi. Bu reja doirasidagi majburiy ish.

8. **`completeTrip` da zone surge YO'Q.** `orders-completion.service.ts` 161-165: `calculatePrice(tariff, km, min)` — `zoneSurge` argumenti berilmaydi. Ya'ni **hozir ham** `estimatedPrice` surge bilan, `finalPrice` surgesiz hisoblanadi. Rejalashtirilgan safarda bu farq sezilarli bo'ladi (yo'lovchi 15 600 ko'radi, 12 000 to'laydi). **Qaror kerak:** yo `releaseDueOrder` hisoblagan `surgeMultiplier` ni buyurtmaga saqlab, `completeTrip` da qayta qo'llash, yo mavjud xatti-harakatni ataylab saqlash. Tavsiya: `orders.applied_surge_multiplier` ustunini qo'shib, `completeTrip` da ishlatish — lekin bu **butun mahsulotni repricing qiladi**, `RoutedDistancePricing` kabi alohida bayroq ostida bo'lishi kerak. **v1 doirasidan tashqariga chiqariladi, lekin hujjatlashtiriladi.**

9. **60 soniyalik qidiruv oynasi rejalashtirilgan safar uchun qisqa.** `MatchingService.NO_DRIVER_TIMEOUT_MS = 60000`. T-10min da qidiruv boshlanib, 60 soniyada haydovchi topilmasa buyurtma bekor bo'ladi — hali 9 daqiqa vaqt bor edi. **v1 da:** `releaseDueOrder` ni `SCHEDULED_DISPATCH_LEAD_MINUTES = 10` bilan qoldirib, no-driver bo'lganda push yuborish (2.10). **v2 da:** `MatchingService.startSearch(orderId, { deadlineMs })` parametrini qo'shib, rejalashtirilgan safar uchun 8 daqiqalik oyna berish + `scheduled_retry_count` ustuni.

10. **Vaqt mintaqasi.** Loyihada `TZ` sozlanmagan (`.env.example`, `docker-compose.yml` da yo'q). `@CreateDateColumn` `TIMESTAMP` (tz'siz) hosil qiladi. `scheduled_at` **`timestamptz` bo'lishi SHART** (precedent: `promo_code.entity.ts:59`, `support-thread.entity.ts:56`). Mobil `toUtc().toIso8601String()` yuboradi, ko'rsatishda `.toLocal()`. Aks holda O'zbekiston UTC+5 da 5 soatlik xato chiqadi.

11. **Yo'lovchining qarzi (`getOutstandingWalletDebt`).** Buyurtma berish paytida yo'q edi, dispatch paytida paydo bo'lishi mumkin. `releaseDueOrder` da qayta tekshirilishi shart. Buning uchun metod `private` → `public` qilinadi (`orders-creation.service.ts:87`).

12. **Promo kodi ikki marta "iste'mol qilinmasligi".** `promoCodesService.apply()` faqat `completeTrip` da chaqiriladi (izoh `orders-creation.service.ts:149-151`). `releaseDueOrder` faqat `validate()` chaqiradi, `apply()` ni EMAS. Buni buzsa, rejalashtirilgan safar bekor bo'lganda ham promo yonib ketadi.

13. **Mobil `Order.isActive` va `checkActiveOrder()`.** `scheduled` ni `isActive` ga qo'shsa, `checkActiveOrder()` (satr ~380) uni topib bosh ekranni kuzatuv rejimiga qulflaydi va yo'lovchi yangi safar buyurtma qila olmaydi. **`isActive` o'zgarmasligi shart.**

14. **`Equatable.props`.** `Order` ga qo'shilgan har bir maydon `props` ga ham qo'shilishi kerak, aks holda `copyWith` natijasi eskisiga teng bo'lib, UI yangilanmaydi.

15. **Ko'p instansda ishlash.** `matching.service.ts` 38-51 satrdagi izoh: hozir bitta backend instansi. `releaseDueOrder` dagi shartli `UPDATE ... WHERE status IN ('scheduled')` **exactly-once ni allaqachon kafolatlaydi** — ikki instans bir buyurtmani ko'rsa ham, faqat bittasi `startSearch` ni chaqiradi. Redis lock kerak emas.

16. **`getActiveOrders` dan `attachDisplayFields` unutilmasin.** Yangi `getScheduledOrders` da uni chaqirmasa, mobil `Order.fromJson` `json['pickup']` da null exception beradi (PostGIS geometry ORM orqali opaque).

---

## 6. Cron: `@nestjs/schedule` yetarlimi?

**TASDIQLAYMAN — Kafka/BullMQ/queue KERAK EMAS.** Sabablari:

1. **Allaqachon o'rnatilgan va ishlayapti.** `backend/package.json:29` → `"@nestjs/schedule": "^4.0.0"`. `app.module.ts:166` → `ScheduleModule.forRoot()` root'da. Ikki mavjud iste'molchi: `MatchingService.sweepExpiredOffers` (`@Interval(2000)`) va `RefreshTokenCleanupService.handleCron` (`@Cron(EVERY_DAY_AT_3AM)`).

2. **Holat xotirada emas, Postgres'da.** Rejalashtirilgan buyurtma haqidagi yagona haqiqat manbai — `orders.status = 'scheduled'` + `orders.scheduled_at` qatori. Cron faqat "hozir kimning vaqti keldi" deb so'raydi. Deploy, crash, restart — hech narsa yo'qolmaydi, keyingi tick davom ettiradi. Bu aynan queue beradigan durability. `matching.service.ts` 30-51 satrdagi izoh `setTimeout` ni nega olib tashlaganini tasvirlaydi — biz o'sha xatoni takrorlamaymiz.

3. **Exactly-once allaqachon bor.** `OrderStatusTransitionService.updateOrderStatusAtomic(orderId, [SCHEDULED], ...)` — `UPDATE ... WHERE id = ? AND status IN ('scheduled')`. `affected === 0` → `ConflictException`. Queue'ning "visibility timeout" mexanizmi shu bitta SQL bilan almashtiriladi.

4. **Hajm arzimas.** Angren shahri uchun bir daqiqada 0-3 ta rejalashtirilgan buyurtma. `idx_orders_status_scheduled_at` indeksi bo'yicha `LIMIT 50` so'rov — mikrosoniyalar. Solishtirish uchun: `MatchingService` **har 2 soniyada** Redis'dan butun aktiv to'plamni o'qiydi va har biri uchun so'rov yuboradi. Bizning yuk undan ~30 barobar kam.

5. **Bitta instans.** `matching.service.ts:44-51` deployment topologiyasini hujjatlaydi. Ko'p instansga o'tilganda ham (3-band) shartli UPDATE yetarli.

**RAD ETILADI:** Kafka (event streaming platformasi — bu yerda event stream yo'q), BullMQ/Bull (Redis bor, lekin u qo'shimcha infratuzilma, retry semantikasi va monitoring talab qiladi — hozirgi muammo uchun ortiqcha), `SchedulerRegistry.addTimeout` per-order (restart'da barcha timerlar yo'qoladi — `matching.service.ts` da aynan shu sabab olib tashlangan).

**Yagona ehtiyot chorasi:** cron metodi tanasi to'liq `try/catch` ichida bo'lishi shart (`refresh-token-cleanup.service.ts:52-59` namunasi) — cron'dagi ushlanmagan xato Nest scheduler'ini jim qoldirishi mumkin.

---

## 7. Baho (kun hisobida, bitta dasturchi)

| Bosqich | Ish | Kun |
|---|---|---|
| 1 | Entity + 2 ta migratsiya + indeks; `numeric` transformer'lar | 0.5 |
| 2 | `CreateOrderDto`/`CreateDispatchOrderDto` + validatsiya; `create()` shoxlanishi; `estimateRouteMetrics`/`quoteForOrder` ajratilishi | 1.0 |
| 3 | `ScheduledOrdersService` — 3 ta cron, `releaseDueOrder`, reprice + cap + promo degradatsiya, bekor qilish yo'llari | 1.5 |
| 4 | Controller endpoint'lari (`GET /orders/scheduled`, `PATCH /:id/reschedule`), fasad delegatlari, `RescheduleOrderDto`, `providers.ts` | 0.5 |
| 5 | `NotificationsService` 3 ta metod + `MatchingService` no-driver push + **`SurgeService` scheduled filtri (5-tuzoq)** | 0.5 |
| 6 | Backend spec fayllari (3 yangi + 4 yangilanish) | 1.5 |
| 7 | Mobil model + `api_endpoints` + `SocketEvents` + `Formatters` | 0.5 |
| 8 | `ScheduleRideSheet` widget (dizayn tizimiga to'liq mos, 48dp, tokenlar) | 1.0 |
| 9 | `tariff_select_screen` integratsiyasi (chip, CTA, izoh banneri, karta to'lovi shoxlanishi) | 0.5 |
| 10 | `ScheduledOrdersScreen` + route + `home_screen` banneri | 1.0 |
| 11 | `OrderProvider` o'zgarishlari | 0.5 |
| 12 | Mobil testlar (4 fayl) | 0.5 |
| 13 | Qo'lda QA: haqiqiy vaqt siljishi bilan end-to-end (T-10min dispatch, surge o'zgarishi, cap, no-driver) | 1.0 |
| | **JAMI** | **10.5 kun** |

Realistik oyna: **10-12 ish kuni**. Agar `showTimePicker` bilan cheklansangiz (8-bosqich o'rniga `app_theme.dart` ga picker temasi) — 0.5 kun tejaladi, lekin dizayn izchilligi pasayadi.

**8-tuzoq (completion'da zone surge yo'qligi) ATAYLAB doiradan tashqarida** — u alohida qaror va alohida bayroq talab qiladi, aks holda barcha mavjud safarlar ham qayta narxlanadi.
