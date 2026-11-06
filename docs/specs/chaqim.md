# Chaqim (tips) — bajarish spetsifikatsiyasi

> Tuzilgan: 2026-08-19 · mavjud kod o'qib chiqilgan holda
> Asos: [TASK-yandex-parity.md](../TASK-yandex-parity.md)

---

# CHAQIM (TIPS) — BAJARISH REJASI

Barcha fayllar o'qildi. Kodda **hozir hech qanday tip/chaqim mantiqi yo'q** (`grep -ri "tip"` — faqat `multiplier`, `multipart` kabi soxta mosliklar). Ya'ni hamma narsa noldan quriladi.

---

## 0. Asosiy qaror: chaqim qanday to'lanadi

Kodni o'qib chiqqach, **MVP uchun faqat HAMYON (WALLET) orqali chaqim** tavsiya qilinadi. Sabablari kodda:

- **Karta (CARD) chaqimi hozirgi to'lov qatlamini buzadi.** `/home/diyorbek/AngrenTaxi/backend/src/modules/payments/payments.service.ts`:
  - `resolvePayableOrder()` faqat `taxiOrder.finalPrice ?? estimatedPrice` qaytaradi — chaqim haqida bilmaydi, shuning uchun `initiatePayment` chaqim uchun **yo'l narxini qayta undiradi**.
  - `findPaymentTransaction(orderId)` `type: DEBIT` bo'yicha **eng oxirgi** qatorni oladi. Chaqim DEBIT qatori yo'l DEBIT qatorini "to'sib qo'yadi" va `amountsMatch()` noto'g'ri summani solishtiradi → provayder callback'i rad etiladi.
  - `settleOrderPayout(orderId)` shu buyurtmadagi **BARCHA** PENDING oyoqlarni COMPLETED ga o'giradi va `netPayout` ni qo'shadi — chaqim oyog'i ham qo'shilib ketadi (bu aslida to'g'ri natija, lekin yuqoridagi ikki muammo tufayli u yergacha yetib bormaydi).
- **Naqd (CASH) chaqim ma'nosiz** — yo'lovchi haydovchiga qo'lida beradi, tizim yozmaydi.

Shuning uchun: **1-bosqich = WALLET**, **2-bosqich = CARD** (payments.service.ts refaktoringi bilan, quyida 6-bo'limda aniq ko'rsatilgan).

---

## 1. Entity va migratsiya

### 1.1 `/home/diyorbek/AngrenTaxi/backend/src/database/entities/order.entity.ts`

`driverEarning` maydonidan keyin 3 ta yangi ustun (mavjud `discountAmount` transformer uslubini aynan takrorlab):

| Maydon (TS) | Ustun | Tip | Default | Izoh |
|---|---|---|---|---|
| `tipAmount: number \| null` | `tip_amount` | `decimal(10,2)`, nullable | `null` | `null` = chaqim yo'q. **0 emas**, chunki `discountAmount`/`driverEarning` ham nullable — bir xil konventsiya |
| `tipPaymentMethod: PaymentMethod \| null` | `tip_payment_method` | `enum orders_payment_method_enum`, nullable | `null` | Yo'l naqd, chaqim hamyon bo'lishi mumkin — safar `paymentMethod` idan mustaqil |
| `tipPaidAt: Date \| null` | `tip_paid_at` | `timestamp`, nullable | `null` | Idempotentlik va hisobot uchun |

Transformer'lar `discountAmount` dagi bilan bir xil:
```
to: (value: number | null) => value,
from: (value: string | null) => (value !== null ? parseFloat(value) : null),
```

`@Index` qo'shish **shart emas** — chaqim `orders` qatorining ichida, mavjud `idx_orders_driver_id_created_at` daromad agregatlariga yetarli.

### 1.2 Migratsiya: `/home/diyorbek/AngrenTaxi/backend/src/database/migrations/001_order_tips.ts`

