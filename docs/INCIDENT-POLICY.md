# Hodisalar siyosati — nizo, shikoyat, yo'qolish, rad etish

2026-11-03. Texnik favqulodda holatlar — `CONTINGENCY-PLAN.md`; bu hujjat
**odamlar orasidagi** hodisalar uchun: shikoyat, qo'pollik, o'g'irlik, rad
etish, buzilgan tovar, narx nizosi.

⚠️ Barcha raqamlar — **standart qiymat**, egasi tasdiqlamagan. Har biri
`platform_settings` da, admin paneldan o'zgartiriladi. Kodda raqam
qotirilmaydi.

## Tamoyillar

1. **Platforma — vositachi.** Pul va javobgarlik qoidalari ofertada yoziladi
   (6-bosqich). Kompensatsiya — chegaralangan, sabab bilan, audit logda.
2. **Har bir pul harakati — sabab + audit.** Qo'lda qaytarish, jarima,
   kompensatsiya: `audit_logs` + ledger qatori, bir tranzaksiyada.
3. **Dalil buyurtmaga bog'lanadi.** Menejer nizoli buyurtmada iz, chat,
   SOS, baho, foto — hammasini bitta sahifada ko'radi.
4. **Avtomatik jazo yo'q, avtomatik signal bor.** Tizim belgilaydi, odam
   (menejer) qaror qiladi. Istisno: to'lanmagan kartali buyurtma muddati.

## 1. Kartali buyurtma (food/market) — to'lovdan oldin sotuvchiga ketmaydi

| Qoida | Standart |
|---|---|
| Karta provayderi sozlanmagan bo'lsa | karta tanlovi yashirin, server rad etadi |
| To'lanmagan kartali buyurtma sotuvchida | "To'lov kutilmoqda" — qabul qilib bo'lmaydi |
| To'lanmagan buyurtma avtomatik bekor | `cardPaymentTimeoutMinutes` = **15** |
| Sotuvchiga karta tushumi | faqat COMPLETED karta to'lovi bo'lsa |

## 2. Yetkazish hodisalari

| Qoida | Standart |
|---|---|
| Topshirish kodi | parcel + food + market, 4 raqam, 5 urinish |
| Posilka qiymati (majburiy) | `parcelMaxDeclaredValue` = **1 000 000** so'm |
| Taqiqlangan narsalar | pul, hujjat, qurol, dori, alkogol, tirik hayvon, giyohvand — ro'yxat ilovada, buyurtmada tasdiq |
| Manzilda bepul kutish | `dropoffFreeWaitMinutes` = **5**, keyin tarif kutish narxi |
| "Yetkazib bo'lmadi" (mijoz yo'q/rad etdi) | kuryer kutish tugagach belgilaydi → qaytarish |
| Rad etgan mijoz to'laydi | yetkazish haqi + qaytarish = yetkazish haqining **50%** (`returnFeePercent`) |
| Kuryer do'konga oldindan to'lagan pul | tovar do'konga qaytgach (do'kon tasdiqlaydi) kuryerga qaytariladi |
| Rad etgan mijoz | 30 kunda **2** rad → naqd buyurtma o'chiriladi (`refusalCashBlockCount`) |
| "Osilib qolgan" yetkazish signali | IN_PROGRESS > **60** daq yoki kuryer joylashuvi > **10** daq eski |

## 3. Shikoyat va hodisa (yagona `incidents`)

- Kim: yo'lovchi/mijoz, haydovchi/kuryer, do'kon, menejer (o'zi ochadi).
- Sabab ro'yxati: qo'pollik, xavfli haydash, aylanma yo'l, ortiqcha narx,
  chekish, iflos mashina, bezorilik/ta'qib, mast yo'lovchi, mashinaga zarar,
  to'lamadi, kelmadi, buzilgan tovar, noto'g'ri/kam tovar, sovuq ovqat,
  yuk yo'qoldi, boshqa. Ixtiyoriy foto (≤ 3), matn.
- Muddat: safardan keyin **7 kun**.
- Holat: `open → investigating → resolved | rejected`.
- Natija (bir yoki bir nechta): ogohlantirish, vaqtincha to'xtatish, blok,
  mijozga qaytarish, haydovchiga kompensatsiya, jarima, harakatsiz.
- Kompensatsiya chegarasi — mavjud `manualAdjustmentManagerLimit`.

### Jarima zinapoyasi (haydovchi/kuryer, 90 kunlik oyna)

| Tasdiqlangan shikoyat | Natija |
|---|---|
| 1 | ogohlantirish (push + ilovada) |
| 3 | **3 kun** to'xtatish (`suspensionDays`) |
| 5 | blok (admin ko'rib chiqadi) |
| bezorilik / ta'qib / xavfsizlik | darhol to'xtatish, admin qaror qiladi |

Reyting signali: oxirgi **20** bahoning o'rtachasi < **4.3** → menejer navbatiga.
Haydovchining yo'lovchiga bahosi endi yo'lovchi profilida (o'rtacha) saqlanadi.

## 4. Xavfsizlik

- SOS — socket orqali **darhol**, ovoz bilan, panel ochiq bo'lsa.
- SOS yopishda izoh majburiy, kim yopgani yoziladi.
- Telefon raqamlar yashiriladi: taksida tomonlar bir-birining raqamini
  ko'rmaydi, faqat ilova orqali qo'ng'iroq (server faol buyurtma bo'lsa
  raqamni beradi va har chaqiruvni yozadi). B reja: Eskiz/operator orqali
  virtual raqam.
- Menejer nizoli buyurtmada GPS izi va chatni ko'radi (har ko'rish audit).

## 5. Taksi: bekor qilish, kelmaslik, uzilish

| Qoida | Standart |
|---|---|
| Bepul bekor qilish | qabuldan **2** daq ichida va haydovchi yetib kelmagan |
| Kech bekor qilish jarimasi (yo'lovchi) | **3 000** so'm → haydovchiga |
| Yo'lovchi chiqmadi | yetib kelgandan **5** daq keyin haydovchi belgilaydi, **5 000** so'm → haydovchiga |
| Jarima to'lanmasa | yo'lovchi qarzi (mavjud qarz mexanizmi) |
| Safar uzildi (avariya/buzilish) | shu nuqtagacha bo'lgan narx, yo'lovchiga yangi qidiruv |

## 6. Dalillarni saqlash

| Ma'lumot | Muddat |
|---|---|
| GPS izi, chat, SOS, hodisa fotolari | **180** kun, keyin o'chiriladi |
| Ochiq hodisaga bog'langanlari | hodisa yopilgandan keyin 180 kun |
| Moliyaviy yozuvlar | soliq talabi bo'yicha (o'chirilmaydi) |

Huquqni muhofaza qilish organlari so'rovi: faqat yozma so'rov, admin
eksport qiladi, har eksport audit logga — `docs/legal/huquq-tartibot-sorovi.md`.

## Migratsiya raqamlari (bosqichlar to'qnashmasin)

047 karta to'lovi · 048 oferta roziligi · 049 yetkazish hodisalari ·
050 incidents · 051 xavfsizlik · 052 taksi jarimalari · 053 saqlash muddati
