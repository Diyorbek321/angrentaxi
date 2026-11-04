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

Amalda (051): ulashish havolasi — tokenli ommaviy sahifa (`/share/:token`,
haydovchi ismi + bosh harf, mashina, manzil, holat, joylashuv faqat safar
davomida; telefon yo'q), safar tugagach `tripShareGraceMinutes` (30).
Telefon: `POST orders/:id/call` (accepted..in_progress, ishtirokchi, har
so'rov `order_call_logs` + audit). Eski APK (v21 va oldingi,
`X-Client-Features: call-relay` yo'q) raqamni faqat qo'ng'iroq oynasi ochiq
paytda oladi — `/call` beradiganidan ortiq emas, faqat jurnalsiz;
`APP_MIN_BUILD_*` ko'tarilgach bu yo'l yopiladi.

Posilka qabul qiluvchisi (054): kuryer raqamni ko'rmaydi — `details.recipientPhone`
o'rnida niqob (`+998 90 *** ** 33`), taklif paketida (socket, `current-offer`)
ham. Qo'ng'iroq: `POST orders/:id/call { target: 'recipient' }` — faqat
biriktirilgan kuryer, posilka, faol buyurtma; `order_call_logs.callee_type =
recipient` + audit. Yuboruvchi va xodim raqamni ko'radi. Eski APK faol buyurtmada
raqamni oladi (yuqoridagi darvoza), qolgan paytda niqob — satr bo'lib qoladi,
aks holda eski ilova posilka kartasini chizmaydi.

## 5. Taksi: bekor qilish, kelmaslik, uzilish

| Qoida | Standart |
|---|---|
| Bepul bekor qilish | qabuldan **2** daq ichida va haydovchi yetib kelmagan |
| Kech bekor qilish jarimasi (yo'lovchi) | **3 000** so'm → haydovchiga |
| Yo'lovchi chiqmadi | yetib kelgandan **5** daq keyin haydovchi belgilaydi, **5 000** so'm → haydovchiga |
| Jarima to'lanmasa | yo'lovchi qarzi (mavjud qarz mexanizmi) |
| Safar uzildi (avariya/buzilish) | shu nuqtagacha bo'lgan narx, yo'lovchiga yangi qidiruv |
| Haydovchi qabul qilgandan keyin bekor qildi | pul yo'q; kunda **3** (`driverCancelSignalCount`) → menejerga signal |

Amalda (052): jarima **to'liq haydovchiga, komissiyasiz**; haydovchi
CREDIT'i yo'lovchi to'lovi holatini oladi (qarz bo'lsa — PENDING, yig'ilmagan
pul sarflanadigan bo'lib yozilmaydi). Ilova jarimani tasdiqdan oldin
ko'rsatadi (`GET orders/:id/cancel-fee`), server ko'rsatilganidan kattasini
409 bilan qaytaradi; narxni ko'rsatmaydigan eski APK'dan jarima olinmaydi.
Uzilgan safar: taksometrda GPS izi, qat'iy narxda olish → uzilish nuqtasi
to'g'ri chizig'i tarif bo'yicha, qat'iy narxdan oshmaydi; avariyada
xavfsizlik hodisasi (avtomatik to'xtatishsiz).

## 6. Dalillarni saqlash

| Ma'lumot | Muddat |
|---|---|
| GPS izi, chat, SOS, hodisa fotolari | **180** kun, keyin o'chiriladi |
| Ochiq hodisaga bog'langanlari | hodisa yopilgandan keyin 180 kun |
| Moliyaviy yozuvlar | soliq talabi bo'yicha (o'chirilmaydi) |

Amalda (053): `EvidenceRetentionService`, har kuni 03:30 — GPS izi, chat,
yopilgan SOS (faoli qoladi), qo'ng'iroq jurnali, ulashish havolalari,
yopilgan hodisa fotolari; `evidenceRetentionDays` (180, kamida 30).

Huquqni muhofaza qilish organlari so'rovi: faqat yozma so'rov, admin
eksport qiladi, har eksport audit logga — `docs/legal/huquq-tartibot-sorovi.md`.

## 7. Yo'lovchi qarzini yopish

Qarz — PENDING hamyon DEBIT'i: hamyon yetmagan safar, rad etilgan naqd
yetkazish, kech bekor qilish / kelmaslik jarimasi, hodisa jarimasi. Yopilmaguncha
yangi buyurtma yo'q (`WALLET_DEBT_OUTSTANDING`, `details.amount`). Yagona joy —
`WalletDebtService`; hamma yo'l yo'lovchi hamyoni qulfi ostida, bitta
tranzaksiyada, shartli `pending →` o'tish bilan (takror/parallel chaqiruv hech
narsa yozmaydi), har qarz alohida audit.

| Yo'l | Kim | Daftar | Haydovchi oyoqlari |
|---|---|---|---|
| Karta to'ldirish | `markPaid` avtomatik | DEBIT → `completed` | ochiladi |
| Hamyondagi pul | yo'lovchi, `POST payments/wallet/debt/settle` | DEBIT → `completed` | ochiladi |
| Naqd olindi | menejer, `cash_received` | CREDIT naqd `wallet_debt_cash_<id>` + DEBIT → `completed`, qoldiq o'zgarmaydi | ochiladi |
| Kechirish | menejer, `write_off` | DEBIT → `refunded`, kirimsiz | ochiladi, **zarar platformada** |

Qoidalar:

- **Faqat haqiqiy pul:** `sarflanadigan − bonus`. Bonus qarzni yopmaydi — aks
  holda yechib bo'lmaydigan bonus haydovchiga yechiladigan pul bo'lib o'tardi.
- **Eskisidan boshlab**, qoplanmagani o'tkazib yuboriladi, keyingi kichigi yopiladi.
- **Kechirishda haydovchi baribir oladi:** u ishini qilgan, nizoni platforma
  yopdi. Komissiya odatdagidek ushlanadi. Hodisa jarimasida haydovchi oyog'i yo'q.
- **Menejer:** `Roles(MANAGER, ADMIN)` + `drivers_finance`, sabab majburiy,
  bir amalda `manualAdjustmentManagerLimit` (admin — cheklanmaydi), o'z qarzini
  yopa olmaydi. Panelda — buyurtma sahifasi.
- **Quyi chegara:** qarzda to'ldirish `min(walletTopupMin, yetishmagan summa)`
  dan — yo'lovchi pulni yecha olmaydi, ortig'i hamyonda qotib qolardi.
- **Ilova:** karta faqat `cardPaymentsAvailable` va `walletTopupEnabled` bo'lsa;
  aks holda `supportPhone`. Tugallangan qarz chekda `completed`, kechirilgani
  `refunded`, ikkalasida to'lanmagan summa 0.

## Migratsiya raqamlari (bosqichlar to'qnashmasin)

047 karta to'lovi · 048 oferta roziligi · 049 yetkazish hodisalari ·
050 incidents · 051 xavfsizlik · 052 taksi jarimalari · 053 saqlash muddati ·
054 qarzni yopish, qo'ng'iroq turi
