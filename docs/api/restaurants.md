# Restaurants API

Restoranlarni ro'yxatga olish, ro'yxatlash, izlash va tafsilotlarini olish.

## Ma'lumot modeli

```ts
Restaurant {
  id: string (UUID)
  name: string
  slug: string                  // "kebab-house-angren"
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  categories: string[]          // ["fast_food", "pizza", "kebab"]
  address: {
    line: string
    latitude: number
    longitude: number
    landmark: string | null
  }
  phone: string                 // "+998901234567"
  workingHours: {
    monday: { open: "09:00", close: "23:00" } | null   // null = closed
    tuesday: { ... }
    // ... har kun
  }
  deliveryFee: number           // so'm
  minOrderAmount: number        // so'm
  avgDeliveryMinutes: number    // 30
  rating: number                // 4.6 (0-5)
  reviewsCount: number
  isOpen: boolean               // hisoblab beriladi hozirgi vaqt asosida
  isActive: boolean             // vendor tomonidan yoqilgan/o'chirilgan
  status: "pending" | "approved" | "suspended"
  createdAt: string (ISO-8601)
  updatedAt: string (ISO-8601)
}
```

---

## GET `/restaurants`

Restoranlar ro'yxati (passenger uchun).

**Auth:** passenger  
**Query params:**

| Param | Type | Default | Ta'rif |
|-------|------|---------|--------|
| `page` | number | 1 | |
| `limit` | number | 20 | max 50 |
| `category` | string | — | filter (masalan: `pizza`) |
| `search` | string | — | nom bo'yicha qidiruv |
| `sort` | enum | `popular` | `popular` \| `rating` \| `delivery_time` \| `min_order` |
| `latitude` | number | — | user joylashuvi (yaqinlik uchun) |
| `longitude` | number | — | user joylashuvi |
| `openNow` | boolean | false | faqat hozir ochiqlar |

**Response 200:**
```json
{
  "success": true,
  "data": [ Restaurant, ... ],
  "meta": { "page": 1, "limit": 20, "total": 45 }
}
```

---

## GET `/restaurants/:id`

Bitta restoran + qisqa statistika.

**Auth:** passenger  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "restaurant": Restaurant,
    "menuCategoriesCount": 6,
    "dishesCount": 42
  }
}
```

**Errors:** `RESOURCE_NOT_FOUND`

---

## GET `/restaurants/categories`

Barcha kategoriyalar ro'yxati (chip'lar uchun).

**Auth:** ochiq (public)  
**Response 200:**
```json
{
  "success": true,
  "data": [
    { "slug": "pizza", "name": "Pitsa", "icon": "🍕", "count": 12 },
    { "slug": "kebab", "name": "Kabob", "icon": "🥙", "count": 8 }
  ]
}
```

---

## POST `/vendor/restaurants`

Vendor tomonidan yangi restoran ro'yxatga olinishi (approval kutadi).

**Auth:** vendor  
**Request:**
```json
{
  "name": "Kebab House",
  "description": "...",
  "categories": ["kebab", "fast_food"],
  "phone": "+998901234567",
  "address": {
    "line": "Angren sh., Amir Temur ko'ch. 45",
    "latitude": 41.0166,
    "longitude": 70.1439,
    "landmark": "Metro yonida"
  },
  "workingHours": {
    "monday": { "open": "09:00", "close": "23:00" },
    "tuesday": { "open": "09:00", "close": "23:00" }
  },
  "deliveryFee": 10000,
  "minOrderAmount": 30000,
  "avgDeliveryMinutes": 35
}
```

**Response 201:**
```json
{
  "success": true,
  "data": { ...Restaurant, "status": "pending" }
}
```

**Errors:** `VALIDATION_ERROR`, `CONFLICT` (agar shu vendor uchun mavjud bo'lsa)

---

## PATCH `/vendor/restaurants/:id`

Vendor o'z restoranini tahrirlashi.

**Auth:** vendor (faqat o'ziniki)  
**Request:** yuqoridagi barcha fieldlar optional  
**Response 200:** yangilangan `Restaurant`

---

## PATCH `/vendor/restaurants/:id/status`

Vendor restoranni "hozir yopiq / ochiq" qilib almashtiradi.

**Auth:** vendor  
**Request:**
```json
{ "isActive": true }
```

**Response 200:** yangilangan `Restaurant`

---

## POST `/vendor/restaurants/:id/logo`

Logo yuklash (multipart/form-data).

**Auth:** vendor  
**Request:** `file` field (image/jpeg | image/png | image/webp, max 2 MB)  
**Response 200:**
```json
{ "success": true, "data": { "logoUrl": "https://cdn.../logo.jpg" } }
```
