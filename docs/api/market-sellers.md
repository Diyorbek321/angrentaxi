# Market Sellers API

Market (do'kon) sotuvchilar: ro'yxatga olish, tasdiqlash, profil.

## Ma'lumot modeli

```ts
Seller {
  id: string
  ownerId: string               // user id (auth.users)
  displayName: string           // "TechStore Angren"
  slug: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  categories: string[]          // ["electronics", "phones"]
  address: {
    line: string
    latitude: number
    longitude: number
  }
  phone: string
  workingHours: WorkingHours
  deliveryEnabled: boolean
  deliveryFee: number
  deliveryRadiusKm: number      // qancha masofagacha yetkazadi
  pickupEnabled: boolean        // do'kondan olib ketish
  minOrderAmount: number
  rating: number
  reviewsCount: number
  status: "pending" | "approved" | "suspended"
  isActive: boolean
  kyc: {
    passportNumber: string | null
    innNumber: string | null    // STIR
    passportPhotoUrl: string | null
    selfieUrl: string | null
    verifiedAt: string | null
  }
  walletBalance: number         // pul ushlab qolinishi
  createdAt: string
  updatedAt: string
}
```

---

## POST `/vendor/sellers`

Sotuvchi ro'yxatga olinadi (approval kutadi).

**Auth:** vendor (yangi ro'yxat) yoki passenger (birinchi marta)  
**Request:**
```json
{
  "displayName": "TechStore Angren",
  "description": "Telefon va aksessuar do'koni",
  "categories": ["electronics", "phones"],
  "phone": "+998901234567",
  "address": {
    "line": "Angren, Navoiy ko'ch. 12",
    "latitude": 41.0166,
    "longitude": 70.1439
  },
  "workingHours": { "monday": { "open": "10:00", "close": "20:00" } },
  "deliveryEnabled": true,
  "deliveryFee": 15000,
  "deliveryRadiusKm": 10,
  "pickupEnabled": true,
  "minOrderAmount": 50000,
  "kyc": {
    "passportNumber": "AA1234567",
    "innNumber": "301234567"
  }
}
```

**Response 201:**
```json
{ "success": true, "data": { ...Seller, "status": "pending" } }
```

**Errors:** `VALIDATION_ERROR`, `CONFLICT` (agar user allaqachon sotuvchi)

---

## POST `/vendor/sellers/:id/kyc-documents`

Passport va selfie yuklash.

**Auth:** vendor (o'ziniki)  
**Request:** multipart, ikkita fayl: `passportPhoto`, `selfie` (max 3 MB har biri)  
**Response 200:** yangilangan `kyc` obyekt

---

## GET `/vendor/sellers/me`

Vendor o'zining sotuvchi profilini oladi.

**Auth:** vendor  
**Response 200:** `Seller`

---

## PATCH `/vendor/sellers/:id`

Sotuvchi profilini tahrirlash.

**Auth:** vendor (o'ziniki)  
**Request:** yuqoridagi barcha field'lar optional (kyc va status'dan tashqari)  
**Response 200:** yangilangan `Seller`

---

## PATCH `/vendor/sellers/:id/status`

Vendor do'konni "hozir yopiq / ochiq".

**Auth:** vendor  
**Request:** `{ "isActive": false }`  
**Response 200:** yangilangan `Seller`

---

## GET `/sellers`

Passenger uchun sotuvchilar ro'yxati (marketni ko'rish).

**Auth:** passenger  
**Query:** `page`, `limit`, `category`, `search`, `sort`, `latitude`, `longitude`  
**Response 200:** `Seller[]` + meta

---

## GET `/sellers/:id`

Sotuvchi tafsiloti.

**Auth:** passenger  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "seller": Seller,
    "productsCount": 128,
    "categoriesCount": 5
  }
}
```
