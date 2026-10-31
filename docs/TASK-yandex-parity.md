# Yandex darajasiga chiqish — bajarish rejasi

> Tuzilgan: 2026-08-19 · Asos: [`YANDEX-SOLISHTIRUV.md`](./YANDEX-SOLISHTIRUV.md)
> Taxmin: bitta ishlab chiquvchi + AI yordami. Baholar shunga mo'ljallangan.

---

## 0. Avval — "to'liq Yandexga o'xshash" nimani anglatadi

Yandex Go'ni **to'liq** nusxalash maqsad sifatida noto'g'ri, chunki uning katta qismi
dasturiy ta'minot emas: samokat parki (temir + IoT), jamoat transporti (shahar
bilan shartnoma va GTFS), o'z xaritasi (yillar), Plus obunasi (kontent
ekotizimi). Bularni quvish — resursni mahsulotdan olib qo'yish.

Shuning uchun funksiyalar uch guruhga bo'lindi:

| Guruh | Ma'nosi |
|---|---|
| 🟢 **Yetib olamiz** | Real, foyda keltiradi, sizning bosqichingizga mos |
| 🟡 **Keyinroq** | To'g'ri, lekin oldin 🟢 tugashi kerak |
| 🔴 **Quvmaymiz** | Dasturiy muammo emas — pul, shartnoma yoki jismoniy park kerak |

**🔴 quvilmaydiganlar va sababi:**

- **Samokat ijarasi** — samokat parki, IoT qulflar, zaryad logistikasi. Bu boshqa biznes.
- **Jamoat transporti jadvali** — shahar hokimiyati bilan ma'lumot shartnomasi kerak.
- **O'z xaritasi** — sizda OSRM bor va u ishlaydi. Bu allaqachon "o'z xaritangiz".
- **Plus obunasi** — obuna qiymati kontentdan keladi (musiqa, kino). Sizda u yo'q.
- **Carpool** — zichlik kerak. Angrenda bir yo'nalishda bir vaqtda 2 yo'lovchi kam.

Qolgan **hammasi** yetib olinadi. Quyida qanday qilib.

---

## 1-BOSQICH — taksi vertikalining chuqurligi

> Maqsad: bitta safardan tushadigan pulni oshirish va haydovchini ushlab qolish.
> Bu bosqich **pul olib keladi**, shuning uchun birinchi.

### 1.1 🟢 Talab xaritasi (haydovchi) — **eng arzon katta yutuq**

**Nega birinchi:** Yandex Pro'da eng ko'p ishlatiladigan funksiya. Haydovchi
qayerga borishni biladi → bo'sh yurish kamayadi → daromad oshadi → haydovchi
ketmaydi.

**Nega arzon:** `surge` moduli **allaqachon H3 olti burchakli zonalar** bilan
ishlaydi (`h3-js`, `latLngToCell`, `gridDisk`) va har zona uchun `demand`,
`supply`, `multiplier` hisoblaydi. Ma'lumot bor — faqat ko'rsatilmayapti.

| Nima kerak | Tafsilot |
|---|---|
| Backend | `GET /surge/zones?lat&lng&rings=3` → H3 hujayralar ro'yxati + multiplikator. `surge.service.ts` dagi `snapshotFor` ni ko'p zonaga umumlashtirish |
| Mobil | `driver/screens/demand_map_screen.dart` — MapLibre `fill` qatlami, H3 → poligon (`cellToBoundary`) |
| Bog'liqlik | Yo'q |
| Hajm | **S** (~2–3 kun) |

⚠️ Multiplikatorni raqam sifatida ko'rsatmang — rang darajasi bilan bering
("yuqori talab"), aks holda haydovchilar surge kutib bo'sh turishadi.

### 1.2 🟢 Chaqim (tips)

**Nega:** Yandex O'zbekistonda kartadan chaqim beriladi. Haydovchi daromadiga
to'g'ridan-to'g'ri qo'shiladi va sizga hech narsaga tushmaydi.

| Nima kerak | Tafsilot |
|---|---|
| Entity | `orders.tip_amount` (numeric, default 0) |
| Backend | `POST /orders/:id/tip` → `payments` orqali; `orders.service.earnings-breakdown` ga qo'shish (komissiyasiz — chaqim to'liq haydovchiga) |
| Mobil | `rate_driver_screen.dart` ga foiz tanlash bloki (0 / 5% / 10% / 15% / boshqa) |
| Hajm | **S** (~2 kun) |

