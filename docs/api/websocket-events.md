# WebSocket Events

Realtime aloqa: order holati, kuryer joylashuvi, kelayotgan buyurtmalar.

## Ulanish

**URL:** `wss://angrentaxi-production.up.railway.app/ws`  
**Auth:** ulanish payti `?token=<access_token>` query yoki `auth.token` (Socket.IO handshake)  
**Protokol:** Socket.IO

## Kanallar (rooms)

Server foydalanuvchini avtomatik quyidagi room'larga qo'shadi:

- `user:{userId}` — shaxsiy eventlar (barcha)
- `driver:{driverId}` — driver'ga specific
- `vendor:{vendorId}` — vendor'ga specific
- `order:{orderId}` — buyurtmaga obuna bo'lgan taraflar

Client `subscribe` event orqali qo'shimcha obuna bo'lishi mumkin:

```json
{ "event": "subscribe", "room": "order:abc-123" }
```

---

## Server → Client eventlari

### Order lifecycle (barcha turdagi buyurtmalar)

#### `order:created`
Yangi buyurtma yaratildi (order room).
```json
{
  "orderId": "...",
  "orderType": "food",
  "status": "pending"
}
```

#### `order:status_changed`
Har qanday status o'zgarishi.
```json
{
  "orderId": "...",
  "orderType": "taxi" | "food" | "market",
  "oldStatus": "pending",
  "newStatus": "accepted",
  "at": "2026-07-03T14:22:00Z",
  "meta": { "estimatedReadyMinutes": 25 }
}
```

#### `order:cancelled`
```json
{
  "orderId": "...",
  "reason": "Restaurant rejected",
  "refundAmount": 120000
}
```

---

### Taxi/kuryer joylashuvi

#### `driver:location`
Har 5 sekundda driver joylashuvi yangilanadi (order room).
```json
{
  "orderId": "...",
  "driverId": "...",
  "latitude": 41.0166,
  "longitude": 70.1439,
  "heading": 45,          // gradus
  "speed": 12.5,          // m/s
  "at": "2026-07-03T14:22:05Z"
}
```

#### `driver:eta`
Yangilangan yetish vaqti.
```json
{
  "orderId": "...",
  "etaMinutes": 8
}
```

---

### Vendor tomon

#### `vendor:new_order`
Restoran/sotuvchiga yangi buyurtma keldi (vendor room).
```json
{
  "orderId": "...",
  "orderType": "food",
  "total": 120000,
  "itemsCount": 3,
  "placedAt": "2026-07-03T14:22:00Z"
}
```

#### `vendor:order_cancelled`
Passenger bekor qildi.
```json
{ "orderId": "...", "reason": "..." }
```

---

### Kuryer tomon

#### `courier:new_delivery_available`
Kuryerga yaqin joyda tayyor buyurtma bor (driver room, agar courier-mode).
```json
{
  "orderId": "...",
  "orderType": "food",
  "pickupAddress": { "line": "...", "latitude": 41.0, "longitude": 70.1 },
  "deliveryAddress": { "line": "...", "latitude": 41.02, "longitude": 70.15 },
  "distanceKm": 3.2,
  "payoutAmount": 18000
}
```

---

### Wallet / tranzaksiya

#### `wallet:balance_changed`
```json
{
  "userId": "...",
  "oldBalance": 50000,
  "newBalance": 150000,
  "delta": 100000,
  "transactionId": "..."
}
```

#### `transaction:completed`
```json
{ "transactionId": "...", "status": "success" }
```

---

### Notifications

#### `notification:new`
```json
{
  "id": "...",
  "type": "order_update" | "promo" | "system",
  "title": "Buyurtmangiz yo'lda!",
  "body": "Kuryer 5 daqiqada yetadi",
  "data": { "orderId": "..." },
  "createdAt": "..."
}
```

---

## Client → Server eventlari

### `subscribe` / `unsubscribe`
```json
{ "event": "subscribe", "room": "order:abc-123" }
```

### `driver:location_update`
Driver o'z joylashuvini yuboradi (har 5 sekundda).
```json
{
  "latitude": 41.0166,
  "longitude": 70.1439,
  "heading": 45,
  "speed": 12.5
}
```

### `ping`
Connection keep-alive (client har 30s da yuboradi).

---

## Xatoliklar

Har qanday xato quyidagicha keladi:
```json
{
  "event": "error",
  "code": "UNAUTHORIZED" | "SUBSCRIPTION_DENIED" | "INVALID_PAYLOAD",
  "message": "..."
}
```

## Frontend eslatma

- Ulanish uzilsa, exponential backoff bilan reconnect (1s, 2s, 4s, 8s, max 30s)
- `driver:location` eventlarni throttle qilib map'da yumshoq harakat qilish (linear interpolation 5s'da)
- App background'da bo'lsa WebSocket'ni disconnect qilish → foreground'ga qaytganda qayta ulanish