Diqqat — TypeORM migratsiyalarni **klass nomidagi timestamp** bo'yicha tartiblaydi (`Baseline1700000000000`). Shuning uchun klass nomi: `OrderTips1700000000100` (baseline'dan katta bo'lishi shart).

```
up:   ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "tip_amount" numeric(10,2),
        ADD COLUMN IF NOT EXISTS "tip_payment_method" "public"."orders_payment_method_enum",
        ADD COLUMN IF NOT EXISTS "tip_paid_at" TIMESTAMP;
down: ALTER TABLE "orders" DROP COLUMN IF EXISTS ... (uchtasi)
```

`IF NOT EXISTS` majburiy: `app.module.ts:142` da `synchronize` dev'da yoqiq, Railway'da esa jadval `synchronize` bilan qurilgan — migratsiya u yerda ustun mavjud holatga tushishi mumkin (`000_baseline.ts` ning butun mantig'i shu haqida).

---

## 2. Backend

### 2.1 Yangi DTO — `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/dto/add-tip.dto.ts`

```
class AddTipDto {
  @IsInt() @Min(1000) @Max(200000)  amount: number;   // so'm, butun son
}
```
`@ApiProperty` bilan (mavjud `submit-rating.dto.ts` uslubi). To'lov usuli DTO da **yo'q** — 1-bosqichda har doim `PaymentMethod.WALLET`, uni klient tanlamaydi.

### 2.2 Yangi servis — `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders-tips.service.ts`

Nega alohida fayl: `orders-completion.service.ts` allaqachon 494 qator va faylning o'zi "bu o'tish qolgan hammasidan ko'proq biznes qoidasi tashiydi" deb izohlangan. Chaqim — safar tugagandan **keyingi** alohida pul hodisasi, `completeTrip` ichiga tiqish noto'g'ri.

Yagona ommaviy metod:

```
async addTip(passengerId: string, orderId: string, dto: AddTipDto): Promise<{ tipAmount: number; walletBalance: number }>
```

Bog'liqliklar (konstruktorda): `@InjectRepository(Order)`, `@InjectRepository(Transaction)`, `DataSource`, `DriversService`, `RealtimeGateway`, `NotificationsService`, `UsersService`, `OrdersQueryService`.

Mantiq ketma-ketligi:

1. `queryService.findByIdOrThrow(orderId)`.
2. `order.passengerId !== passengerId` → `ForbiddenException`.
3. `order.status !== OrderStatus.COMPLETED` → `BadRequestException` (ratings.service.ts dagi bir xil qoida).
4. `order.driverId == null` → `BadRequestException('Bu buyurtmaga haydovchi biriktirilmagan')`.
5. **Vaqt oynasi**: chaqim faqat safar tugagandan keyin 24 soat ichida. **DIQQAT — `orders` da `completed_at` ustuni YO'Q.** Faqat `updatedAt` bor, u har qanday yangilanishda siljiydi. To'g'ri manba — `trips.end_time` (`/home/diyorbek/AngrenTaxi/backend/src/database/entities/trip.entity.ts:31`). Ikki variant: (a) `tripRepository.findOne({where:{orderId}})` orqali `endTime` ni o'qish, (b) migratsiyaga `completed_at` ni ham qo'shib, `completeTrip` da to'ldirish. **(a) tavsiya etiladi** — yangi ustunsiz.
6. `this.dataSource.transaction(async (manager) => { ... })` ichida:
   - `await manager.query('SELECT id FROM orders WHERE id = $1 FOR UPDATE', [orderId])` — bir vaqtda ikki marta chaqim yozilishining oldini oladi.
   - Qatorni qayta o'qish: `const fresh = await manager.findOne(Order, {where:{id: orderId}})`; agar `fresh.tipAmount != null` → `ConflictException('Bu safar uchun chaqim allaqachon berilgan')`.
   - `await lockWalletForUpdate(manager, passengerId)` — `/home/diyorbek/AngrenTaxi/backend/src/modules/payments/wallet-balance.util.ts` dan.
   - `const balance = await computeWalletBalance(manager.getRepository(Transaction), passengerId)`.
   - `balance < dto.amount` → `BadRequestException('Hamyonda mablag' yetarli emas')`. **PENDING qarz YARATMANG** — sabab 5-bo'limdagi TUZOQ #1.
   - Yo'lovchi DEBIT: `{ userId: passengerId, orderId, amount, type: DEBIT, paymentMethod: WALLET, status: COMPLETED, externalId: 'tip' }`.
   - Haydovchi CREDIT: `{ userId: order.driverId, orderId, amount, type: CREDIT, paymentMethod: WALLET, status: COMPLETED, externalId: 'tip' }`.
   - **Komissiya DEBIT qatori YO'Q** — chaqim komissiyasiz. Bu talabning butun mohiyati va uni kodda tasdiqlaydigan yagona joy shu: `externalId: 'commission'` qatori yozilmaydi.
   - `await this.driversService.adjustBalanceWithin(manager, order.driverId, +dto.amount)` — to'liq summa, komissiyasiz.
   - `await manager.update(Order, orderId, { tipAmount: dto.amount, tipPaymentMethod: PaymentMethod.WALLET, tipPaidAt: new Date() })`.
7. Tranzaksiyadan **tashqarida** (best-effort, `try/catch` bilan — `completeTrip` dagi referral bonus uslubi):
   - `this.realtimeGateway.emitToUser(order.driverId, 'order:tip', { orderId, amount })`.
   - `notificationsService.notifyTipReceived(driverUser, amount, order)`.

### 2.3 Fasad — `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.service.ts`

`completeTrip` dan keyin:
```
addTip(passengerId: string, orderId: string, dto: AddTipDto) {
  return this.tipsService.addTip(passengerId, orderId, dto);
}
```
+ konstruktorga `private readonly tipsService: OrdersTipsService`.

### 2.4 Providers — `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.providers.ts`

`ORDERS_PROVIDERS` massiviga `OrdersTipsService` qo'shish. **Bu bitta qator 10+ spec faylini avtomatik tuzatadi** — fayl izohida aynan shu maqsad yozilgan ("adding a new collaborator service never means touching six spec files").

### 2.5 Controller — `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.controller.ts`

`@Patch(':id/complete')` dan keyin:

```
@Post(':id/tip')
@Roles(UserRole.PASSENGER)
@ApiOperation({ summary: 'Passenger adds a commission-free tip for the driver' })
@ApiParam({ name: 'id', description: 'Order UUID' })
@ApiResponse({ status: 201, ... }) / 400 / 403 / 409
async addTip(
  @CurrentUser() user: User,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: AddTipDto,
) { return this.ordersService.addTip(user.id, id, dto); }
```

Marshrut to'qnashuvi yo'q: mavjud POST'lar `calculate-price` (1 segment) va `dispatch` (1 segment), yangisi 2 segment.

### 2.6 Module — `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.module.ts`

`imports` ga o'zgarish **kerak emas** — `TypeOrmModule.forFeature([Order, Trip, Transaction, ...])`, `DriversModule`, `RealtimeModule`, `NotificationsModule`, `UsersModule` allaqachon bor.

### 2.7 Bildirishnoma — `/home/diyorbek/AngrenTaxi/backend/src/modules/notifications/notifications.service.ts`

`notifyTripCompleted` (159-qator) uslubida yangi metod:
```
async notifyTipReceived(driver: User, amount: number, order: Order): Promise<void>
```

### 2.8 Daromad agregati — `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders-earnings.service.ts`

`/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.types.ts` da `DriverEarningsPeriod` ga `tips: number` qo'shiladi.

`getDriverEarningsForPeriod` da **`.addSelect('COALESCE(SUM(o.tip_amount), 0)', 'tips')` ni mavjud query'ga QO'SHMANG.** Sabab: u query'da `leftJoin(Transaction, 't', ... external_id = 'commission')` bor. Hozir bu 1:1 (buyurtmaga bitta komissiya qatori), lekin agar kelajakda buyurtmaga ikkita 'commission' qatori tushsa, `SUM(o.tip_amount)` ham, `SUM(o.final_price)` ham ikkilanadi. Xavfsiz variant — **ikkinchi, join'siz so'rov**:

```
const tipsResult = await this.orderRepository.createQueryBuilder('o')
  .select('COALESCE(SUM(o.tip_amount), 0)', 'tips')
  .where('o.driver_id = :driverId', { driverId })
  .andWhere('o.status = :s', { s: OrderStatus.COMPLETED })
  .andWhere('o.created_at >= :from', { from })
  .getRawOne<{ tips: string }>();
```

Qaytish qiymati: `{ gross, commission, tips, net: gross - commission + tips, trips }`.

**Qaror:** `net` ichiga chaqimni qo'shish tavsiya etiladi — haydovchi uchun "qo'lga tegadigan pul" aynan shu. Bu mavjud 6 ta test kutilmasini o'zgartiradi, lekin ular `toEqual({...})` ishlatgani uchun `tips` kalitini qo'shishning o'zi ham ularni buzadi — ya'ni yangilash baribir majburiy (4-bo'limga qarang).

`getDriverEarningsToday` (`SUM(o.final_price)`) — **tegilmaydi**, u sarlavha ko'rsatkichi va chaqimsiz "yo'l tushumi" ma'nosini saqlaydi.

### 2.9 Hisobotlarga ta'sir

`/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders-stats.service.ts` — `SUM(o.final_price)` ishlatadi, chaqim `tip_amount` da alohida yotgani uchun **platforma daromadi hisobotlari avtomatik to'g'ri qoladi** (chaqim platforma daromadi emas). O'zgarish kerak emas; xohlasa "haydovchilarga o'tgan chaqim" alohida ko'rsatkich sifatida qo'shiladi.

---

## 3. Mobil

### 3.1 `/home/diyorbek/AngrenTaxi/mobile/lib/core/network/api_endpoints.dart`
`// Ratings` blokidan oldin, Orders bo'limiga:
```
static String addTip(String id) => '/orders/$id/tip';
```

### 3.2 Yangi widget — `/home/diyorbek/AngrenTaxi/mobile/lib/features/passenger/widgets/tip_selector.dart`

`TipSelector({required int selected, required ValueChanged<int> onChanged, required double? walletBalance})`

- Presetlar: `[0, 2000, 5000, 10000]` + "Boshqa" (`TextField`, `keyboardType: TextInputType.number`).
- Har bir chip — **`AppPressable`** (`/home/diyorbek/AngrenTaxi/mobile/lib/shared/widgets/app_pressable.dart`), `semanticsLabel: '2 000 so'm chaqim'`, `pressedScale` default.
- Ranglar **faqat tokenlar** (`/home/diyorbek/AngrenTaxi/mobile/lib/core/config/app_theme.dart`):
  - tanlanmagan: `color: kSurface2`, matn `kInk`, chegara `kLine`
  - tanlangan: `color: kMintTint`, matn `kOnMint` yoki `kInk`, chegara `kMintDeep`
  - radius `kRadiusFull`, ichki bo'shliq `kSpace3`/`kSpace4`, chiplar orasi `kSpace2`
  - **balandlik `kMinTapTarget` (48) dan kam bo'lmasin** — `ConstrainedBox(minHeight: kMinTapTarget)`.
- Sarlavha: `"Haydovchiga chaqim"`, ost yozuv: `"Chaqim to'liq haydovchiga o'tadi — komissiya olinmaydi."` (`kFontLabel`, `kInkMuted`). Bu jumla mahsulot va'dasi, uni ekranga chiqarish shart.
- Gutter uchun `context.gutter` (`/home/diyorbek/AngrenTaxi/mobile/lib/core/config/app_responsive.dart`).

### 3.3 `/home/diyorbek/AngrenTaxi/mobile/lib/features/passenger/screens/rate_driver_screen.dart`

- `int _tipAmount = 0;` holati.
- Yulduzlar qatori bilan izoh maydoni orasiga (`const SizedBox(height: kSpace8)` dan keyin) `TipSelector` joylashtiriladi.
- `_submit()` o'zgaradi: avval mavjud `POST /ratings`, keyin `_tipAmount > 0` bo'lsa `POST /orders/{id}/tip`.
- **Muhim UX qoidasi:** chaqim so'rovi xato bersa (mablag' yetmasa), **reyting yuborilganini bekor qilmang** — reyting muvaffaqiyatli, chaqim xatosi alohida `SnackBar` bo'lib chiqadi va ekran yopilmaydi (foydalanuvchi hamyonni to'ldirib qayta urinishi mumkin). Buning aksi — reyting ikki marta yuborilishi va backend'dan `409 Conflict` olish (`ratings.service.ts` da `ConflictException`).
- `Spacer()` dan oldin joy yetmasligi mumkin — hozirgi `Column` `Spacer` bilan qattiq. `SingleChildScrollView` ga o'rash yoki `Column` ni `Expanded(child: ListView(...))` ga aylantirish kerak, aks holda kichik ekranlarda `RenderFlex overflow`.

