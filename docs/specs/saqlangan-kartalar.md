# Saqlangan kartalar — bajarish spetsifikatsiyasi

> Tuzilgan: 2026-08-19 · mavjud kod o'qib chiqilgan holda
> Asos: [TASK-yandex-parity.md](../TASK-yandex-parity.md)

---

# Saqlangan kartalar — bajarish rejasi

## 0. PROVIDER TAHLILI (kod asosida, taxminsiz)

| Provider | Fayl | Tokenizatsiya uchun bazasi bormi? | Xulosa |
|---|---|---|---|
| **Payme** | `payme.provider.ts` | **HA — qisman** | 1-bosqich |
| **Click** | `click.provider.ts` | **YO'Q** | 2-bosqich |
| **Uzcard** | `uzcard.provider.ts` | **YO'Q (skelet)** | Qamrovdan tashqarida |

**Payme** — yagona provider, unda tokenizatsiya uchun kerak bo'lgan **transport allaqachon mavjud**. `verify()` metodi (`payme.provider.ts:72-99`) `https://checkout.paycom.uz/api` ga JSON-RPC POST qiladi:
```ts
axios.post('https://checkout.paycom.uz/api',
  { method: 'receipts.get', params: { id: transactionId } },
  { headers: { Authorization: `Basic ${credentials}` } })
```
Bu — Payme'ning **Subscribe API** endpointi bilan bir xil endpoint. Karta biriktirish metodlari (`cards.create`, `cards.get_verify_code`, `cards.verify`, `cards.check`, `cards.remove`) va token bilan to'lash (`receipts.create` + `receipts.pay`) aynan shu URL orqali chaqiriladi. Ya'ni yozish kerak bo'lgan narsa — yangi metodlar, yangi HTTP klient emas.

**KODDA YO'Q, ochiq aytaman:**
- `X-Auth` sarlavhasi. Hozirgi kod `Authorization: Basic base64("Paycom:" + secretKey)` ishlatadi — bu **Merchant API** (callback) autentifikatsiyasi. Subscribe API `X-Auth: <merchant_id>` (cards.* uchun) va `X-Auth: <merchant_id>:<subscribe_key>` (receipts.* uchun) talab qiladi. Bu ikki kalit **turli** kalitlar.
- `PAYME_SUBSCRIBE_KEY` env o'zgaruvchisi yo'q (`env.validation.ts:104-108` da faqat `PAYME_MERCHANT_ID` va `PAYME_SECRET_KEY` bor; `.env.example:44-46`).
- Aniq so'rov/javob formatlari Payme merchant shartnomasi hujjatidan tasdiqlanishi shart — kodda ular yo'q, men ularni kod asosida tiklay olmayman.

**Click** — `click.provider.ts` da **`axios` importi umuman yo'q**. `verify()` (satr 62-67) qattiq `false` qaytaradi va izoh ochiq aytadi: *"Click doesn't have a direct verification endpoint in the same way"*. Config'da `CLICK_MERCHANT_ID`, `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY` bor, lekin Click'ning card_token API'si `Auth: <merchant_user_id>:<sha1(timestamp+secret_key)>:<timestamp>` sarlavhasini talab qiladi — **`CLICK_MERCHANT_USER_ID` kodda ham, `.env.example` da ham yo'q**. Demak Click uchun: yangi env + yangi HTTP klient + yangi auth sxemasi. Katta ish, 2-bosqichga.

**Uzcard** — `uzcard.provider.ts` `https://api.uzcard.uz/payment/create` ga murojaat qiladi. Bu host haqiqiy ochiq UZPS merchant API'siga mos kelmaydi, va `UZCARD_TERMINAL_ID` bo'sh bo'lsa provider soxta URL qaytaradi (satr 39-50: `url: https://uzcard.uz/pay?order=...`). Bu **spekulyativ skelet**. Uzcard/Humo kartalari amalda Payme/Click/Atmos orqali qayta ishlanadi. Kod asosida bu yerda tokenizatsiya rejasini tuzib bo'lmaydi — real protsessing shartnomasi kerak.

**Hozirgi holat:** butun backend'da tokenizatsiya tushunchasi umuman yo'q. `grep -ri "card_token|cardToken|tokenize|recurrent"` → 0 natija. `payment.interface.ts` da faqat `initiate()` va `verify()`.

---

## 1. ENTITY / MIGRATSIYA

### 1.1 Yangi entity: `backend/src/database/entities/saved-card.entity.ts`

```
@Entity('saved_cards')
```

