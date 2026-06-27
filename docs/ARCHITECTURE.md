# Angren Super App — Arxitektura (oddiy tilda)

> Bu hujjat super-app'ni (taksi + yuk + ovqat + market) qanday qurishni
> tushuntiradi. Birinchi marta qurayotganlar uchun yozilgan.

---

## 1. Asosiy g'oya: platforma = "o'rtadagi vositachi"

Siz tovar yoki xizmat **sotmaysiz**. Siz **xaridor** bilan **sotuvchi/haydovchi**ni
bog'laydigan va **pulni o'tkazib beradigan** platformasiz. Daromad —
har bir buyurtmadan oladigan **komissiya** (masalan 15%).

```
   XARIDOR  ──to'laydi──►  PLATFORMA  ──pul yuboradi──►  SOTUVCHI
                              │                          (item narxi − komissiya)
                              ├──pul──►  KURYER/HAYDOVCHI (yetkazish haqi)
                              └──qoldiq──►  o'zingiz (komissiya)
```

Bu **"ko'p tomonlama bozor" (multi-sided marketplace)** deyiladi. 4 xil foydalanuvchi bor:

| Kim | Nima qiladi | Interfeys |
|-----|-------------|-----------|
| **Xaridor** | buyurtma beradi, to'laydi | mobil ilova (bor) |
| **Haydovchi/Kuryer** | yetkazadi | mobil ilova (bor) |
| **Sotuvchi** (restoran/do'kon) | tovar qo'yadi, buyurtmani ko'radi, tayyorlaydi | **web panel (yangi)** |
| **Admin** (siz) | hammasini boshqaradi, komissiya, to'lovlar | web panel (bor) |

**Eng muhim tushuncha:** har bir tomonning o'z interfeysi bor. Sotuvchi
o'z do'konini **o'zi yurgizadi** — buning uchun unga alohida **Sotuvchi paneli** kerak.

---

## 2. Tizim komponentlari (umumiy rasm)

```
┌─────────────┐   ┌─────────────┐   ┌──────────────┐   ┌────────────┐
│ Xaridor     │   │ Haydovchi   │   │ Sotuvchi     │   │ Admin      │
│ ilovasi     │   │ ilovasi     │   │ paneli (web) │   │ paneli     │
│ (Flutter)   │   │ (Flutter)   │   │ (Next.js)    │   │ (Next.js)  │
└──────┬──────┘   └──────┬──────┘   └──────┬───────┘   └─────┬──────┘
       │                 │                 │                 │
       └─────────────────┴────────┬────────┴─────────────────┘
                                   │  (REST API + WebSocket)
                          ┌────────▼─────────┐
                          │   BACKEND (NestJS)│
                          │  modullar:        │
                          │  auth, catalog,   │
                          │  orders, payments,│
                          │  payouts, vendors,│
                          │  couriers, ...    │
                          └────┬───────┬──────┘
                ┌──────────────┘       └───────────────┐
        ┌───────▼────────┐                     ┌────────▼─────────┐
        │ PostgreSQL DB  │                     │ To'lov shlyuzi   │
        │ (ma'lumotlar)  │                     │ (Payme/Click/    │
        │ + Redis        │                     │  Uzcard)         │
        └────────────────┘                     └──────────────────┘
                                               + Fayl ombori (rasm)
                                               + Push/SMS
```

**Yangi kerak bo'ladiganlar:**
- **Sotuvchi paneli** (web) — restoran/do'kon egasi uchun
- **To'lov shlyuzi integratsiyasi** (karta to'lovi)
- **Fayl ombori** — tovar rasmlari uchun (masalan Cloudinary yoki S3)
- Backend'da yangi modullar: `catalog`, `payments`, `payouts`, `vendors`

---

## 3. Pul qanday harakatlanadi (eng muhim qism)

### Karta to'lovi — xavfsizlik qoidasi #1
⚠️ **Karta raqamini HECH QACHON o'zingiz saqlamang.** Bu qonuniy (PCI) talab.
To'lov shlyuzi (Payme/Click/Uzcard) kartani qabul qiladi va sizga faqat
**"token"** (xavfsiz kalit) qaytaradi. Siz tokenni saqlaysiz, karta raqamini emas.

### Escrow (pulni ushlab turish) modeli
```
1. Xaridor 50 000 so'm to'laydi (40k tovar + 10k yetkazish)
2. Pul PLATFORMA hisobiga tushadi (ushlab turiladi)
3. Buyurtma yakunlanganda taqsimlanadi:
      • Sotuvchiga:  40 000 − 15% komissiya = 34 000  → sotuvchi balansi
      • Kuryerga:    10 000                          → kuryer balansi
      • Sizga:        6 000 (komissiya)
4. Sotuvchi/kuryer balansidagi pulni kartasiga YECHIB OLADI (payout)
```

### Balans va "ledger" (hisob daftari)
Har bir sotuvchi va kuryerning **balansi** bor. Har bir pul harakati
**transaction** (yozuv) sifatida saqlanadi — kim, qancha, qachon, nima uchun.
Bu shaffoflik va nizolarni hal qilish uchun.