### 3.4 `/home/diyorbek/AngrenTaxi/mobile/lib/features/passenger/order_provider.dart`

Yangi metod:
```
Future<String?> sendTip(String orderId, int amount)  // null = muvaffaqiyat, aks holda xato matni
```
`_apiClient.post(ApiEndpoints.addTip(orderId), data: {'amount': amount})`, `extractErrorMessage(e)` bilan.

Eslatma: hozirgi `rate_driver_screen.dart` `sl<ApiClient>()` ni **to'g'ridan-to'g'ri** chaqiradi (provider'ni chetlab o'tadi). Yangi kod uchun provider metodi tavsiya etiladi; agar mavjud uslubga rioya qilinsa, ikkalasi ham ekranda qoladi — lekin aralashtirmang.

### 3.5 Hamyon balansi

`SuperappProvider` passenger flavor'da allaqachon ro'yxatdan o'tgan (`/home/diyorbek/AngrenTaxi/mobile/lib/app.dart:65`). `RateDriverScreen` `initState` da `context.read<SuperappProvider>().loadWalletBalance()` chaqirib, balans chaqimdan kam bo'lsa chipni o'chirilgan holatda ko'rsatadi va "Hamyonni to'ldirish" tugmasini beradi (`TopUpScreen` mavjud: `/home/diyorbek/AngrenTaxi/mobile/lib/features/superapp/screens/topup_screen.dart`).