| Maydon (TS) | Ustun (DB) | Tip | Default | Izoh |
|---|---|---|---|---|
| `id` | `id` | `uuid` PK | `gen_random_uuid()` | |
| `userId` | `user_id` | `uuid` NOT NULL | — | `@ManyToOne(() => User)`, `@JoinColumn({name:'user_id'})` |
| `provider` | `provider` | `enum('payme','click','uzcard')` | `'payme'` | `SavedCardProvider` enum |
| `encryptedToken` | `encrypted_token` | `varchar(512)` NOT NULL | — | AES-256-GCM, `iv:tag:ciphertext` hex. **PAN emas** |
| `tokenFingerprint` | `token_fingerprint` | `varchar(64)` NOT NULL | — | `sha256(rawToken)` hex — dublikat aniqlash uchun (shifrlangan matnni unique qilib bo'lmaydi, IV har safar boshqa) |
| `maskedPan` | `masked_pan` | `varchar(24)` NOT NULL | — | `'8600 **** **** 4421'` — provider qaytargani |
| `cardBrand` | `card_brand` | `enum('uzcard','humo','visa','mastercard','unknown')` | `'unknown'` | |
| `expiryMonth` | `expiry_month` | `smallint` NULL | `NULL` | provider bersa |
| `expiryYear` | `expiry_year` | `smallint` NULL | `NULL` | |
| `status` | `status` | `enum('pending_verification','active','removed')` | `'pending_verification'` | |
| `isDefault` | `is_default` | `boolean` NOT NULL | `false` | |
| `verifiedAt` | `verified_at` | `timestamp` NULL | `NULL` | SMS kod tasdiqlangan payt |
| `lastUsedAt` | `last_used_at` | `timestamp` NULL | `NULL` | |
| `removedAt` | `removed_at` | `timestamp` NULL | `NULL` | soft-delete — tugagan to'lovlar auditi uchun qator qoladi |
| `failedChargeCount` | `failed_charge_count` | `int` NOT NULL | `0` | ketma-ket muvaffaqiyatsiz urinishlar; 3 da avtomatik `removed` |
| `createdAt` | `created_at` | `timestamp` | `now()` | `@CreateDateColumn` |
| `updatedAt` | `updated_at` | `timestamp` | `now()` | `@UpdateDateColumn` |

Indekslar (mavjud entity'lardagi uslubda, `@Index(...)` dekoratori + izoh):
- `@Index('idx_saved_cards_user_id_status', ['userId', 'status'])` — "mening faol kartalarim" ro'yxati
- `@Index('idx_saved_cards_user_id_fingerprint', ['userId','provider','tokenFingerprint'], { unique: true })` — bir kartani ikki marta bog'lashni bloklaydi
- Qisman unique indeks (migratsiyada raw SQL, TypeORM dekoratori bilan chiqmaydi):
  `CREATE UNIQUE INDEX idx_saved_cards_one_default ON saved_cards (user_id) WHERE is_default = true AND status = 'active';`

**PAN, CVV, karta egasi ismi — hech qanday maydon yo'q va bo'lmaydi.** Faqat token + niqob.

### 1.2 `transaction.entity.ts` ga qo'shimcha (mavjud fayl o'zgaradi)

```
@Column({ name: 'saved_card_id', type: 'uuid', nullable: true })
savedCardId: string | null;   // default NULL

@ManyToOne(() => SavedCard, { nullable: true, eager: false })
@JoinColumn({ name: 'saved_card_id' })
savedCard: SavedCard | null;
```
Nega: "qaysi karta bilan to'landi" ni tranzaksiya tarixida ko'rsatish uchun; `NULL` = hosted sahifa yoki naqd/hamyon.

### 1.3 Migratsiya: `backend/src/database/migrations/024_saved_cards.ts`

Sinf: `SavedCards1700000000024` (baseline `Baseline1700000000000`, arxivdagilar `...001`–`...023` — bu nomerlash davom etadi).

`up()`: `CREATE TYPE` (3 ta enum) → `CREATE TABLE IF NOT EXISTS saved_cards` → 2 ta `CREATE INDEX IF NOT EXISTS` → qisman unique indeks → `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS saved_card_id UUID NULL` + FK.
`down()`: teskari tartibda `DROP`.

`_archive/023_refresh_tokens.ts` ni shablon sifatida oling — o'sha `IF NOT EXISTS` uslubi ishlatiladi (dev'da `DB_SYNC` yoqilgan, bu migratsiya prod yo'lini hujjatlaydi).

### 1.4 `app.module.ts` — entity ro'yxatiga `SavedCard` qo'shiladi (satr 15-20 atrofidagi import bloki + `entities` massivi).

### 1.5 Env

`backend/src/config/env.validation.ts` (`PAYME_SECRET_KEY` dan keyin, satr ~108):
```ts
@IsString() @IsOptional()
PAYME_SUBSCRIBE_KEY: string = '';

@IsString() @IsOptional()
CARD_TOKEN_ENCRYPTION_KEY: string = '';   // 64 belgi hex = 32 bayt
```
`.env.example` (satr 44-46 blokiga): `PAYME_SUBSCRIBE_KEY=`, `CARD_TOKEN_ENCRYPTION_KEY=`.

---

## 2. BACKEND

### 2.1 `backend/src/modules/payments/card-token-crypto.util.ts` — YANGI

```ts
export function encryptCardToken(raw: string, keyHex: string): string
export function decryptCardToken(stored: string, keyHex: string): string
export function fingerprintCardToken(raw: string): string  // sha256 hex
```
AES-256-GCM, tasodifiy 12-baytli IV, format `iv:tag:ciphertext` (hex). Kalit yo'q bo'lsa — **fail closed**, `throw new Error(...)`, hech qachon ochiq token saqlamaydi. (`payme.provider.ts` dagi `timingSafeCompare` yondashuvi — kichik, mustaqil, testlanadigan util — bilan bir xil uslub.)

### 2.2 `backend/src/modules/payments/payment.interface.ts` — O'ZGARADI

Mavjud `IPaymentProvider` ga **tegilmaydi** (Click/Uzcard uni buzmasligi kerak). Yangi, ixtiyoriy interfeys qo'shiladi:

```ts
export interface CardBindResult {
  token: string;          // xom provider tokeni (darhol shifrlanadi)
  maskedPan: string;
  cardBrand: string;
  expiryMonth: number | null;
  expiryYear: number | null;
  needsVerification: boolean;   // Payme: true (SMS kod kerak)
}

export interface TokenChargeResult {
  success: boolean;
  externalId: string | null;
  failureReason: string | null;   // 'insufficient_funds' | 'card_blocked' | ...
}

export interface ITokenizingPaymentProvider {
  createCardToken(pan: string, expire: string, save: boolean): Promise<CardBindResult>;
  requestVerifyCode(token: string): Promise<{ sentPhone: string }>;
  verifyCardToken(token: string, code: string): Promise<CardBindResult>;
  checkCardToken(token: string): Promise<boolean>;
  removeCardToken(token: string): Promise<void>;
  chargeWithToken(token: string, amount: number, orderId: string): Promise<TokenChargeResult>;
}
```

### 2.3 `backend/src/modules/payments/payme.provider.ts` — O'ZGARADI

`implements IPaymentProvider, ITokenizingPaymentProvider`.

Qo'shiladigan **private** yordamchi:
```ts
private async subscribeCall<T>(method: string, params: object, auth: 'card' | 'receipt'): Promise<T>
```
— `axios.post(this.apiUrl + '/api', { method, params }, { headers: { 'X-Auth': ... } })`, `result` ni qaytaradi, `error` bo'lsa `BadRequestException` ga o'giradi. `auth==='card'` → `X-Auth: merchantId`; `auth==='receipt'` → `X-Auth: merchantId:subscribeKey`.

Qo'shiladigan **public** metodlar (Payme JSON-RPC metodiga moslashtirilgan):

| TS metod | Payme metodi | Izoh |
|---|---|---|
| `createCardToken(pan, expire, save)` | `cards.create` | Javobdagi `card.token` **tasdiqlanmagan**, `card.verify === false` |
| `requestVerifyCode(token)` | `cards.get_verify_code` | Karta egasining telefoniga SMS |
| `verifyCardToken(token, code)` | `cards.verify` | Tasdiqlangan token + `card.number` (niqoblangan) qaytaradi |
| `checkCardToken(token)` | `cards.check` | To'lovdan oldin token hali tirikmi |
| `removeCardToken(token)` | `cards.remove` | |
| `chargeWithToken(token, amount, orderId)` | `receipts.create` → `receipts.pay` | `amount` **tiyinda** (`Math.round(amount * 100)`) — `initiate()` dagi bilan bir xil birlik (satr 51) |

**Konstruktorga:** `this.subscribeKey = configService.get('PAYME_SUBSCRIBE_KEY', '')`.
**Har bir yangi metod boshida fail-closed tekshiruv:** `if (!this.merchantId || !this.subscribeKey) throw new ServiceUnavailableException(...)` — `verifyCallbackSignature` dagi (satr 110-116) va `uzcard.provider.ts:82-89` dagi bir xil naqsh.

⚠️ **`pan` argumenti hech qayerda saqlanmaydi va log qilinmaydi.** `this.logger.log(...)` chaqiruvlarida faqat `maskedPan` va `orderId`.

### 2.4 `backend/src/modules/payments/saved-cards.service.ts` — YANGI (~250 satr)

`payments.service.ts` allaqachon 744 satr — kartalarni u yerga tiqish `<800 satr` qoidasini buzadi. Alohida servis.

```ts
async listCards(userId: string): Promise<SavedCardDto[]>
async startBind(userId: string, dto: BindCardDto): Promise<{ cardId: string; needsVerification: boolean; sentPhone: string }>
async confirmBind(userId: string, cardId: string, dto: ConfirmCardDto): Promise<SavedCardDto>
async setDefault(userId: string, cardId: string): Promise<SavedCardDto>
async removeCard(userId: string, cardId: string): Promise<void>
async findChargeableCard(userId: string, cardId?: string): Promise<SavedCard | null>
async markCharged(cardId: string, success: boolean): Promise<void>
private toDto(card: SavedCard): SavedCardDto   // encryptedToken/tokenFingerprint HECH QACHON chiqmaydi
```

- `startBind`: `paymeProvider.createCardToken()` → `encryptCardToken()` → `status: 'pending_verification'` bilan saqlaydi → `requestVerifyCode()`. **PAN faqat ushbu metod stack'ida yashaydi, DB'ga tushmaydi.**
- `confirmBind`: `verifyCardToken()` → tokenni yangilaydi, `status: 'active'`, `verifiedAt: new Date()`. Agar bu foydalanuvchining birinchi faol kartasi bo'lsa — `isDefault: true`.
- `setDefault`: bitta tranzaksiyada avval `UPDATE saved_cards SET is_default=false WHERE user_id=$1`, keyin yangisini `true` (qisman unique indeks buzilmasligi uchun tartib muhim).
- `removeCard`: `paymeProvider.removeCardToken()` → `status:'removed'`, `removedAt`, `isDefault:false`. **Qator o'chirilmaydi** (`transactions.saved_card_id` FK saqlanadi).

### 2.5 `backend/src/modules/payments/payments.service.ts` — O'ZGARADI

Yangi metod (`initiatePayment` dan keyin, ~satr 155):

```ts
async payWithSavedCard(
  orderId: string,
  userId: string,
  cardId?: string,
): Promise<{ status: 'paid' | 'failed'; transactionId: string; failureReason?: string }>
```

Oqim:
1. `const { amount } = await this.resolvePayableOrder(orderId, userId);` — **mavjud metod qayta ishlatiladi** (satr 74), u allaqachon taxi/market/food uchunlarini hal qiladi va egalikni tekshiradi.
2. `const card = await this.savedCardsService.findChargeableCard(userId, cardId);` yo'q bo'lsa `BadRequestException('Saqlangan karta topilmadi')`.
3. **Idempotentlik:** `findPaymentTransaction(orderId)` (mavjud private metod, satr 176) — agar `COMPLETED` bo'lsa, darhol `{status:'paid'}` qaytaradi, ikkinchi marta yechmaydi.
4. Mavjud `PENDING` DEBIT qatorini **qayta ishlatadi** (yangisini yaratmaydi — 5-bo'limdagi TUZOQ 1 ga qarang). Yo'q bo'lsa yangisini yaratadi.
5. `this.paymeProvider.chargeWithToken(decryptCardToken(card.encryptedToken), amount, orderId)`.
6. Muvaffaqiyat → `transactionRepository.update(..., { status: COMPLETED, externalId, savedCardId: card.id })` → **`await this.settleOrderPayout(orderId)`** (mavjud metod, satr 507 — haydovchi pulini ozod qiladi). `savedCardsService.markCharged(card.id, true)`.
7. Xato → tranzaksiya `PENDING` qoladi (`FAILED` emas! sabab: callback keyinroq kelishi mumkin), `markCharged(card.id, false)`.

`constructor` ga `private readonly savedCardsService: SavedCardsService` qo'shiladi.

### 2.6 `backend/src/modules/payments/dto/` — YANGI fayllar

**`bind-card.dto.ts`**
```ts
export class BindCardDto {
  @ApiProperty({ example: '8600123412341234' })
  @IsString() @Matches(/^\d{16}$/, { message: 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak' })
  cardNumber: string;          // faqat tranzitda; hech qachon saqlanmaydi

  @ApiProperty({ example: '0329', description: 'MMYY' })
  @IsString() @Matches(/^(0[1-9]|1[0-2])\d{2}$/)
  expire: string;

  @ApiPropertyOptional({ enum: ['payme'] })
  @IsOptional() @IsIn(['payme'])
  provider?: 'payme' = 'payme';
}
```
**`confirm-card.dto.ts`** — `@IsString() @Length(4, 6) code: string;`
**`pay-with-card.dto.ts`** — `@IsUUID() orderId: string;` + `@IsOptional() @IsUUID() cardId?: string;`
**`saved-card.dto.ts`** — javob shakli: `{ id, provider, maskedPan, cardBrand, expiryMonth, expiryYear, isDefault, status, createdAt }`. **Token yo'q.**

### 2.7 `backend/src/modules/payments/payments.controller.ts` — O'ZGARADI

`initiatePayment` dan keyin, `payme/callback` dan oldin (5 ta yangi route). Barchasi `@UseGuards(JwtAuthGuard, RolesGuard)` + `@ApiBearerAuth('JWT-auth')`, hammasi `@CurrentUser() user` bilan ishlaydi — URL'da hech qanday `userId` yo'q.

| Metod | Yo'l (to'liq: `/api/v1/...`) | DTO | Throttle |
|---|---|---|---|
| `GET` | `/payments/cards` | — | — |
| `POST` | `/payments/cards` | `BindCardDto` | `@Throttle({ long: { limit: 5, ttl: 60000 } })` |
| `POST` | `/payments/cards/:id/verify` | `ConfirmCardDto` | `@Throttle({ long: { limit: 5, ttl: 60000 } })` |
| `PATCH` | `/payments/cards/:id/default` | — | — |
| `DELETE` | `/payments/cards/:id` | — | — |
| `POST` | `/payments/pay-with-card` | `PayWithCardDto` | `@Throttle({ long: { limit: 10, ttl: 60000 } })` |

`:id` uchun `@Param('id', ParseUUIDPipe)` — `processWithdrawal` (satr 176) dagidek.
Throttle naqshi `auth.controller.ts:41` dan olinadi (SMS kodni brute-force qilishga qarshi — bu OTP bilan bir xil xavf).

### 2.8 `backend/src/modules/payments/payments.module.ts` — O'ZGARADI

`TypeOrmModule.forFeature([...])` ga `SavedCard` qo'shiladi; `providers` ga `SavedCardsService`; `exports` ga `SavedCardsService` (agar orders modulga kerak bo'lsa).

### 2.9 Avtomatik yechish (ixtiyoriy, lekin funksiyaning asosiy qiymati shu)

`backend/src/modules/orders/orders-completion.service.ts` — `completeTrip()` tranzaksiyasi **tugagandan keyin** (`this.dataSource.transaction(...)` bloki tashqarisida, satr ~360 dan keyin, `wentOffline` blokidek):

```ts
// Karta safari uchun saqlangan karta bo'lsa — darhol yechamiz, aks holda
// yo'lovchi safardan keyin webview ochishga majbur bo'ladi.
// DB tranzaksiyasidan TASHQARIDA: tashqi HTTP chaqiruv ochiq tranzaksiyani
// provider javobini kutib turishga majburlamasligi kerak.
if (order.paymentMethod === PaymentMethod.CARD) {
  await this.paymentsService.payWithSavedCard(orderId, order.passengerId).catch(...)
}
```
`orders.module.ts` (satr 23-36) `imports` ga `PaymentsModule` qo'shiladi. **Sikl yo'q:** `payments.module.ts` `OrdersModule` ni import qilmaydi, faqat `TypeOrmModule.forFeature([Order, ...])` va `DriversModule` ni.

---

## 3. MOBIL

### 3.1 `mobile/lib/shared/models/saved_card.dart` — YANGI

`PaymentInitiateResult` bilan bir xil uslub (Equatable + `fromJson`):
```dart
class SavedCard extends Equatable {
  final String id;
  final String provider;
  final String maskedPan;
  final String cardBrand;   // 'uzcard' | 'humo' | 'visa' | ...
  final int? expiryMonth;
  final int? expiryYear;
  final bool isDefault;
  final String status;

  /// Ro'yxatda ko'rsatiladigan qisqa shakl: '•••• 4421'
  String get last4Label => ...
}
```

### 3.2 `mobile/lib/core/payments/saved_cards_service.dart` — YANGI

`payment_service.dart` bilan bir xil naqsh (`ApiClient` inyeksiyasi, `extractErrorMessage`, `PaymentException`):
```dart
Future<List<SavedCard>> list();
Future<({String cardId, bool needsVerification, String sentPhone})> bind({required String cardNumber, required String expire});
Future<SavedCard> verify({required String cardId, required String code});
Future<SavedCard> setDefault(String cardId);
Future<void> remove(String cardId);
Future<bool> payWithSavedCard({required String orderId, String? cardId});
```

### 3.3 `mobile/lib/core/network/api_endpoints.dart` — O'ZGARADI

`paymentsInitiate` (satr 95) yonига:
```dart
static const String savedCards = '/payments/cards';
static String savedCardById(String id) => '/payments/cards/$id';
static String verifySavedCard(String id) => '/payments/cards/$id/verify';
static String setDefaultCard(String id) => '/payments/cards/$id/default';
static const String payWithSavedCard = '/payments/pay-with-card';
```
⚠️ **`paymentMethods = '/users/payment-methods'` (satr 17) — o'lik konstanta.** `backend/src/modules/users/users.controller.ts` da bunday route yo'q. Yo o'chiring, yo `savedCards` ga yo'naltiring.

### 3.4 `mobile/lib/features/payments/state/cards_provider.dart` — YANGI

`ChangeNotifier`, `superapp_provider.dart` naqshida (`_loading`/`_error`/`notifyListeners`):
```dart
List<SavedCard> get cards;
SavedCard? get defaultCard;
bool get isLoading;  String? get error;
Future<void> loadCards();
Future<String?> startBind({required String cardNumber, required String expire});  // cardId
Future<bool> confirmBind({required String cardId, required String code});
Future<void> setDefault(String cardId);
Future<void> remove(String cardId);
```
`mobile/lib/app.dart` dagi `MultiProvider` ga ro'yxatdan o'tkaziladi; `service_locator.dart` ga `SavedCardsService` qo'shiladi.

### 3.5 `mobile/lib/features/payments/screens/cards_screen.dart` — YANGI

Kartalar ro'yxati. Har bir qator — **`AppPressable`** (`shared/widgets/app_pressable.dart`), `semanticsLabel: 'Karta ${card.last4Label}'`. Ranglar faqat `k*` tokenlar: `kSurface` fon, `kRadiusLg` radius, `kInk`/`kInkMuted` matn, tanlangan/asosiy karta uchun `kMintTint` badge + `kPrimary` matn. Padding `kSpace4`, elementlar orasi `kSpace3`. Har bir qator balandligi ≥ `kMinTapTarget`.
- Bo'sh holat: `shared/widgets/app_empty_state.dart` dagi `AppEmptyState`.
- Yuklanish: `AppSkeletonList` (`shared/widgets/app_skeleton.dart`).
- Xato: `InlineErrorWidget` (`shared/widgets/error_widget.dart`).
- O'chirish: `Dismissible` emas — `AppPressable` + tasdiq dialogi (tasodifiy o'chirish moliyaviy harakatda qabul qilinmaydi).

