# Vendor Admin API

Admin panel (web-admin) va vendor dashboard (web-manager) uchun qo'shimcha endpointlar.

## Admin: vendor moderatsiyasi

### GET `/admin/vendors/pending`

Tasdiqlanishini kutayotgan vendorlar (restoranlar + sotuvchilar).

**Auth:** admin  
**Query:** `type=restaurant|seller`, `page`, `limit`  
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "type": "restaurant",
      "id": "...",
      "name": "...",
      "ownerName": "...",
      "ownerPhone": "...",
      "submittedAt": "2026-07-02T14:00:00Z"
    }
  ]
}
```

### POST `/admin/vendors/:type/:id/approve`

**Auth:** admin  
**Request (optional):** `{ "note": "OK, hujjatlar mos" }`  
**Response 200:** yangilangan vendor (status → `approved`)

### POST `/admin/vendors/:type/:id/reject`

**Auth:** admin  
**Request:** `{ "reason": "Hujjatlar to'liq emas" }`  
**Response 200:** vendor (status → `suspended`), owner'ga notification yuboriladi

### POST `/admin/vendors/:type/:id/suspend`

Ishlab turgan vendorni to'xtatish.

**Auth:** admin  
**Request:** `{ "reason": "Shikoyatlar ko'p" }`  
**Response 200:** vendor

---

## Admin: analytics

### GET `/admin/analytics/overview`

Umumiy dashboard KPI.

**Auth:** admin  
**Query:** `dateFrom`, `dateTo`  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "orders": {
      "taxi": { "count": 1250, "revenue": 45000000 },
      "food": { "count": 340, "revenue": 22000000 },
      "market": { "count": 89, "revenue": 15000000 }
    },
    "activeUsers": { "passengers": 3400, "drivers": 120, "vendors": 45 },
    "newSignups": { "passengers": 210, "drivers": 8, "vendors": 3 },
    "topRestaurants": [ { "id": "...", "name": "...", "revenue": 5000000 } ],
    "topSellers": [ { "id": "...", "displayName": "...", "revenue": 3200000 } ]
  }
}
```

### GET `/admin/analytics/vendors/:id`

Bitta vendor bo'yicha analytics.

**Auth:** admin  
**Query:** `dateFrom`, `dateTo`  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "ordersCount": 240,
    "revenue": 8500000,
    "avgOrderValue": 35400,
    "avgRating": 4.6,
    "cancellationRate": 0.04,
    "revenueByDay": [
      { "date": "2026-07-01", "revenue": 320000 }
    ]
  }
}
```

---

## Vendor dashboard analytics

### GET `/vendor/analytics/overview`

Vendor o'zining dashboard'i.

**Auth:** vendor  
**Query:** `dateFrom`, `dateTo`  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "ordersCount": 240,
    "revenue": 8500000,
    "commission": 1275000,
    "netEarnings": 7225000,
    "avgOrderValue": 35400,
    "avgRating": 4.6,
    "topItems": [
      { "id": "...", "name": "Pepperoni pitsa", "soldCount": 120, "revenue": 6600000 }
    ],
    "revenueByDay": [
      { "date": "2026-07-01", "revenue": 320000, "ordersCount": 8 }
    ],
    "ordersByHour": [ { "hour": 12, "count": 15 }, ... ]
  }
}
```

---

## Manager: dispatch (mavjud + kengaytirish)

### GET `/manager/food-queue`

Hozirda navbatda turgan barcha restoranlar buyurtmalari (yordam berish uchun).

**Auth:** dispatcher  
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "orderId": "...",
      "restaurantName": "...",
      "status": "pending",
      "waitingMinutes": 12,
      "total": 85000
    }
  ]
}
```

### GET `/manager/market-queue`

Xuddi shu — market uchun.

**Auth:** dispatcher  
**Response 200:** market queue

### POST `/manager/food-orders/:id/assign-courier`

Dispetcher qo'l bilan kuryer biriktiradi.

**Auth:** dispatcher  
**Request:** `{ "driverId": "..." }`  
**Response 200:** yangilangan buyurtma

### POST `/manager/market-orders/:id/assign-courier`

**Auth:** dispatcher  
**Request:** `{ "driverId": "..." }`  
**Response 200:** yangilangan buyurtma

---

## Admin: promo boshqaruv (super-app kengaytirish)

Mavjud `/promo-codes/*` endpointlariga `applicableTo` field qo'shiladi:

```json
{
  "applicableTo": ["taxi", "food", "market"]
}
```

Boshqa qismi o'zgarmaydi.