### 3.6 Haydovchi tomoni

- `/home/diyorbek/AngrenTaxi/mobile/lib/core/socket/socket_service.dart` — `SocketEvents` ga: `static const String orderTip = 'order:tip';`
- `/home/diyorbek/AngrenTaxi/mobile/lib/features/driver/driver_provider.dart` — `_socketService.on(SocketEvents.orderTip, ...)`: `loadEarningsBreakdown()` ni qayta chaqiradi va bir martalik `pendingTipMessage` maydonini to'ldiradi (`OrderProvider.noDriversFoundMessage` naqshi bilan bir xil: maydon + `clearPendingTipMessage()`).
- `/home/diyorbek/AngrenTaxi/mobile/lib/shared/models/driver_earnings_breakdown.dart` — `DriverEarningsPeriod` ga `final double tips;` + `fromJson` da `(json['tips'] as num?)?.toDouble() ?? 0` + `props` ga qo'shish.
- `/home/diyorbek/AngrenTaxi/mobile/lib/features/driver/screens/earnings_screen.dart` — `_buildBreakdownSection` ichida, "Komissiya" qatoridan keyin, "Sof (net)" dan oldin yangi qator: `label: 'Chaqim'`, `value: '+ ${Formatters.formatPrice(period.tips)}'`, `valueKey: const ValueKey('earnings_tips_value')`, rang `kMintDeep` (mavjud komissiya qatori `kError*` bilan qanday qilingan bo'lsa, shunga simmetrik).

---

## 4. Testlar

### 4.1 Yangi: `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.service.tips.spec.ts`

Shablon: `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.service.settlement.spec.ts` (u `ORDERS_PROVIDERS` + soxta `DataSource.transaction` + `getRepositoryToken(...)` naqshini to'liq ko'rsatadi). Testlar:

1. `addTip` yo'lovchi DEBIT va haydovchi CREDIT — ikkalasi ham `COMPLETED`, `externalId: 'tip'`.
2. **`externalId: 'commission'` qatori YOZILMAYDI** — `managerSave.mock.calls` ichida yo'qligini tasdiqlash. Bu butun feature'ning asosiy testi.
3. `adjustBalanceWithin` **to'liq** chaqim summasi bilan chaqiriladi (komissiya ayirilmaydi).
4. `orders.tip_amount` = summa, `tip_paid_at` != null.
5. Hamyonda mablag' yetmasa → `BadRequestException`, hech qanday `Transaction` saqlanmaydi, `adjustBalanceWithin` chaqirilmaydi.
6. `order.status !== COMPLETED` → `BadRequestException`.
7. Boshqa yo'lovchi → `ForbiddenException`.
8. `tipAmount` allaqachon to'ldirilgan → `ConflictException` (ikki marta chaqim yo'q).
9. 24 soatdan keyin → `BadRequestException` (`jest.useFakeTimers()` bilan, `earnings-breakdown.spec.ts` dagi `NOW` naqshi).