### 3.6 `mobile/lib/features/payments/screens/add_card_screen.dart` — YANGI

Ikki bosqichli forma:
1. Karta raqami (`TextInputFormatter` bilan 4-4-4-4 guruhlash, `TextInputType.number`) + amal qilish muddati (MM/YY). Tugma — `FilledButton`, `kPrimary`/`kOnPrimary`, `minimumSize: Size(0, kControlHeight)`, `kRadiusMd`.
2. SMS kod maydoni + qayta yuborish taymeri. `sentPhone` niqoblangan holda ko'rsatiladi.

⚠️ **Karta raqami hech qachon `SharedPreferences`/`LocalStorage` ga yozilmaydi, faqat `TextEditingController` da yashaydi va ekran `dispose` bo'lganda o'chadi.** `autofillHints: [AutofillHints.creditCardNumber]`, `obscureText: false`, lekin skrinshot/klaviatura keshiga tushmasligi uchun `enableSuggestions: false, autocorrect: false`.

### 3.7 `mobile/lib/features/payments/widgets/card_picker_sheet.dart` — YANGI

`showModalBottomSheet` ichida `RadioListTile<String>` ro'yxati (naqd / hamyon / har bir saqlangan karta / "+ Yangi karta"). `checkout_screen.dart:276-315` dagi `_choosePaymentMethod()` bilan bir xil ko'rinish (`kRadiusXl` yuqori burchaklar).

