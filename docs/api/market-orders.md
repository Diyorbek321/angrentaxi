# Market Orders API

Market buyurtmalari: savat, checkout, holat kuzatuvi.

## Ma'lumot modeli

```ts
MarketOrder {
  id: string
  orderNumber: string           // "M-2026-000456"
  passengerId: string
  sellerId: string
  sellerName: string            // snapshot
  status: MarketOrderStatus
  items: MarketOrderItem[]
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  paymentMethod: "cash" | "card" | "wallet"
  paymentStatus: "pending" | "paid" | "refunded"
  paymentTransactionId: string | null
  deliveryType: "delivery" | "pickup"
  address: DeliveryAddress | null   // pickup bo'lsa null
  contactPhone: string
  passengerNote: string | null
  courierId: string | null
  estimatedDeliveryAt: string | null
  placedAt: string
  acceptedAt: string | null
  packedAt: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
}

MarketOrderItem {
  productId: string
  name: string                  // snapshot
  price: number                 // snapshot
  quantity: number
  itemTotal: number
  attributes: { key: string; value: string }[]   // snapshot
}

MarketOrderStatus =
  | "pending"       // sotuvchi tasdiqlashini kutmoqda
  | "accepted"      // sotuvchi qabul qildi
  | "packing"       // yig'moqda
  | "ready"         // tayyor (delivery yoki pickup uchun)
  | "picked_up"     // kuryer olib ketdi (yoki mijoz olib ketdi = delivered)
  | "delivered"
  | "cancelled"
  | "rejected"
```

---

## POST `/market-orders/estimate`

Savat + manzil asosida narxni hisoblash.

**Auth:** passenger  
**Request:**
```json
{
  "sellerId": "...",
  "items": [
    { "productId": "...", "quantity": 2 }
  ],
  "deliveryType": "delivery",
  "deliveryAddress": { "latitude": 41.0166, "longitude": 70.1439 }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "subtotal": 25000000,
    "deliveryFee": 15000,
    "discount": 0,
    "total": 25015000,
    "estimatedDeliveryMinutes": 60,
    "isSellerAvailable": true,
    "minOrderAmount": 50000,
    "canPlace": true,
    "unavailableItems": []
  }
}
```

**Errors:** `PRODUCT_OUT_OF_STOCK`, `VALIDATION_ERROR`

---

## POST `/market-orders`

Yangi buyurtma yaratish.

**Auth:** passenger  
**Request:**
```json
{
  "sellerId": "...",
  "items": [ { "productId": "...", "quantity": 2 } ],
  "deliveryType": "delivery",
  "address": {
    "line": "Angren, Amir Temur 45",
    "latitude": 41.0166,
    "longitude": 70.1439,
    "landmark": "Metro yonida",
    "entrance": "2-podyezd"
  },
  "contactPhone": "+998901234567",
  "paymentMethod": "card",
  "cardId": "...",
  "promoCode": null,
  "passengerNote": null
}
```

**Response 201:** `{ "success": true, "data": MarketOrder }`  
**Errors:** `PRODUCT_OUT_OF_STOCK`, `INSUFFICIENT_BALANCE`, `VALIDATION_ERROR`

---

## GET `/market-orders`

Passenger o'z buyurtmalari.

**Auth:** passenger  
**Query:** `page`, `limit`, `status`  
**Response 200:** `MarketOrder[]`

---

## GET `/market-orders/:id`

Buyurtma tafsiloti.

**Auth:** passenger | vendor | admin | courier  
**Response 200:** `MarketOrder`

---

## POST `/market-orders/:id/cancel`

**Auth:** passenger  
**Request:** `{ "reason": "..." }`  
**Response 200:** yangilangan buyurtma  
**Errors:** `CONFLICT` — status `packing`dan keyin bo'lsa

---

## Vendor endpointlari

### GET `/vendor/market-orders`

**Auth:** vendor  
**Query:** `sellerId`, `status`, `page`, `limit`, `dateFrom`, `dateTo`  
**Response 200:** `MarketOrder[]`

### GET `/vendor/market-orders/queue`

Live queue (dashboard uchun).

**Auth:** vendor  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "pending": [ MarketOrder, ... ],
    "packing": [ MarketOrder, ... ],
    "ready": [ MarketOrder, ... ]
  }
}
```

### PATCH `/vendor/market-orders/:id/accept`

**Auth:** vendor  
**Request:** `{ "estimatedPackMinutes": 30 }`  
**Response 200:** status → `accepted`

### PATCH `/vendor/market-orders/:id/reject`

**Auth:** vendor  
**Request:** `{ "reason": "..." }`  
**Response 200:** status → `rejected`, auto refund

### PATCH `/vendor/market-orders/:id/packed`

**Auth:** vendor  
**Response 200:** status → `ready`

---

## Kuryer endpointlari

### GET `/courier/market-orders/available`

**Auth:** driver (courier)  
**Response 200:** `MarketOrder[]`

### PATCH `/courier/market-orders/:id/accept`

**Auth:** driver  
**Response 200:** courier assigned

### PATCH `/courier/market-orders/:id/picked-up`

**Auth:** driver  
**Response 200:** status → `picked_up`

### PATCH `/courier/market-orders/:id/delivered`

**Auth:** driver  
**Request:** `{ "signature": "base64...", "photoUrl": "..." }` (optional)  
**Response 200:** status → `delivered`
