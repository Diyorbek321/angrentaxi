# Market Products API

Do'kon mahsulotlari: katalog, inventar, narxlar.

## Ma'lumot modeli

```ts
Product {
  id: string
  sellerId: string
  categoryId: string
  name: string
  description: string | null
  brand: string | null
  sku: string | null            // ombor kodi
  images: string[]              // URL massivi (birinchi = asosiy)
  price: number                 // so'm
  oldPrice: number | null
  currency: "UZS"
  stock: number                 // qoldiq
  unit: "piece" | "kg" | "liter" | "meter"
  isAvailable: boolean          // ombor bor + vendor yoqqan
  attributes: { key: string; value: string }[]   // "Rang: Qora", "Xotira: 128GB"
  weightGrams: number | null
  rating: number
  reviewsCount: number
  soldCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

ProductCategory {
  id: string
  sellerId: string
  name: string
  parentId: string | null       // subkategoriya bo'lishi mumkin
  sortOrder: number
  isActive: boolean
}
```

---

## Passenger endpointlari

### GET `/products`

Global product qidiruv (barcha sotuvchilar bo'yicha).

**Auth:** passenger  
**Query:**

| Param | Ta'rif |
|-------|--------|
| `search` | matn qidiruv |
| `category` | kategoriya slug |
| `sellerId` | ma'lum sotuvchi |
| `minPrice`, `maxPrice` | narx oralig'i |
| `sort` | `popular` \| `price_asc` \| `price_desc` \| `newest` \| `rating` |
| `page`, `limit` | pagination |

**Response 200:** `Product[]` + meta

### GET `/products/:id`

Mahsulot tafsiloti.

**Auth:** passenger  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "product": Product,
    "seller": { "id": "...", "displayName": "...", "rating": 4.8 },
    "relatedProducts": [ Product, ... ]
  }
}
```

### GET `/sellers/:sellerId/products`

Bitta sotuvchi katalogi.

**Auth:** passenger  
**Query:** `categoryId`, `search`, `sort`, `page`, `limit`  
**Response 200:** `Product[]` + meta

### GET `/sellers/:sellerId/categories`

Sotuvchining kategoriyalar daraxti.

**Auth:** passenger  
**Response 200:** `ProductCategory[]` (tree flatten bilan)

---

## Vendor endpointlari

### POST `/vendor/sellers/:sellerId/categories`

**Auth:** vendor  
**Request:**
```json
{ "name": "Telefonlar", "parentId": null, "sortOrder": 0 }
```

**Response 201:** `ProductCategory`

### PATCH `/vendor/categories/:id`

**Auth:** vendor  
**Request:** `name?`, `parentId?`, `sortOrder?`, `isActive?`  
**Response 200:** `ProductCategory`

### DELETE `/vendor/categories/:id`

**Auth:** vendor  
**Response 204**  
**Errors:** `CONFLICT` — kategoriyada mahsulot bo'lsa

---

### POST `/vendor/sellers/:sellerId/products`

**Auth:** vendor  
**Request:**
```json
{
  "categoryId": "...",
  "name": "iPhone 15 128GB",
  "description": "...",
  "brand": "Apple",
  "sku": "IPH15-128-BLK",
  "price": 12500000,
  "oldPrice": 13500000,
  "stock": 5,
  "unit": "piece",
  "attributes": [
    { "key": "Rang", "value": "Qora" },
    { "key": "Xotira", "value": "128GB" }
  ],
  "weightGrams": 200
}
```

**Response 201:** `Product`

### PATCH `/vendor/products/:id`

**Auth:** vendor  
**Request:** har qanday field optional  
**Response 200:** yangilangan `Product`

### DELETE `/vendor/products/:id`

**Auth:** vendor  
**Response 204** (soft delete — `isActive=false`)

### POST `/vendor/products/:id/images`

**Auth:** vendor  
**Request:** multipart, `files[]` (max 5 rasm, har biri 2 MB)  
**Response 200:** `{ "images": ["url1", "url2", ...] }`

### DELETE `/vendor/products/:id/images`

**Auth:** vendor  
**Request:** `{ "imageUrl": "https://..." }`  
**Response 204**

### PATCH `/vendor/products/bulk-stock`

Ombor qoldiqlarini bir vaqtda yangilash (CSV import uchun).

**Auth:** vendor  
**Request:**
```json
{
  "sellerId": "...",
  "updates": [
    { "productId": "...", "stock": 12 },
    { "productId": "...", "stock": 0 }
  ]
}
```

**Response 200:** `{ "updated": 25 }`

### PATCH `/vendor/products/bulk-availability`

**Auth:** vendor  
**Request:**
```json
{
  "sellerId": "...",
  "updates": [ { "productId": "...", "isAvailable": true } ]
}
```

**Response 200:** `{ "updated": 25 }`
