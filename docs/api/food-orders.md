# Food Orders API

Ovqat buyurtmalari: joylashtirish, tekshirish, holatini kuzatish.

## Ma'lumot modeli

```ts
FoodOrder {
  id: string
  orderNumber: string           // "F-2026-000123"
  passengerId: string
  restaurantId: string
  restaurantName: string        // snapshot (agar keyin o'zgarsa ham)
  status: FoodOrderStatus
  items: FoodOrderItem[]
  subtotal: number              // taomlar summasi
  deliveryFee: number
  discount: number              // promo/aksiya
  total: number                 // subtotal + deliveryFee - discount
  paymentMethod: "cash" | "card" | "wallet"
  paymentStatus: "pending" | "paid" | "refunded"
  paymentTransactionId: string | null
  address: {
    line: string
    latitude: number
    longitude: number
    landmark: string | null
    entrance: string | null       // "2-podyezd, 4-qavat, 15-xonadon"
  }
  contactPhone: string
  passengerNote: string | null
  courierId: string | null      // agar taxi driver kuryer bo'lsa
  estimatedReadyAt: string | null   // restoran tomonidan ko'rsatilgan
  estimatedDeliveryAt: string | null
  placedAt: string
  acceptedAt: string | null
  preparedAt: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
}

FoodOrderItem {
  dishId: string
  name: string                  // snapshot
  price: number                 // snapshot
  quantity: number
  options: { name: string; price: number }[]
  itemTotal: number             // (price + options) * quantity
  note: string | null           // "Piyoz solmang"
}

FoodOrderStatus =
  | "pending"          // restoran tasdiqlashini kutmoqda
  | "accepted"         // restoran qabul qildi, tayyorlanmoqda
  | "preparing"
  | "ready"            // tayyor, kuryer kutilmoqda
  | "picked_up"        // kuryer olib ketdi
  | "delivered"        // yetkazildi
  | "cancelled"
  | "rejected"         // restoran rad etdi
```

---

## POST `/food-orders/estimate`

Buyurtma yakunidan oldin narxni hisoblash (savatchada ko'rsatish uchun).

**Auth:** passenger  
**Request:**
```json
{
  "restaurantId": "...",
  "items": [
    {
      "dishId": "...",
      "quantity": 2,
      "optionIds": ["opt-1", "opt-2"]
    }
  ],
  "deliveryAddress": {
    "latitude": 41.0166,
    "longitude": 70.1439
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "subtotal": 110000,
    "deliveryFee": 10000,
    "discount": 0,
    "total": 120000,
    "estimatedDeliveryMinutes": 40,
    "isRestaurantOpen": true,
    "minOrderAmount": 30000,
    "canPlace": true
  }
}
```

**Errors:** `RESTAURANT_CLOSED`, `PRODUCT_OUT_OF_STOCK`, `VALIDATION_ERROR`

---

## POST `/food-orders`

Yangi buyurtma yaratish.

**Auth:** passenger  
**Request:**
```json
{
  "restaurantId": "...",
  "items": [
    {
      "dishId": "...",
      "quantity": 2,
      "optionIds": ["opt-1"],
      "note": "Piyoz solmang"
    }
  ],
  "address": {
    "line": "Angren, Amir Temur 45",
    "latitude": 41.0166,
    "longitude": 70.1439,
    "landmark": "Metro yonida",
    "entrance": "2-podyezd, 4-qavat, 15"
  },
  "contactPhone": "+998901234567",
  "paymentMethod": "card",
  "cardId": "...",              // agar paymentMethod=card
  "promoCode": "WELCOME10",     // optional
  "passengerNote": "Ilijmoqcha, tez yetkazing"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": FoodOrder
}
```

**Errors:** `RESTAURANT_CLOSED`, `PRODUCT_OUT_OF_STOCK`, `INSUFFICIENT_BALANCE`, `VALIDATION_ERROR`

---

## GET `/food-orders`

Passenger o'z buyurtmalari ro'yxati.

**Auth:** passenger  
**Query:** `page`, `limit`, `status`  
**Response 200:** `FoodOrder[]` + `meta`

---

## GET `/food-orders/:id`

Buyurtma tafsiloti (status kuzatish sahifasi).

**Auth:** passenger (o'ziniki) | vendor (o'z restoraniniki) | admin | courier  
**Response 200:** `{ "success": true, "data": FoodOrder }`

---

## POST `/food-orders/:id/cancel`

Passenger buyurtmani bekor qiladi (faqat `pending` yoki `accepted` holatida).

**Auth:** passenger  
**Request:**
```json
{ "reason": "Fikrimni o'zgartirdim" }
```

**Response 200:** yangilangan `FoodOrder`  
**Errors:** `CONFLICT` — agar status allaqachon `preparing` yoki keyin bo'lsa

---

## Vendor endpointlari

### GET `/vendor/food-orders`

Restoranga tegishli barcha buyurtmalar (aktual + tarix).

**Auth:** vendor  
**Query:** `status`, `page`, `limit`, `dateFrom`, `dateTo`  
**Response 200:** `FoodOrder[]`

### GET `/vendor/food-orders/queue`

**Live queue** — restoran ish paytida, aktual buyurtmalar (dashboard uchun).

**Auth:** vendor  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "pending": [ FoodOrder, ... ],
    "preparing": [ FoodOrder, ... ],
    "ready": [ FoodOrder, ... ]
  }
}
```

### PATCH `/vendor/food-orders/:id/accept`

**Auth:** vendor  
**Request:**
```json
{ "estimatedReadyMinutes": 25 }
```

**Response 200:** yangilangan buyurtma (status → `accepted`)

### PATCH `/vendor/food-orders/:id/reject`

**Auth:** vendor  
**Request:** `{ "reason": "Ingredient tugadi" }`  
**Response 200:** status → `rejected`, avtomatik refund (agar to'langan bo'lsa)

### PATCH `/vendor/food-orders/:id/ready`

Restoran taomni tayyor deb belgilaydi → matching system kuryer topadi.

**Auth:** vendor  
**Response 200:** status → `ready`

---

## Kuryer (driver) endpointlari

### GET `/courier/food-orders/available`

Kuryerga tegishli hozir mavjud buyurtmalar (yaqin restoranlardan).

**Auth:** driver (courier-mode)  
**Response 200:** `FoodOrder[]`

### PATCH `/courier/food-orders/:id/accept`

Kuryer buyurtmani qabul qiladi.

**Auth:** driver  
**Response 200:** status → biriktirildi (`courierId` set)

### PATCH `/courier/food-orders/:id/picked-up`

Kuryer restorandan taomni oldi.

**Auth:** driver (assigned)  
**Response 200:** status → `picked_up`

### PATCH `/courier/food-orders/:id/delivered`

**Auth:** driver (assigned)  
**Request:** `{ "signature": "base64...", "photoUrl": "..." }` (ikkalasi optional)  
**Response 200:** status → `delivered`, to'lov confirm qilinadi