### 3.8 `mobile/lib/features/superapp/screens/wallet_screen.dart` — O'ZGARADI

Satr 69-75: `'Kartalar'` sarlavhasi ostidagi `_CardsUnavailableNotice` (satr 239-290) o'rniga — haqiqiy ro'yxat + "Karta qo'shish" tugmasi. **Bu widget o'chiriladi**, chunki uning izohi aynan shuni aytadi: *"Saved cards need a Payme/Click merchant agreement before a card can be bound"*.

### 3.9 `mobile/lib/features/passenger/screens/tariff_select_screen.dart` — O'ZGARADI

- Satr 45: `String _paymentMethod = 'cash'` → `PaymentChoice` (enum + ixtiyoriy `cardId`) ga o'tadi.
- `_buildPaymentRow()` (satr 534-552): `_PaymentChip` "Karta" bosilganda endi `card_picker_sheet.dart` ochiladi; tanlangan bo'lsa chip yorlig'i `'•••• 4421'` bo'ladi.
- Satr 154-175 dagi blok: `_paymentService.initiate()` + `_openPaymentCheckout()` **butunlay olib tashlanadi**. Buyurtma yaratishda hech narsa to'lanmaydi — safar tugagach backend avtomatik yechadi (2.9). Satr 141-153 dagi uzun izoh ham eskiradi.