### 4.2 Yangilanadi: `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.service.earnings-breakdown.spec.ts`

- Fikstura interfeysi `FixtureOrder` ga `tipAmount: number | null` qo'shiladi.
- Soxta `getRawOne` ikki xil so'rovni ajratishi kerak (biri `commission` bilan join qilingan, ikkinchisi `tips`) — hozirgi soxta builder bitta shakl qaytaradi, uni `select`/`addSelect` chaqiruvlariga qarab tarmoqlantirish kerak.
- **6 ta mavjud `toEqual({ gross, commission, net, trips })` kutilmasining hammasi `tips` kaliti bilan yangilanadi** — aks holda hammasi qizil bo'ladi.
- Yangi test: chaqimli buyurtma → `net = gross - commission + tips`.

### 4.3 `/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders.service.settlement.spec.ts`
`ORDERS_PROVIDERS` orqali `OrdersTipsService` avtomatik ulanadi. Agar `OrdersTipsService` `OrdersQueryService` yoki `Trip` repozitoriyasidan boshqa yangi bog'liqlik olsa, **shu spec va yana 9 ta spec DI xatosi bilan yiqiladi** — yangi provider qo'shmang, mavjudlari bilan cheklaning (5-bo'lim, TUZOQ #5).

### 4.4 Mobil
Loyihada Flutter widget testlari yo'q. Minimal: `flutter analyze` toza o'tishi + qo'lda QA. Xohlasa `mobile/test/tip_selector_test.dart` — chip tanlash `onChanged` ni to'g'ri summa bilan chaqirishi.

---

## 5. TUZOQLAR

**TUZOQ #1 — PENDING chaqim qarzi yo'lovchini bloklab qo'yadi.**
`/home/diyorbek/AngrenTaxi/backend/src/modules/orders/orders-creation.service.ts:90-115` — `getOutstandingWalletDebt()` `type=DEBIT AND status=PENDING AND paymentMethod=WALLET AND orderId IS NOT NULL` bo'yicha yig'adi va nolga teng bo'lmasa **yangi buyurtmani umuman rad etadi**. Agar chaqimni "keyin to'lanadi" deb PENDING yozsangiz, ixtiyoriy chaqim yo'lovchini ilovadan butunlay chiqarib tashlaydi. Shuning uchun chaqim faqat COMPLETED bo'ladi yoki umuman yozilmaydi.

**TUZOQ #2 — komissiya bexosdan qo'shilib ketishi.**
`completeTrip` ichida komissiya `discountedFinalPrice` dan hisoblanadi. Agar kimdir kelajakda `finalPrice` ga chaqimni qo'shsa (`finalPrice = fare + tip`), komissiya avtomatik chaqimdan ham olinadi. **Shuning uchun `finalPrice` ga HECH QACHON tegilmaydi** — chaqim alohida `tip_amount` ustunida yashaydi. Buni entity izohida yozib qo'ying.

**TUZOQ #3 — `settleOrderPayout` chaqim oyog'ini "yutib yuboradi".**
`/home/diyorbek/AngrenTaxi/backend/src/modules/payments/payments.service.ts:settleOrderPayout` — `{orderId, userId: driverUserId, status: PENDING}` bo'yicha **barcha** oyoqlarni oladi. WALLET chaqimi COMPLETED yozilgani uchun 1-bosqichda muammo yo'q, lekin karta chaqimi qo'shilganda bu funksiya yo'l va chaqimni ajrata olmaydi. Karta bosqichida `externalId` bo'yicha filtrlash kerak bo'ladi.

**TUZOQ #4 — `findPaymentTransaction` eng oxirgi DEBIT ni oladi.**
Xuddi shu faylda `order: { createdAt: 'DESC' }`. Chaqim DEBIT qatori (hatto WALLET bo'lsa ham, `orderId` bir xil) yo'l DEBIT qatoridan **keyin** yaratiladi, ya'ni karta callback'i chaqim qatorini topib, `amountsMatch()` da yo'l narxi bilan solishtiradi va **to'lovni rad etadi**. Agar buyurtma karta bilan to'lanmagan bo'lsa (WALLET/CASH), callback umuman kelmaydi — 1-bosqichda xavf yo'q. Lekin **aralash holat mavjud**: karta yo'li + hamyon chaqimi. Yechim: `findPaymentTransaction` ga `paymentMethod: PaymentMethod.CARD` filtri qo'shish (bitta qator, lekin `payments.service.ts` da 4 ta callback bilan bog'liq — o'zgartirish bilan birga `payments.service.spec.ts` regressiyasini yuritish shart). **Buni 1-bosqichning bir qismi qiling, kechiktirmang.**

**TUZOQ #5 — DI to'lqin effekti.**
`ORDERS_PROVIDERS` 10+ spec faylida ishlatiladi. `OrdersTipsService` ga yangi bog'liqlik (masalan `PaymentsService`) qo'shilsa, hamma spec `Nest can't resolve dependencies` bilan yiqiladi va har birida yangi mock provider yozish kerak bo'ladi. Faqat mavjudlaridan foydalaning. Shuningdek `PaymentsModule` ni `OrdersModule` ga import qilish **aylanma bog'liqlik** beradi (`PaymentsModule` → `DriversModule`, `OrdersModule` → `DriversModule`; `PaymentsService` `Order` repozitoriyasini oladi) — kirmang.

**TUZOQ #6 — `driver_earning` ustuni chalg'ituvchi.**
`order.entity.ts:151-164` izohi va `completeTrip:281` — u **komissiya ayirilgan sof yo'l haqi**. Chaqimni u yerga qo'shmang, aks holda `driverEarning` "komissiya bazasi" ma'nosini yo'qotadi. Chaqimni ko'rsatish kerak bo'lsa, o'qish vaqtida `driverEarning + tipAmount` sifatida hisoblang.

**TUZOQ #7 — `agentga` ko'rinmas ekran chegarasi.**
`rate_driver_screen.dart` da `Column` + `Spacer()` bor. `TipSelector` (chiplar + izoh matni ≈ 120dp) qo'shilishi bilan kichik ekranlarda (SE, 5") `RenderFlex overflowed` chiqadi. Ekranni scroll qilinadigan qilish **majburiy**, ixtiyoriy emas.

**TUZOQ #8 — `synchronize` va migratsiya nomuvofiqligi.**
`app.module.ts:138` `migrationsRun: true`, `142` `resolveDbSynchronize(...)`. Dev'da `synchronize` ustunlarni entity'dan avtomatik yaratadi, prod'da esa faqat migratsiya. Migratsiyani `IF NOT EXISTS` siz yozsangiz, dev'da ishlagan kod Railway'da **deploy'ni yiqitadi** — bu `000_baseline.ts` da allaqachon bir marta bosib o'tilgan tuzoq.

**TUZOQ #9 — pul birligi.**
Hamma joyda so'm (UZS), butun sonlar. `completeTrip` da `Math.round()` faqat komissiyada ishlatiladi. Chaqimni `@IsInt()` bilan cheklang, aks holda `2000.555` `decimal(10,2)` ga tushib, hamyon balansida tiyin qoldiqlari paydo bo'ladi.

**TUZOQ #10 — javob konverti.**
`/home/diyorbek/AngrenTaxi/backend/src/common/interceptors/response.interceptor.ts` hamma javobni `{success, data}` ga o'raydi. Mobil tomonda `response.data['data']` deb o'qing (`order_provider.dart:446` dagi naqsh) — bu takroran unutiladigan xato.

---

## 6. 2-bosqich (karta chaqimi) — hozir emas, lekin nima kerakligi

1. `payments.service.ts` → `resolvePayableOrder` ga `purpose: 'fare' | 'tip'` parametri.
2. `findPaymentTransaction(orderId, purpose)` — `externalId` prefiksi yoki yangi `transactions.purpose` ustuni bo'yicha ajratish.
3. `settleOrderPayout(orderId)` → `settleOrderPayout(orderId, purpose)`.
4. Payme/Click/Uzcard uchun `account.order_id` ga chaqimni ajratuvchi qo'shimcha (masalan `orderId + ':tip'`) — uchala provayder callback'i va ularning spec fayllari.

Bu ~2 qo'shimcha kun va uchala to'lov provayderi bilan regressiya talab qiladi.

---

## 7. Baho (kun)

| Ish | Kun |
|---|---|
| Entity + migratsiya (`001_order_tips.ts`) | 0.5 |
| `orders-tips.service.ts` + DTO + controller + fasad + providers | 1.5 |
| `findPaymentTransaction` ga CARD filtri + payments regressiyasi (TUZOQ #4) | 0.5 |
| Daromad agregati (`orders-earnings.service.ts` + `orders.types.ts`) + realtime + bildirishnoma | 0.5 |
| Backend testlar (yangi tips spec + earnings-breakdown spec yangilash) | 1.0 |
| Mobil yo'lovchi: `tip_selector.dart`, `rate_driver_screen.dart`, `order_provider.dart`, endpoint | 1.5 |
| Mobil haydovchi: socket event, model, `earnings_screen.dart` | 0.5 |
| Qo'lda QA (hamyon yetarli/yetarsiz, ikki marta chaqim, 24 soat oynasi, naqd yo'l + hamyon chaqimi) | 0.5 |
| **JAMI** | **~6.5 kun** (1-bosqich, faqat hamyon) |

Karta chaqimi qo'shilsa: **+2 kun** (jami ~8.5).
