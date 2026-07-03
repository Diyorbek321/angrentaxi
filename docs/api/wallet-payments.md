# Wallet & Payments API

Wallet, kartalar, tranzaksiyalar. Taxi'da mavjud `/payments/*` endpointlarini kengaytiradi.

## Ma'lumot modeli

```ts
Wallet {
  id: string
  userId: string
  balance: number               // so'm
  currency: "UZS"
  isBlocked: boolean
  updatedAt: string
}

Card {
  id: string
  userId: string
  provider: "payme" | "click" | "uzcard" | "humo"
  maskedNumber: string          // "8600 **** **** 1234"
  holderName: string | null
  expiryMonth: number           // 1-12
  expiryYear: number            // 2028
  isDefault: boolean
  isVerified: boolean
  createdAt: string
}

Transaction {
  id: string
  userId: string
  type: TransactionType
  direction: "in" | "out"
  amount: number
  balanceAfter: number
  status: "pending" | "success" | "failed" | "reversed"
  provider: string | null       // "payme", "click", ...
  providerTransactionId: string | null
  relatedOrderId: string | null
  relatedOrderType: "taxi" | "food" | "market" | null
  description: string
  createdAt: string
  completedAt: string | null
}

TransactionType =
  | "wallet_topup"
  | "order_payment"
  | "refund"
  | "driver_payout"
  | "vendor_payout"
  | "promo_bonus"
  | "cashback"
  | "adjustment"
```

---

## Wallet

### GET `/wallet`

Foydalanuvchi wallet holati.

**Auth:** any authenticated  
**Response 200:** `Wallet`

### POST `/wallet/topup`

Wallet'ga pul qo'shish (karta orqali).

**Auth:** any  
**Request:**
```json
{
  "amount": 100000,
  "cardId": "..."
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "transaction": Transaction,
    "providerRedirectUrl": "https://checkout.payme.uz/..." | null
  }
}
```

**Errors:** `VALIDATION_ERROR`, `CARD_NOT_VERIFIED`

---

## Cards

### GET `/cards`

Foydalanuvchi kartalari ro'yxati.

**Auth:** any  
**Response 200:** `Card[]`

### POST `/cards`

Yangi karta qo'shish (verifikatsiya jarayonini boshlash).

**Auth:** any  
**Request:**
```json
{
  "provider": "payme",
  "cardNumber": "8600123412341234",
  "expiryMonth": 12,
  "expiryYear": 2028,
  "holderName": "DIYORBEK T"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "card": Card,
    "verificationRequired": true,
    "verificationSession": {
      "sessionId": "...",
      "sentTo": "+998 90 ***12 34"
    }
  }
}
```

### POST `/cards/:id/verify`

SMS orqali kelgan kod bilan tasdiqlash.

**Auth:** any  
**Request:** `{ "code": "12345" }`  
**Response 200:** `{ "card": Card }` (isVerified=true)

### PATCH `/cards/:id/default`

Default kartani almashtirish.

**Auth:** any  
**Response 200:** `Card`

### DELETE `/cards/:id`

**Auth:** any  
**Response 204**

---

## Transactions

### GET `/transactions`

Tranzaksiya tarixi.

**Auth:** any  
**Query:**

| Param | Ta'rif |
|-------|--------|
| `type` | filter (masalan `wallet_topup`) |
| `direction` | `in` \| `out` |
| `dateFrom`, `dateTo` | ISO date |
| `page`, `limit` | pagination |

**Response 200:** `Transaction[]` + meta

### GET `/transactions/:id`

**Auth:** any (o'ziniki)  
**Response 200:** `Transaction`

---

## Order to'lovi (universal)

### POST `/payments/orders/:orderId/pay`

Har qanday order (taxi, food, market) uchun to'lov initsiatsiyasi.

**Auth:** passenger  
**Request:**
```json
{
  "orderType": "food",
  "paymentMethod": "wallet"
}
```

Yoki karta:
```json
{
  "orderType": "market",
  "paymentMethod": "card",
  "cardId": "..."
}
```

Yoki naqd:
```json
{
  "orderType": "taxi",
  "paymentMethod": "cash"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "paymentStatus": "paid" | "pending",
    "transaction": Transaction | null,
    "providerRedirectUrl": string | null
  }
}
```

**Errors:** `INSUFFICIENT_BALANCE`, `CARD_NOT_VERIFIED`, `RESOURCE_NOT_FOUND`, `CONFLICT`

---

## Vendor payout

### GET `/vendor/wallet`

Vendor daromadi va tranzaksiyalar.

**Auth:** vendor  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "balance": 4500000,
    "pending": 250000,
    "totalEarnings": 18700000,
    "commissionRate": 0.15,
    "lastPayoutAt": "2026-06-30T10:00:00Z"
  }
}
```

### POST `/vendor/wallet/payout-request`

Vendor pul yechish so'rovi.

**Auth:** vendor  
**Request:**
```json
{
  "amount": 4000000,
  "bankAccount": "22618000901234567890",
  "recipientName": "DIYORBEK T"
}
```

**Response 201:**
```json
{ "success": true, "data": { "transaction": Transaction, "expectedBy": "2026-07-05" } }
```

---

## Callback endpointlari (provider webhooks)

Bular allaqachon backend'da mavjud (`/payments/payme/callback`, `/payments/click/callback`, `/payments/uzcard/callback`) — kengaytirish talab qilmaydi, faqat `orderType` (`taxi`/`food`/`market`) qo'shiladi.

---

## Frontend uchun eslatma

- Kartalar qo'shilganda karta raqami hech qachon frontend'da saqlanmaydi — faqat `maskedNumber` ishlatiladi
- Wallet balansi har order'dan keyin backend tomonidan qaytariladi, cache'lamang
- 3D-Secure kerak bo'lsa `providerRedirectUrl` browser/webview'da ochiladi, keyin callback → order status yangilanadi