### 3.10 `mobile/lib/features/superapp/screens/checkout_screen.dart` — O'ZGARADI

Satr 270-295: `_paymentMethod == card` bo'lganda `_paymentService.initiate()` + webview o'rniga `savedCardsService.payWithSavedCard(orderId, cardId)`. Saqlangan karta yo'q bo'lsa — `add_card_screen.dart` ga yo'naltiradi, keyin qayta urinadi. Fallback sifatida eski webview yo'li **saqlanadi** (TUZOQ 5).

### 3.11 `payment_webview_screen.dart` — O'CHIRILMAYDI

Fallback bo'lib qoladi: Payme merchant kaliti sozlanmagan bo'lsa, yoki foydalanuvchi kartani bog'lamoqchi bo'lmasa. Faqat sinf hujjatiga izoh qo'shiladi: endi bu asosiy yo'l emas, zaxira yo'l.

---

## 4. TESTLAR

### Backend (Jest, `*.spec.ts`)

| Fayl | Holat | Nimani qamraydi |
|---|---|---|
| `payments/card-token-crypto.util.spec.ts` | YANGI | round-trip shifrlash; kalit yo'qligida `throw`; bir xil token → bir xil fingerprint, lekin har xil ciphertext (IV tasodifiy) |
| `payments/payme.provider.cards.spec.ts` | YANGI | `jest.mock('axios')` (`uzcard.provider.spec.ts:6-7` naqshi). Sozlanmagan holatda fail-closed; `cards.create` → `X-Auth: merchantId`; `receipts.pay` → `X-Auth: merchantId:subscribeKey`; summa **tiyinda** yuborilishi; PAN log'ga tushmasligi (`logger.log` spy bilan) |
| `payments/saved-cards.service.spec.ts` | YANGI | `startBind` DB'ga faqat **shifrlangan** token yozishi; `confirmBind` `status: active` qilishi; birinchi karta `isDefault: true`; `setDefault` eskisini avval `false` qilishi; `removeCard` soft-delete (`delete()` chaqirilmasligi); `toDto()` javobida `encryptedToken` YO'Qligi |
| `payments/payments.service.token-charge.spec.ts` | YANGI | `payWithSavedCard` mavjud `PENDING` DEBIT ni qayta ishlatishi (yangi qator YARATMASLIGI); `COMPLETED` bo'lsa ikkinchi urinishning no-op bo'lishi; muvaffaqiyatda `settleOrderPayout` chaqirilishi; xatoda tranzaksiya `PENDING` qolishi; boshqa foydalanuvchining `cardId` si bilan `BadRequestException` |
| `payments/payments.controller.cards.spec.ts` | YANGI | `payments.controller.withdrawals.spec.ts` naqshi: har bir route `@CurrentUser()` dan foydalanishi (URL'da `userId` yo'qligi), `@Throttle` metadata mavjudligi |
| `payments/payments.service.callbacks.spec.ts` | O'ZGARADI | Yangi keys: token bilan to'langan buyurtmaga Payme `PerformTransaction` callback'i kelsa — replay sifatida e'tiborsiz qoldirilishi (**TUZOQ 2**) |
| `orders/orders.service.completion-distance.spec.ts` yoki yangi `orders.service.card-autocharge.spec.ts` | YANGI | `completeTrip` CARD safarida `payWithSavedCard` ni chaqirishi; provider xatosi safar yakunlanishini bekor QILMASLIGI |

