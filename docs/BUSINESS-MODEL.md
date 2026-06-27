# Angren Super App — Biznes modeli va daromad (oddiy tilda)

> "Qancha foiz olishimiz kerak? Yoki foiz emas, oylik obuna qilsakchi?"
> Bu hujjat har bir daromad usulini tahlil qiladi va Angren (yangi, kichik
> bozor) uchun eng qulayini tavsiya qiladi.

---

## 1. Platforma qanday pul ishlaydi? (6 ta usul)

Super-app'lar bittadan emas, **bir nechta** daromad usulidan foydalanadi:

### A) Komissiya (har buyurtmadan %)
Har buyurtmadan ulush olasiz (masalan 15%).
- ✅ Sotuvchi/haydovchi **faqat ishlaganda** to'laydi — qo'shilish oson
- ✅ Foydalanish bilan o'sadi
- ❌ Faqat buyurtma bo'lganda daromad — hajm kerak
- ❌ Yuqori % sotuvchilarni qo'rqitadi

### B) Oylik obuna (sotuvchi/haydovchi qat'iy to'laydi)
Masalan: sotuvchi oyiga 200 000 so'm to'laydi, sotuvdan 0% olasiz.
- ✅ **Bashoratli, barqaror** daromad
- ✅ Sotuvchi sotuvining 100% ni o'zida qoldiradi — jozibali
- ❌ **Yangi platformada xavfli:** trafik yo'q ekan, sotuvchi oldindan pul to'lamaydi
- ❌ Kichik sotuvchilar ko'tara olmaydi
- ❌ Ko'p sotsa ham, oz sotsa ham bir xil to'laydi

### C) Yetkazish haqi (xaridor to'laydi)
Xaridor yetkazish uchun to'laydi (masalan 10 000), siz ulushini olasiz.
- ✅ Har yetkazishdan barqaror daromad
- ✅ Sotuvchiga tegmaydi
- ❌ Yuqori bo'lsa xaridorni qo'rqitadi

### D) Reklama / "tepada ko'rsatish" (promoted)
Sotuvchi pul to'lab ro'yxat tepasida chiqadi.
- ✅ Qo'shimcha daromad, sotuvchi ixtiyoriy
- ❌ Faqat ko'p sotuvchi bo'lganda ishlaydi

### E) Xaridor premium obunasi (Yandex Plus kabi)
Xaridor oyiga to'laydi → bepul yetkazish / chegirma.
- ✅ Sodiq xaridorlardan barqaror daromad
- ❌ Faqat katta bazada ishlaydi

### F) Surge / talab narxi (taksi)
Band vaqtda narx oshadi.

---

## 2. Komissiya vs Obuna — qaysi biri SIZGA qulay?

| Mezon | Komissiya | Oylik obuna |
|-------|-----------|-------------|
| Yangi platforma (trafik yo'q) | ✅ **Oson start** | ❌ Hech kim oldindan to'lamaydi |
| Sotuvchini jalb qilish | ✅ "Faqat ishlaganda to'la" | ❌ Risk: oldindan pul |
| Sizning daromadingiz | Hajmga bog'liq | Bashoratli |
| Kichik sotuvchilar | ✅ Mos | ❌ Og'ir |
| Boshqarish | Murakkabroq (har order hisob) | Oddiy |

### 🎯 Tavsiya (Angren — yangi bozor uchun)

**Boshlanishda KOMISSIYA bilan boshlang.** Sababi: sizda hali **xaridorlar yo'q**.
Sotuvchi/haydovchi "men oldindan oylik to'lasam, lekin buyurtma kelmasa-chi?"
deb qo'rqadi. Komissiya esa **"biz faqat siz ishlaganda yutamiz"** — ishonch beradi
va tez qo'shiladi.

**Keyin (3-6 oydan keyin, hajm paydo bo'lgach):** obuna **tanlovini** qo'shing:
> "Yoki har orderdan 15%, YOKI oyiga 300k + 5% — o'zingiz tanlang."
Ko'p sotadigan sotuvchi obunani tanlaydi (unga arzon), siz barqaror daromad olasiz.

Bu **gibrid model** — eng kuchli yo'l.

---

## 3. Har bo'lim qanday pul ishlaydi (aniq raqamlar bilan)

### 🚕 Taksi / 🚚 Yuk
Ikki variant — Uzbekistonда **ikkalasi ham mashhur**:
- **Komissiya:** har safardan 10-15% (Yandex modeli)
- **Haydovchi obunasi:** haydovchi haftiga/oyiga to'laydi, safarning 100% ni o'zida qoldiradi (inDrive / mahalliy modeli — haydovchilar buni yaxshi ko'radi)

> **Tavsiya:** haydovchilar uchun **obuna** ko'pincha yaxshiroq ishlaydi
> (haydovchilar komissiyani yoqtirmaydi). Lekin start uchun past komissiya osonroq.

### 🍔 Ovqat (restoranlar)
- **Komissiya:** har buyurtmadan 15-20% (restorandan)
- **Yetkazish haqi:** xaridordan 8-12k (kuryerga ketadi, siz ulush olasiz)

### 🛒 Market (do'konlar)
- **Komissiya:** 10-15% (do'konlar marjasi kamroq, shuning uchun pastroq)
- **Yetkazish haqi:** xaridordan

---

## 4. Pul oqimi — to'liq misol (Ovqat buyurtmasi)

```
Xaridor buyurtmasi:  50 000 so'm
   ├─ Taom narxi:    40 000
   └─ Yetkazish:     10 000

Taqsimot (15% komissiya):
   • Restoran:   40 000 − 6 000 (15%) = 34 000  → restoran balansi
   • Kuryer:     10 000 − 2 000 (20%) =  8 000  → kuryer balansi
   • PLATFORMA:   6 000 + 2 000        =  8 000  → sizning daromad

Restoran/kuryer balansdan kartasiga pul yechadi (payout).
```

**Bir oyda 1000 buyurtma × 8000 = 8 000 000 so'm daromad** (faqat misol).

---

## 5. Daromad modelini qanday quramiz (texnik)

Platformani **moslashuvchan** qilamiz — kelajakda model o'zgartirsangiz, kod
qayta yozilmasin:

```
vendors jadvali:
  pricing_model   — 'commission' | 'subscription' | 'hybrid'
  commission_rate — masalan 0.15 (15%)
  subscription_fee — masalan 300000 (oylik)

Har buyurtmada tizim vendor.pricing_model ga qarab hisoblaydi.
Admin paneldan har sotuvchi uchun alohida sozlanadi.
```

Shunday qilib: bugun komissiya, ertaga obuna — **bitta sozlama** o'zgaradi, kod emas.

---

## 6. Bosqichma-bosqich biznes rejasi

```
1-3 oy:   KOMISSIYA bilan start (past % — sotuvchi jalb qilish)
          + yetkazish haqi xaridordan
3-6 oy:   trafik o'sgach → obuna TANLOVINI qo'shish (gibrid)
6+ oy:    reklama (promoted), xaridor premium obunasi
```

---

## Xulosa (bir jumlada)

**Yangi bozor uchun komissiyadan boshlang** (sotuvchi/haydovchi faqat ishlaganda
to'laydi — qo'shilish oson). Tizimni **moslashuvchan** quramiz: har sotuvchi
uchun "komissiya yoki obuna yoki gibrid" admin paneldan sozlanadi. Hajm
o'sgach, obuna va reklama qo'shasiz. **Foizni hozir qat'iy belgilash shart
emas — sozlanadigan qilamiz.**
