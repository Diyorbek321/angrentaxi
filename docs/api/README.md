# AngrenTaxi Super-App API Contracts

Bu papkada super-app kengaytmasi uchun barcha yangi backend endpointlarining kontrakti (spetsifikatsiyasi) yozilgan. Frontend va backend developer'lar shu hujjatlarga qarab parallel ishlaydi.

## Muhim qoidalar

- **Base URL (prod):** `https://angrentaxi-production.up.railway.app/api/v1`
- **Base URL (local):** `http://localhost:3000/api/v1`
- **Auth:** har bir himoyalangan endpoint `Authorization: Bearer <access_token>` header'ini talab qiladi
- **Content-Type:** `application/json` (fayl yuklashdan tashqari)
- **Til:** faqat inglizcha field nomlari. Foydalanuvchi ko'radigan matnlar (`error.message`, `product.name`) uchbura tilda bo'lishi mumkin (`uz`, `ru`, `en`).
- **Vaqt:** barcha timestamp'lar ISO-8601 UTC (`2026-07-03T14:22:00Z`)
- **Puldeb belgilash:** so'mda, integer sifatida (`12500` = 12,500 so'm). Tiyin/kopeyka ishlatilmaydi.
- **ID:** UUID v4 (string)
- **Pagination:** `?page=1&limit=20` (default `limit=20`, max `100`)

## Standart javob formati

**Muvaffaqiyatli:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 145 }
}
```

**Xatolik:**
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Restaurant not found",
    "details": { "restaurantId": "..." }
  }
}
```

## HTTP status kodlar

| Kod | Ma'no |
|-----|-------|
| 200 | OK — muvaffaqiyatli GET/PATCH |
| 201 | Created — muvaffaqiyatli POST |
| 204 | No Content — muvaffaqiyatli DELETE |
| 400 | Validation error (input xato) |
| 401 | Unauthorized (token yo'q yoki xato) |
| 403 | Forbidden (ruxsat yo'q) |
| 404 | Not found |
| 409 | Conflict (masalan, buyurtma allaqachon qabul qilingan) |
| 422 | Business rule violation |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Error kodlar (standart)

- `VALIDATION_ERROR` — 400
- `UNAUTHORIZED` — 401
- `FORBIDDEN` — 403
- `RESOURCE_NOT_FOUND` — 404
- `CONFLICT` — 409
- `INSUFFICIENT_BALANCE` — 422
- `RESTAURANT_CLOSED` — 422
- `PRODUCT_OUT_OF_STOCK` — 422
- `RATE_LIMITED` — 429

## Rollar

- `passenger` — oddiy foydalanuvchi (mobile)
- `driver` — haydovchi (mobile)
- `vendor` — restoran/do'kon egasi (web-manager)
- `admin` — platforma admini (web-admin)
- `dispatcher` — dispetcher (web-manager)

Har bir endpoint spetsifikatsiyasida qaysi rol ruxsat berilganligi ko'rsatilgan.

## Modullar

| Modul | Fayl | Mas'ul |
|-------|------|--------|
| Restaurants | [restaurants.md](./restaurants.md) | Backend |
| Menu / Dishes | [menu.md](./menu.md) | Backend |
| Food Orders | [food-orders.md](./food-orders.md) | Backend |
| Market Sellers | [market-sellers.md](./market-sellers.md) | Backend |
| Market Products | [market-products.md](./market-products.md) | Backend |
| Market Orders | [market-orders.md](./market-orders.md) | Backend |
| Wallet & Payments | [wallet-payments.md](./wallet-payments.md) | Backend |
| Vendor Admin | [vendor-admin.md](./vendor-admin.md) | Backend |
| WebSocket Events | [websocket-events.md](./websocket-events.md) | Backend + Frontend |

## Workflow

1. **Backend developer** endpointni yozadi va bu hujjatga mos keladigan implementatsiya qiladi
2. **Frontend developer** shu hujjatga qarab mock JSON bilan UI'ni ulaydi
3. Endpoint tayyor bo'lgach, frontend faqat base URL'ni almashtiradi
4. Kontrakt o'zgarsa — **oldindan** ikkalasi ham kelishib oladi, keyin PR qilinadi

## O'zgarishlar tarixi

- **2026-07-03** — Boshlang'ich kontraktlar yaratildi (super-app: restaurants, menu, food, market, vendor admin, wallet)