⚠️ Yangi `SavedCard` repository provideri **mavjud 8 ta payments spec faylining har biriga** `{ provide: getRepositoryToken(SavedCard), useValue: {} }` sifatida qo'shilishi kerak, aks holda `Test.createTestingModule` DI xatosi bilan yiqiladi.

### Mobil (`flutter test`)

| Fayl | Holat |
|---|---|
| `test/unit/saved_card_test.dart` | YANGI — `fromJson`, `last4Label`, `Equatable` |
| `test/unit/cards_provider_test.dart` | YANGI — mocktail bilan `MockApiClient`; bind → verify oqimi; xato `error` ga tushishi |
| `test/widget/add_card_test.dart` | YANGI — 4-4-4-4 formatlash; noto'g'ri raqamda tugma o'chiq; kod bosqichiga o'tish |
| `test/widget/cards_screen_test.dart` | YANGI — bo'sh holat; asosiy karta badge'i; o'chirish tasdiq dialogi |
| `test/widget/checkout_payment_test.dart` | O'ZGARADI — token bilan to'lash yo'li qo'shiladi, webview fallback testi qoladi |
| `test/widget/tariff_surge_badge_test.dart` | O'ZGARADI — satr 108 `paymentService:` inyeksiyasi o'zgargan konstruktoriga moslashtiriladi |