### 1.3 🟢 Saqlangan kartalar

**Nega:** hozir har safar hosted to'lov sahifasi ochiladi — bu buyurtma
oqimidagi eng katta ishqalanish. Yandexda karta bir marta bog'lanadi.

| Nima kerak | Tafsilot |
|---|---|
| Entity | `saved_cards` (userId, provider, token, maskedPan, expiry, isDefault) |
| Backend | Payme/Click karta **tokenizatsiyasi**; `GET/POST/DELETE /payments/cards`; `POST /payments/charge` token bilan |
| Mobil | `payment_methods_screen.dart` + tarif ekranida karta tanlash |
| Xavfsizlik | Token saqlanadi, **PAN hech qachon saqlanmaydi**. Token — `flutter_secure_storage` emas, faqat backendda |
| Hajm | **L** (~1–1.5 hafta) — PSP integratsiyasi eng qiyin qismi |

### 1.4 🟢 Safar cheki

| Nima kerak | Tafsilot |
|---|---|
| Backend | `GET /orders/:id/receipt` → tuzilgan JSON (masofa, vaqt, tarif, chegirma, chaqim, jami) |
| Mobil | Buyurtma tafsilotida chek ko'rinishi + ulashish |
| Hajm | **S** (~1–2 kun) |

### 1.5 🟢 Rejalashtirilgan safar

