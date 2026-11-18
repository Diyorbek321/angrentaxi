# Huquqni muhofaza qilish organlari so'rovi — ma'lumot berish tartibi

> ⚠️ QORALAMA — 2026-11-03. Yurist ko'rib chiqishi kerak (ayniqsa: qaysi
> organ qaysi asosda so'ray oladi, muddatlar, foydalanuvchini xabardor qilish
> taqiqi). Bog'liq: `docs/INCIDENT-POLICY.md` §6, maxfiylik siyosati
> (`/api/v1/legal/privacy`), "Shaxsga doir ma'lumotlar to'g'risida"gi qonun.

## 1. Asosiy qoida

**Faqat YOZMA so'rov.** Telefon, Telegram, og'zaki yoki "tanish orqali"
so'rovga hech qanday ma'lumot berilmaydi — hatto so'ragan odam o'zini
xodim deb tanishtirsa ham. Bunday holatda xushmuomalalik bilan rasmiy
xat yuborish so'raladi.

Yozma so'rovda bo'lishi shart:

- organ nomi, rasmiy blanka, chiquvchi raqam va sana;
- imzo va muhr (yoki elektron raqamli imzo — e-imzo / my.gov.uz orqali);
- huquqiy asos (jinoyat ishi / tekshiruv materiali raqami, qonun moddasi);
- **aniq** nima so'ralayotgani: kim (telefon raqami yoki buyurtma raqami),
  qaysi davr, qaysi ma'lumot turi;
- javob qayerga va kimga yuborilishi, mas'ul xodimning ism-sharifi va telefoni.

"Hamma haydovchilar ro'yxati" yoki "barcha safarlar" kabi chegarasiz
so'rovlar — aniqlashtirish uchun qaytariladi (yurist bilan kelishib).

## 2. Kim ko'rib chiqadi

| Rol | Vazifa |
|---|---|
| **Admin** (platforma egasi yoki u tayinlagan bitta mas'ul) | So'rovni qabul qiladi, haqiqiyligini tekshiradi, eksport qiladi |
| Yurist | Asosni va hajmni tasdiqlaydi (shubhali yoki keng so'rovda — majburiy) |
| Menejer | **Eksport qilmaydi.** So'rov menejerga kelsa — adminga uzatadi |

Haqiqiylikni tekshirish: so'rovdagi telefon raqamiga emas, organning
**rasmiy** (ochiq manbadagi) raqamiga qo'ng'iroq qilib, chiquvchi raqam
tasdiqlanadi.

## 3. Nima berilishi mumkin

Faqat so'ralgan shaxs, so'ralgan davr va so'ralgan tur — ortig'i yo'q.

| Ma'lumot turi | Manba (jadval) | Saqlanish muddati |
|---|---|---|
| Hisob: telefon, ism, ro'yxatdan o'tgan sana, holati | `users` | hisob faol bo'lgan davr |
| Haydovchi: F.I.Sh., JShShIR, avtomobil, davlat raqami, hujjatlar | `drivers`, `driver_documents` | qonunda belgilangan muddat |
| Safar/buyurtma: manzillar, vaqt, narx, ishtirokchilar | `orders`, `food_orders`, `market_orders` | o'chirilmaydi (moliyaviy yozuv) |
| To'lovlar va hamyon | `transactions`, `fiscal_receipts` | soliq talabi bo'yicha |
| GPS izi, chat, SOS, hodisa fotolari | taksometr izi, `trip_chat`, SOS, `incidents` | **180 kun** (ochiq hodisa — yopilgandan keyin 180 kun) |
| Oferta roziligi (qaysi tahrir, sana, IP) | `legal_acceptances` | o'chirilmaydi |

**Berilmaydi:** karta ma'lumotlari (bizda yo'q — to'lov tizimida),
parollar/tokenlar, so'rovga aloqasi yo'q boshqa foydalanuvchilar
ma'lumotlari, ichki xodimlar yozishmalari (alohida asos bo'lmasa).

Muddati o'tib o'chirilgan ma'lumot tiklanmaydi — javobda "saqlash
muddati tugagan, o'chirilgan" deb yoziladi.

## 4. Eksport tartibi

1. So'rov skanerlanib, ichki reyestrga yoziladi: kelgan sana, organ,
   chiquvchi raqam, so'ralgan shaxs, so'ralgan ma'lumot, mas'ul admin.
2. Admin ma'lumotni **faqat admin panel yoki admin hisobidagi SQL orqali**
   oladi; shaxsiy telefonga yoki messengerga ko'chirilmaydi.
3. Fayl: PDF yoki CSV, parol bilan arxivlanadi; parol alohida kanal
   orqali (masalan, telefon orqali mas'ul xodimga) beriladi.
4. Topshirish: kuryer orqali dalolatnoma bilan, yoki organning rasmiy
   elektron pochtasi / idoralararo tizimi orqali. Javob xatida nima
   berilgani ro'yxat bilan yoziladi.

## 5. Jurnal (audit)

Har bir eksport `audit_logs` ga yoziladi (amal: ma'lumot eksporti),
quyidagilar bilan:

- kim eksport qildi (admin id), qachon;
- so'rov reyestr raqami va organ;
- qaysi foydalanuvchi(lar) va qaysi ma'lumot turlari, qaysi davr;
- fayl nomi va topshirish usuli.

Reyestr va audit yozuvlari kamida **5 yil** saqlanadi (yurist bilan
tasdiqlash kerak). Menejer GPS izi yoki chatni ko'rishi ham audit logga
tushadi (`INCIDENT-POLICY.md` §4) — bu alohida, eksport emas.

> Texnik eslatma: hozircha alohida "huquq-tartibot eksporti" tugmasi
> yo'q — admin mavjud admin panel va audit log orqali ishlaydi. Agar
> so'rovlar soni oshsa, alohida eksport endpointi (avtomatik audit bilan)
> qilinadi.

## 6. Muddatlar

| Bosqich | Muddat |
|---|---|
| So'rovni reyestrga yozish va adminga yetkazish | 1 ish kuni |
| Haqiqiylikni tekshirish | 2 ish kuni |
| Javob berish | so'rovda ko'rsatilgan muddatda; ko'rsatilmagan bo'lsa — qonunda belgilangan muddatda (yurist aniqlaydi), lekin **10 ish kunidan** kechikmasdan |
| Shoshilinch (hayotga xavf, bedarak yo'qolgan odam) | rasmiy organ tasdiqlagach, **darhol** — yozma so'rov keyinroq rasmiylashtiriladi, bu ham reyestrga yoziladi |

Muddat ichida berib bo'lmasa (ma'lumot hajmi katta) — organga yozma
ravishda sababi va yangi sana bilan xabar beriladi.

## 7. Foydalanuvchini xabardor qilish

Qonun taqiqlamagan bo'lsa va tergovga zarar yetkazmasa — foydalanuvchiga
uning ma'lumoti rasmiy so'rov bo'yicha berilgani haqida xabar beriladi.
Organ yozma ravishda taqiqlagan bo'lsa — xabar berilmaydi, bu reyestrda
belgilanadi.

## 8. B reja

- Admin bo'lmasa (kasal, safarda): so'rov qabul qilinadi va reyestrga
  yoziladi, lekin eksport faqat admin qaytgach yoki egasi yozma tayinlagan
  o'rinbosar tomonidan. Organga muddat bo'yicha xabar beriladi.
- Server ishlamasa (`CONTINGENCY-PLAN.md`): eng so'nggi zaxira nusxadan
  (backup) olinadi va javobda ma'lumot qaysi sanadagi nusxadan ekani yoziladi.