---

## 5. TUZOQLAR

**1. Bitta buyurtmaga IKKITA DEBIT qatori (mavjud xato).**
`orders-completion.service.ts:285-293` CARD safar uchun `PENDING` DEBIT yozadi. Keyin `payments.service.ts:141-150` (`initiatePayment`) **yana bitta** DEBIT yozadi. Hozir bu balansni buzmaydi (ikkinchisi hech qachon `COMPLETED` bo'lmaydi), lekin `payWithSavedCard` ham uchinchisini yaratsa va ikkitasi `COMPLETED` bo'lsa — yo'lovchidan **ikki marta** yechilgan ko'rinadi. `payWithSavedCard` **majburan mavjud PENDING qatorni qayta ishlatishi** shart, yangisini yaratmasligi.

**2. Token bilan to'langandan keyin ham Payme callback KELADI.**
`receipts.pay` sinxron muvaffaqiyat qaytaradi, lekin Payme baribir `PerformTransaction` callback'ini yuboradi. `handlePaymeCallback` (satr 199) `findPaymentTransaction(orderId)` orqali qatorni topadi — u allaqachon `COMPLETED`, shuning uchun satr 245-252 dagi replay-guard uni e'tiborsiz qoldiradi. **Bu ishlaydi, lekin faqat `payWithSavedCard` ayni o'sha qatorni yangilagan bo'lsa** (1-tuzoq bilan bog'liq). Test bilan mahkamlang.

**3. `settleOrderPayout` ni unutish = haydovchi puli muzlab qoladi.**
`orders-completion.service.ts:335-350` CARD safar uchun haydovchi oyoqlarini `PENDING` qoldiradi va `balanceDelta = 0` beradi. Ular faqat `settleOrderPayout()` (payments.service.ts:507) orqali ozod bo'ladi. `payWithSavedCard` muvaffaqiyatida uni chaqirmasangiz — **haydovchi pulini olmaydi**, hech qanday xato ham chiqmaydi.

**4. Shifrlangan token unique indeksga yaramaydi.**
AES-GCM har safar boshqa IV bilan boshqa ciphertext beradi — `encrypted_token` ustunidagi unique indeks dublikatlarni ushlamaydi. Shuning uchun alohida `token_fingerprint` (sha256) ustuni bor. Uni qo'shishni unutmang.

**5. Payme Subscribe API'siz butun funksiya ishlamaydi.**
`PAYME_SUBSCRIBE_KEY` `.env` da ham, `env.validation.ts` da ham yo'q va bu kalitni Payme merchant kabineti bermaguncha **hech qanday kod uni yarata olmaydi**. Shuning uchun `payment_webview_screen.dart` o'chirilmaydi va mobil UI "karta bog'lash mavjud emas" holatini nafis ko'rsata olishi kerak (backend `503` qaytarganda). Bugungi `_CardsUnavailableNotice` (wallet_screen.dart:239) aynan shu sababdan yozilgan.

**6. Merchant ID `initiate()` da URL ichida ochiq ketadi.**
`payme.provider.ts:53-62` `params` ni base64 qiladi — bu shifrlash emas. Yangi Subscribe chaqiruvlarida `X-Auth` sarlavhasi log'ga tushmasligini alohida tekshiring (`axios` interceptor'lari yo'q, lekin `this.logger.error(err.message)` axios xatosining `config.headers` ini o'z ichiga olishi mumkin).

**7. `uzcard.provider.ts` dev-mock'i (satr 39-50) soxta `url` qaytaradi.**
Agar `payWithSavedCard` ni provider-agnostik qilib yozsangiz va `uzcard` ni `ITokenizingPaymentProvider` ga qo'shsangiz, bu mock jimgina "to'lov muvaffaqiyatli" degan taassurot beradi. **Uzcard'ni tokenizatsiya yo'liga umuman kiritmang.**

**8. `spec` fayllarining DI ro'yxati.**
Yuqorida aytilgani: 8 ta mavjud payments spec fayli `Test.createTestingModule` da barcha repository token'larini qo'lda beradi. `SavedCard` ni entity'ga qo'shsangiz-u, spec'larga qo'shmasangiz — hammasi yiqiladi.

**9. `orders.module.ts` → `payments.module.ts` bog'liqligi.**
Hozir sikl yo'q (`payments.module.ts` faqat `DriversModule` ni import qiladi). Ammo kimdir kelajakda `PaymentsModule` ga `OrdersModule` ni qo'shsa — sikl paydo bo'ladi. `orders.module.ts` ga import qo'shayotganda izohda buni yozib qo'ying.

**10. Mobilda o'lik endpoint.**
`api_endpoints.dart:17` `paymentMethods = '/users/payment-methods'` — backend'da bunday route **yo'q** (`users.controller.ts` tekshirildi). Chalkashmaslik uchun o'chiring.

---

## 6. BAHO (kun)

| Bosqich | Kun |
|---|---|
| **0.** Payme Subscribe shartnomasi/hujjati bilan API formatlarini tasdiqlash, sandbox kaliti olish | **1** (bloklovchi, kod emas) |
| **1.** Entity + migratsiya + `card-token-crypto.util.ts` + env + spec | **1.5** |
| **2.** `payme.provider.ts` tokenizatsiya metodlari + `payment.interface.ts` + spec | **2** |
| **3.** `saved-cards.service.ts` + DTO'lar + controller route'lari + 3 spec fayli | **2.5** |
| **4.** `payWithSavedCard` + `settleOrderPayout` integratsiyasi + `orders-completion` avto-yechish + spec | **2** |
| **5.** Mobil: model + service + provider + `api_endpoints` + DI | **1** |
| **6.** Mobil ekranlar: `cards_screen`, `add_card_screen`, `card_picker_sheet` + `wallet_screen` almashtirish | **2.5** |
| **7.** Mobil: `tariff_select_screen` va `checkout_screen` ni yangi oqimga o'tkazish | **1** |
| **8.** Mobil testlar (4 yangi + 2 yangilanadigan) | **1** |
| **9.** Sandbox'da uchdan-uchgacha sinov, xato holatlari (yetarli mablag' yo'q, bloklangan karta, muddati o'tgan) | **1.5** |
| **Payme (1-bosqich) JAMI** | **≈ 16 kun** (bloklovchi 0-bosqichsiz ≈ 15) |
| **Click (2-bosqich):** yangi env, provider'ga axios klienti, `Auth: user_id:sha1:ts` sxemasi, `card_token/*` metodlari, spec'lar | **+3–4 kun** |
| **Uzcard** | Real protsessing shartnomasigacha rejalashtirilmaydi |

**Kritik yo'l:** 0 → 2 → 4. 5–8 (mobil) 3-bosqichdan keyin parallel ketishi mumkin, chunki API shartnomasi 2.6/2.7 da qotib qoladi.