| Nima kerak | Tafsilot |
|---|---|
| Entity | `orders.scheduled_at` (timestamptz, null = hozir) |
| Backend | Cron/queue: `scheduled_at - 10min` da `matching.startSearch()`. `@nestjs/schedule` yetarli, Kafka kerak emas |
| Mobil | Tarif ekranida "Hozir / Vaqt belgilash", rejalar ro'yxati |
| Tuzoq | Rejalashtirilgan buyurtmada narx **buyurtma vaqtida** qayta hisoblanishi kerak (surge o'zgaradi) — buni oldindan aytib qo'ying |
| Hajm | **M** (~4–5 kun) |

**1-bosqich jami: ~3–4 hafta**

---

## 2-BOSQICH — super-app arxitekturasi

> Maqsad: `food` va `market` haqiqatan ishlashi. Hozir ular buyurtma qabul
> qiladi, lekin **yetkazadigan odam topilmaydi**.

### 2.1 🟢 Haydovchi modelini kengaytirish — **hamma narsaning kaliti**

Hozirgi `driver` entity: `carModel · carNumber · licensePlate · carYear ·
approvedTariffTier · rating · isOnline · balance · commissionRate ·
currentLocation`.

**Yo'q va kerak:**

| Maydon | Nega |
|---|---|
| `vehicleType` | `sedan` / `van` / `truck` / `moto` / `foot` — cargo va kuryer uchun |
| `serviceTypes[]` | Haydovchi qaysi turdagi buyurtmani oladi (`taxi`, `cargo`, `food`, `market`) |
| `priority` | Buyurtma navbatidagi o'rin (2.4 ga qarang) |
| `documentsExpireAt` | Hujjat muddati |

Hajm: **S** (migratsiya + admin UI)

### 2.2 🔴 `matching` ga servis filtri — **hozirgi eng jiddiy nuqson**

`matching.service.ts` da `serviceType` bo'yicha **hech qanday filtr yo'q**.
Ya'ni cargo buyurtmasi furgon egasiga ham, oddiy `Nexia` ga ham bir xil boradi.

```
Hozir:   startSearch(orderId) → 3km ichidagi BARCHA onlayn haydovchi
Kerak:   startSearch(orderId) → 3km + serviceTypes ∋ order.serviceType
                              + vehicleType tarif talabiga mos
```

Bu Yandexning naqshi: **bitta qidiruv servisi, filtrlangan ta'minot hovuzi.**
Sizda `orders.service_type` va `tariffs.vehicle_type` primitivlari allaqachon
bor — shunchaki ulanmagan.

Hajm: **M** (~3–4 kun, testlar bilan)

### 2.3 🟢 Kuryer roli va food/market dispatch

| Nima kerak | Tafsilot |
|---|---|
| Rol | `courier` — `users.role` ga qo'shish |
| Oqim | Restoran "tayyor" bosgach → `matching.startSearch()` kuryer hovuzida |
| Ekran | Kuryer uchun olish→topshirish oqimi (taksi oqimining soddalashtirilgani) |
| Bog'liqlik | **2.1 va 2.2 tugagan bo'lishi shart** |
| Hajm | **L** (~1.5 hafta) |

### 2.4 🟡 Haydovchi prioriteti

Yandexda haydovchi reytingi va qabul foizi buyurtma navbatiga ta'sir qiladi.

Sizda `rating` bor, `matching` esa faqat ETA bo'yicha tartiblaydi. Formulaga
prioritetni qo'shish: `score = eta_seconds × (1 − priority_bonus)`.

Hajm: **S** — lekin **2.2 dan keyin**, aks holda ikki marta yozasiz.

**2-bosqich jami: ~4 hafta**

---

## 3-BOSQICH — kengayish

### 3.1 🟡 Ko'p shahar (`city_id`)

Hozir Angren qat'iy kodlangan. Toshkentga chiqish uchun:
`cities` jadvali → `orders`, `drivers`, `tariffs`, `surge` zonalari `city_id` oladi.

⚠️ Buni **erta** qiling — keyinroq migratsiya har bir jadvalga tegadi.
Hajm: **M** (~1 hafta)

### 3.2 🟡 Shaharlararo

Yandex O'zbekistonda 2026-may'da 23 yo'nalish ochgan. Sizda Angren↔Toshkent
tabiiy yo'nalish.

Kerak: qat'iy narxli yo'nalishlar jadvali, jo'nash vaqti, o'rindiq soni.
Bog'liqlik: **3.1**. Hajm: **M**

### 3.3 🟡 Haydovchi asboblari

Smena rejasi · hujjat yangilash (`documentsExpireAt` dan eslatma) · darslar ·
mening avtomobillarim · to'lov sozlamalari.

Har biri **S**, jami ~2 hafta.

### 3.4 🟡 Yo'lovchi qolganlari

Safar opsiyalari (bola o'rindig'i, hayvon) · yo'qolgan buyum · korporativ hisob ·
kuryer kuzatuvi xaritada.

Jami ~2 hafta.

**3-bosqich jami: ~6 hafta**

---

## 4-BOSQICH — masshtab (faqat kerak bo'lganda)

Bu bosqichga **oldindan** kirmang. Belgilar paydo bo'lgandagina:

| Belgi | Harakat |
|---|---|
| `matching` javob vaqti sekinlashdi | Alohida servisga ajratish (birinchi nomzod) |
| PostgreSQL analitikadan bo'g'ilyapti | ClickHouse (Yandex ham shuni ishlatadi) |
| Bitta region yetmayapti | Ko'p region deploy |
| Railway qimmat/tor | O'z k8s — **lekin oldin emas** |

---

## Umumiy jadval

| Bosqich | Muddat | Nima ochiladi |
|---|---|---|
| 1 — taksi chuqurligi | ~3–4 hafta | Safardan ko'proq daromad, haydovchi ushlanadi |
| 2 — super-app arxitekturasi | ~4 hafta | Food/market **haqiqatan** ishlaydi |
| 3 — kengayish | ~6 hafta | Toshkent + shaharlararo |
| **Jami** | **~3.5 oy** | Yandex bilan real raqobat qiladigan mahsulot |

---

## Boshlash nuqtasi

**1.1 — talab xaritasi.** Sabab: `surge` moduli H3 bilan allaqachon ishlaydi,
ya'ni 2–3 kunlik ish haydovchi taqsimotini darhol yaxshilaydi. Boshqa hech
narsaga bog'liq emas va natijasi birinchi kundan ko'rinadi.

Undan keyin **2.1 + 2.2** (haydovchi modeli + matching filtri) — chunki ular
food/market va cargo'ning ishlashini bloklab turibdi.

---

## Strategik eslatma

Angrenda Yandex allaqachon bor. Funksiya bo'yicha ularni quvib yetish o'zi
g'alaba emas — ular har doim ko'proq resursga ega bo'ladi. Sizning haqiqiy
ustunligingiz boshqa joyda:

- **Komissiya** — Yandexnikidan past qo'ya olasiz (mahalliy xarajat)
- **Mahalliy to'lov** — Payme/Click/Uzcard allaqachon chuqur integratsiya
- **Vertikal zichlik** — kichik shaharda ovqat + market + taksi bitta ilovada
  bo'lishi Yandexdan ko'ra sizga osonroq, chunki siz mahalliy sotuvchi bilan
  to'g'ridan-to'g'ri ishlaysiz
- **Tezlik** — bitta qaror qabul qiluvchi, bitta kod bazasi

Reja shu ustunliklarni saqlagan holda funksiya bo'shlig'ini yopadi.
