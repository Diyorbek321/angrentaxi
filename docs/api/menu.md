# Menu / Dishes API

Restoran menyusi: kategoriyalar va taomlar.

## Ma'lumot modeli

```ts
MenuCategory {
  id: string
  restaurantId: string
  name: string                  // "Salatlar"
  sortOrder: number             // 0, 1, 2...
  isActive: boolean
}

Dish {
  id: string
  restaurantId: string
  categoryId: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number                 // so'm
  oldPrice: number | null       // aksiya bo'lsa
  weightGrams: number | null    // 350
  caloriesKcal: number | null
  spicyLevel: 0 | 1 | 2 | 3     // 0 = achchiq emas
  isVegetarian: boolean
  options: DishOption[]         // qo'shimchalar
  isAvailable: boolean          // ombordagi holat
  sortOrder: number
  createdAt: string
  updatedAt: string
}

DishOption {
  id: string
  name: string                  // "Qo'shimcha pishloq"
  price: number                 // qo'shimcha narx, so'm
  isRequired: boolean
  maxSelect: number             // masalan, 2 ta qo'shimcha tanlash mumkin
}
```

---

## GET `/restaurants/:restaurantId/menu`

Restoran menyusi (kategoriya + taomlar bilan birga).

**Auth:** passenger  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "...",
        "name": "Salatlar",
        "sortOrder": 0,
        "dishes": [ Dish, Dish, ... ]
      },
      { ... }
    ]
  }
}
```

---

## GET `/dishes/:id`

Bitta taom (detail sahifasi uchun).

**Auth:** passenger  
**Response 200:**
```json
{ "success": true, "data": Dish }
```

**Errors:** `RESOURCE_NOT_FOUND`

---

## Vendor endpointlari

### POST `/vendor/restaurants/:restaurantId/categories`

**Auth:** vendor  
**Request:**
```json
{ "name": "Ichimliklar", "sortOrder": 3 }
```

**Response 201:** `MenuCategory`

### PATCH `/vendor/categories/:id`

**Auth:** vendor  
**Request:** `name?`, `sortOrder?`, `isActive?`  
**Response 200:** yangilangan `MenuCategory`

### DELETE `/vendor/categories/:id`

**Auth:** vendor  
**Response 204**  
**Errors:** `CONFLICT` — agar kategoriyada taom bo'lsa

---

### POST `/vendor/restaurants/:restaurantId/dishes`

**Auth:** vendor  
**Request:**
```json
{
  "categoryId": "...",
  "name": "Pepperoni pitsa",
  "description": "Klassik pepperoni pitsa 30 sm",
  "price": 55000,
  "oldPrice": 65000,
  "weightGrams": 550,
  "caloriesKcal": 850,
  "spicyLevel": 1,
  "isVegetarian": false,
  "options": [
    { "name": "Qo'shimcha pishloq", "price": 8000, "isRequired": false, "maxSelect": 1 }
  ]
}
```

**Response 201:** `Dish`

### PATCH `/vendor/dishes/:id`

**Auth:** vendor  
**Request:** yuqoridagi field'lar optional (`isAvailable` ham qo'shsa bo'ladi)  
**Response 200:** yangilangan `Dish`

### DELETE `/vendor/dishes/:id`

**Auth:** vendor  
**Response 204**

### POST `/vendor/dishes/:id/image`

**Auth:** vendor  
**Request:** multipart `file` (max 2 MB)  
**Response 200:** `{ "imageUrl": "..." }`

### PATCH `/vendor/dishes/bulk-availability`

Ko'p taomni birdaniga yoqish/o'chirish (masalan, "kunning oxiri, hammasini o'chirish").

**Auth:** vendor  
**Request:**
```json
{
  "restaurantId": "...",
  "updates": [
    { "dishId": "...", "isAvailable": false },
    { "dishId": "...", "isAvailable": true }
  ]
}
```

**Response 200:** `{ "updated": 12 }`
