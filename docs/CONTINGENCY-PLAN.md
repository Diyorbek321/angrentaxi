# Favqulodda holatlar rejasi (A / B / C)

> Qoida: har bir muhim qism uchun **qanday bilamiz → A reja → B reja →
> oxirgi chora** oldindan yozilgan bo'ladi. Yangi xizmat yoki funksiya
> qo'shilganda — shu jadvalga qator qo'shiladi. Yiliga emas, **oyiga bir
> marta** mashq (§ Mashqlar).

Holat belgisi: ✅ tayyor va sinalgan · ⚠️ qisman / qo'lda · ❌ yo'q (bo'shliq — § Bo'shliqlar).

---

## 1. Server (Oracle Free VM) o'chdi yoki Oracle hisobni yopdi

| | |
|---|---|
| **Belgi** | Telegram alert (3 marta ketma-ket xato) · tashqi uptime monitor ❌ — VM o'zi o'lsa, VM ichidagi monitor xabar bera olmaydi |
| **A** | `ssh` → `docker compose ps` → `deploy.sh --rollback` (oxirgi ishlagan versiya, qayta build'siz) ✅ |
| **B** | Boshqa hostga ko'chish: istalgan Docker hosti (Hetzner ~5 €/oy, boshqa Oracle region). `deploy/oracle/README.md` §1–9 o'sha skriptlar bilan; baza — R2'dagi oxirgi backup'dan `restore.sh r2:...` ✅ |
| **Oxirgi chora** | Texnik ishlar rejimi (maintenance) + dispetcher telefon orqali buyurtma qabul qiladi |
| **Muhim** | Mobil ilova API manzili build'ga yozilgan. **Haqiqiy domen** bo'lmasa, host o'zgarganda yangi APK kerak bo'ladi. Haqiqiy domen + DNS → host almashsa faqat A-yozuv o'zgaradi. |

## 2. Baza (PostgreSQL) buzildi / ma'lumot yo'qoldi

| | |
|---|---|
| **Belgi** | `/health/ready` xato · backend 5xx · Sentry |
| **A** | Har kuni 03:30 backup (shifrlangan, R2'da) + har deploy oldidan backup ✅ |
| **B** | `restore.sh --drill` bilan tekshirilgan nusxadan tiklash; tiklashdan oldin joriy holat ham saqlanadi ✅ |
| **Bo'shliq** | Backup xato bersa **alert yo'q** ❌ · mashq qo'lda ⚠️ |
| **Yo'qotish chegarasi** | Eng ko'pi bilan 1 kunlik ma'lumot (kunlik backup). Kamaytirish: backup'ni kuniga 2–4 marta |

## 3. Redis o'chdi

| | |
|---|---|
| **Ta'sir** | Haydovchi topilmaydi, joylashuv yangilanmaydi — **taksi ishlamaydi** |
| **Belgi** | `/health/ready` (Redis tekshiradi) |
| **A** | `restart: unless-stopped` konteynerni qayta ko'taradi; AOF bilan ma'lumot saqlanadi ✅ |
| **B** | Backend Redis'ga o'zi qayta ulanadi — **hozir 10 urinishdan keyin taslim bo'ladi** ❌ (§ Bo'shliqlar #1) |
| **Oxirgi chora** | `docker compose restart backend` |

## 4. SMS (Eskiz) ishlamayapti — hech kim kira olmaydi

| | |
|---|---|
| **Ta'sir** | Yangi kirish/ro'yxatdan o'tish to'xtaydi. Kirgan foydalanuvchilar ishlashda davom etadi |
| **Belgi** | `/auth/send-otp` 5xx · foydalanuvchi shikoyati |
| **A** | Eskiz (401 da bir marta qayta login) ⚠️ |
| **B** | Ikkinchi SMS provayder (Playmobile / SMS.uz) ❌ |
| **Oxirgi chora** | `OTP_BYPASS_PHONES` ro'yxati — faqat ma'lum raqamlar (haydovchilar, xodimlar) ✅ |
| **Bo'shliq** | Eskiz sozlanmagan bo'lsa prod'da ham "SMS yuborildi" deb **yolg'on** muvaffaqiyat qaytaradi ❌ |

## 5. Push (Firebase) ishlamayapti

| | |
|---|---|
| **Ta'sir** | Ilova fonda bo'lsa xabarlar kelmaydi |
| **A** | FCM ✅ |
| **B** | Ilova ochiq bo'lsa — socket; yo'lovchi ilovasi har 10 s so'raydi (polling) ✅ |
| **Haydovchi taklifi** | Socket orqali keladi; socket qayta ulanganda va ilova fondan qaytganda `GET /orders/offer/current` dan tiklanadi (qolgan soniyalar bilan) ✅. Bu so'rov ham ishlamasa — avvalgidek socket kutiladi |

## 6. Marshrut (OSRM) / xarita

| | |
|---|---|
| **OSRM o'chsa** | Narx to'g'ri chiziq bo'yicha (arzonroq), xaritada to'g'ri chiziq, haydovchilar havo masofasi bo'yicha. **Taksi ishlaydi** ✅ |
| **Xarita (MapTiler) o'chsa** | Mobil: Angren shahri oflayn saqlangan ✅. Dispetcher paneli: xarita bo'sh ⚠️ |
| **B (xarita)** | O'z serverimizdagi PMTiles (`scripts/tiles-build.sh`) — build vaqtida yoqiladi ⚠️ |
| **Manzil qidiruv** | Telefonning o'z geokoderi; ishlamasa — xaritada nuqta tanlash ✅ |

## 7. To'lov provayderi (Payme / Click / Uzcard) ishlamayapti

| | |
|---|---|
| **Ta'sir** | Hamyonni to'ldirish to'xtaydi. **Naqd safar ishlaydi** |
| **A** | Uch provayder — biri o'chsa, boshqasi bilan to'ldirish ✅ (shartnomalar ochiq) |
| **B** | Admin `walletTopupEnabled` ni o'chiradi; haydovchiga qo'lda balans tuzatish (izoh va audit bilan) ✅ |
| **Osilgan to'lov** | 12 soatdan keyin avtomatik bekor; kech kelgan callback baribir qabul qilinadi ✅ |
| **Bo'shliq** | Provayder so'rovlarida timeout yo'q ❌ · admin uchun "to'ldirishni qo'lda tasdiqlash" yo'q ⚠️ |
| **Pul yechish osilib qolsa** | `LEGAL-COMPLIANCE.md` §27.6 ✅ |

## 8. Fiskal chek (OFD) ishlamayapti

| | |
|---|---|
| **Ta'sir** | Safar ishlaydi; cheklar FAILED bo'lib to'planadi |
| **A** | Hozircha `noop` (OFD kalitlari yo'q) |
| **B** | Paneldan "qayta urinish" (50 tadan) ⚠️ — avtomatik qayta urinish yo'q |

## 9. Fayl saqlash (R2) ishlamayapti

| | |
|---|---|
| **Ta'sir** | Haydovchi hujjat yuklay olmaydi, rasmlar ko'rinmaydi. Safar ishlaydi |
| **B** | `STORAGE_DRIVER=local` + eski volume (ko'chishdan oldingi nusxa saqlangan) ✅ |

## 10. Haydovchi yetishmaydi (biznes xavfi)

| | |
|---|---|
| **Belgi** | "Haydovchi topilmadi" ro'yxati (dispetcher paneli) · surge ko'tariladi |
| **A** | Qidiruv 2→3→5 km, 3 daqiqa; topilmasa yo'lovchiga xabar ✅ |
| **B** | Dispetcher ro'yxatdan qo'ng'iroq qilib, qo'lda biriktiradi ✅ |
| **C** | Smena pasi chegirmasi / bonus qoidasi bilan haydovchilarni shu soatlarga chaqirish; tarmoqdagi taksi parklari bilan kelishuv ⚠️ |

## 11. Pul va firibgarlik

| | |
|---|---|
| **Bonus/referal suiiste'moli** | Bonus yechib olinmaydi; referal menejer tasdig'idan keyin ✅ |
| **Haydovchi qarzga botdi** | Manfiy balansda avtomatik oflayn ✅ |
| **Noto'g'ri pul harakati** | Qo'lda tuzatish (menejer ≤2M, admin ≤5M, audit log) ✅ |
| **Karta to'lovi qaytarildi** | Haydovchi ulushi avtomatik qaytarib olinadi ✅ |

## 12. Huquqiy

| | |
|---|---|
| **Litsenziyasiz haydovchi** | Hujjat tekshiruvisiz taklif olmaydi (sozlama) ✅ |
| **Soliq so'rovi** | Oylik soliq hisoboti (1% ushlov) paneldan ✅ |
| **Ochiq** | OFD, Payme/Click shartnomalari, yurist tekshiruvi — `LEGAL-COMPLIANCE.md` |

## 13. Odam omili — Diyorbek bir necha kun yo'q

| | |
|---|---|
| **Xavf** | Server, parol, to'lov va pul yechish faqat bitta odamda |
| **B** | Ishonchli ikkinchi odam: admin roli + yozma ko'rsatma (shu hujjat) + favqulodda kirish ma'lumotlari muhrlangan konvertda / parol menejerida ⚠️ |
| **Minimal** | Pul yechish so'rovlari kutib turadi (pul yo'qolmaydi); safar va naqd to'lov ishlayveradi |

---

## Bo'shliqlar — B reja hali amalda ishlamaydigan joylar

| # | Bo'shliq | Xavf | Kim | Holat |
|---|---|---|---|---|
| 1 | Backend Redis'ga qayta ulanishdan taslim bo'ladi | Yuqori — taksi to'xtaydi | kod | ✅ tuzatildi |
| 2 | Monitoring faqat "tirikmi"ni tekshiradi, "tayyormi"ni emas (Redis/DB o'chsa ham "sog'lom") | Yuqori | kod | ✅ tuzatildi |
| 3 | Backup xato bersa xabar yo'q | Yuqori | kod | ✅ tuzatildi |
| 4 | Haydovchi taklifi socket qayta ulanganda tiklanmaydi | O'rta | kod (mobil + API) | ✅ tuzatildi |
| 5 | Eskiz sozlanmagan bo'lsa prod'da yolg'on "SMS yuborildi" | O'rta | kod | ✅ tuzatildi |
| 6 | Eskiz 401 qayta urinishida jo'natuvchi nomi qattiq yozilgan | Past | kod | ✅ tuzatildi |
| 7 | To'lov provayderi so'rovlarida timeout yo'q | O'rta | kod | ✅ tuzatildi |
| 8 | Tashqi uptime monitor yo'q (VM o'lsa hech kim bilmaydi) | Yuqori | **siz**: UptimeRobot (bepul) → `https://api.<domen>/api/v1/health/ready`, Telegram | ochiq |
| 9 | Telegram alert o'zgaruvchilari bo'sh — alertlar hech qayerga bormaydi | Yuqori | **siz**: bot token + chat id → `.env.prod` | ochiq |
| 10 | Haqiqiy domen yo'q — host almashsa yangi APK kerak | O'rta | **siz** | ochiq |
| 11 | Ikkinchi SMS provayder | O'rta | shartnoma + kod | ochiq |
| 12 | Ikkinchi odam uchun favqulodda kirish | O'rta | **siz** | ochiq |
| 13 | Fiskal cheklarni avtomatik qayta urinish | Past (OFD hali yo'q) | kod | OFD bilan birga |

## Mashqlar (oyiga bir marta, ~30 daqiqa)

1. `restore.sh --drill` — backup haqiqatan tiklanadimi.
2. `docker compose stop redis` (kechasi, 1 daqiqa) → alert keldimi, backend o'zi tiklandimi.
3. Telegram alertni sinash: backend'ni 3 daqiqaga to'xtatish.
4. `deploy.sh --rollback` va qaytib oldinga.
5. Shu hujjatni ko'rib chiqish: yangi xizmat qo'shildimi? Har biriga B reja bormi?