### Payout (pul yechish)
Sotuvchi panelida "Pulni yechish" tugmasi. Sotuvchi avval o'z **kartasini ulaydi**
(payout uchun). Platforma vaqti-vaqti bilan (yoki so'rovda) ularning kartasiga pul yuboradi.

> Uzbekistonda payout odatda Uzcard/Humo karta orqali bo'ladi. Payme/Click
> "merchant" hisobini qo'llab-quvvatlaydi — buni keyin aniq sozlaymiz.

---

## 4. Sotuvchi o'z do'konini qanday yurgizadi

Sotuvchi paneli (web) quyidagilarni beradi:

1. **Ro'yxatdan o'tish + tekshiruv (KYC)** — do'kon nomi, hujjatlar; admin tasdiqlaydi
2. **Do'kon sozlamalari** — nomi, logotipi, ish vaqti, manzili, yetkazish zonasi
3. **Tovar qo'yish** — nomi, narxi, rasmi, kategoriyasi, ombordagi soni
4. **Buyurtmalarni ko'rish** — yangi buyurtma keladi (real-time), qabul/rad qiladi, "tayyor" deb belgilaydi
5. **Balans va payout** — daromadi, kartasini ulash, pul yechish
6. **Statistika** — sotuvlar, mashhur tovarlar

**Restoran (Ovqat)** va **Do'kon (Market)** — bu deyarli **bir xil panel**,
faqat "vendor_type" farqli (restoran = menyu, do'kon = tovarlar). Shuning uchun
ikkalasini **bitta "Sotuvchi paneli"** qilib quramiz.

---

## 5. Ma'lumotlar bazasi (yangi jadvallar)

```
vendors            — sotuvchilar (restoran/do'kon)
  id, owner_user_id, type(restaurant|shop), name, logo, status,
  commission_rate, balance, location, working_hours

products           — tovarlar/taomlar
  id, vendor_id, category_id, name, description, price, image_url,
  stock, is_available

categories         — kategoriyalar (Ichimliklar, Fast-food, ...)

carts / cart_items — savatcha

orders (kengaytirish) — buyurtma
  + vendor_id, courier_id, delivery_fee, commission, items_total

order_items        — buyurtmadagi har bir tovar (nomi, soni, narxi)

payments           — to'lovlar
  id, order_id, amount, method, gateway_txn_id, status

payouts            — pul yechishlar
  id, vendor_id, amount, card_token, status

ledger_entries     — hisob daftari (har bir pul harakati)
  id, owner_type(vendor|courier|platform), owner_id, amount,
  type(credit|debit), reason, order_id
```

---

## 6. Buyurtma jarayoni (Ovqat/Market)

```
Xaridor: do'kon tanlaydi → tovarlar → savatcha → checkout → KARTA bilan to'laydi
   ↓
Buyurtma sotuvchiga boradi (real-time bildirishnoma)
   ↓
Sotuvchi: qabul qiladi → tayyorlaydi → "tayyor" deydi
   ↓
Platforma: yaqin kuryerni topadi (xuddi taksidek matching)
   ↓
Kuryer: oladi → yetkazadi → "yetkazildi"
   ↓
Pul taqsimlanadi: sotuvchi balansi + kuryer balansi + komissiya
```

Ko'rib turganingizdek — bu **taksi oqimiga juda o'xshash**, faqat o'rtada
"savatcha + sotuvchi tayyorlash" qadami qo'shilgan. Shuning uchun mavjud
matching/realtime/orders infratuzilmasini qayta ishlatamiz.

---

## 7. Qanday qurish kerak — bosqichma-bosqich (beginner uchun)

⚠️ **Hammasini bir vaqtda qurmang.** Bu eng katta xato. Kichik bo'laklarga bo'lib boring:

```
Bosqich A: To'lov poydevori
  - Karta to'lovini ulash (Payme/Click test rejimi)
  - payments jadvali, to'lov holatini kuzatish
  - Avval TAKSI uchun karta to'lovini ishlatib ko'ramiz (oson, bitta sotuvchi yo'q)

Bosqich B: Sotuvchi tizimi (vendors)
  - vendors, products, categories jadvallari
  - Sotuvchi paneli (web): ro'yxatdan o'tish, tovar qo'yish
  - Admin sotuvchini tasdiqlaydi

Bosqich C: Ovqat/Market xaridor tomoni
  - Xaridor ilovasida: do'konlar ro'yxati, tovarlar, savatcha, checkout
  - Buyurtma yaratish + karta to'lovi

Bosqich D: Sotuvchi buyurtma boshqaruvi
  - Sotuvchi real-time buyurtma oladi, qabul/tayyor qiladi

Bosqich E: Kuryer yetkazish + pul taqsimoti
  - Kuryer matching, yetkazish
  - Balans, ledger, payout (pul yechish)
```

Har bosqich **ishlab, test qilinib**, keyin keyingisiga o'tiladi.

---

## 8. Asosiy qarorlar (keyin aniqlashtiramiz)

- **To'lov provayderi:** Payme? Click? Uzcard? (Uzbekiston uchun)
- **Komissiya:** necha % (masalan 15%)?
- **Payout:** qachon (kunlik/haftalik/so'rovda)?
- **Yetkazish narxi:** qat'iy (masalan 10k) yoki masofaga qarab?
- **Fayl ombori:** Cloudinary (oson) yoki o'z serveri?

---

## Xulosa (bir jumlada)

Siz **vositachi platforma** qurasiz: xaridor karta bilan to'laydi → pul sizda
ushlanadi → sotuvchi va kuryer o'z **balansidan kartasiga** pul yechadi → siz
**komissiya** olasiz. Sotuvchi o'z do'konini **alohida web panel** orqali
yurgizadi. Hammasi **bosqichma-bosqich**, to'lovdan boshlab quriladi.
