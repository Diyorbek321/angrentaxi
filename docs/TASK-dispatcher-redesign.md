# TASK: Dispetcher panelini qayta dizayn qilish (web-manager)

**Repo:** `github.com/Diyorbek321/angrentaxi`
**Papka:** `web-manager/` — boshqa papkalarga tegilmaydi
**Taxminiy hajm:** ~4200 qator UI kodi, 13 ta sahifa + layout
**Muddat:** kelishilgan holda

---

## 1. Kontekst — nima uchun bu ish kerak

Angren Taxi — Angren shahri uchun ride-hailing platformasi (Yandex Go / Bolt modeli).
Backend NestJS'da, mobil ilova Flutter'da, 4 ta web panel Next.js'da.

`web-manager` — bu **dispetcher paneli**. Alohida "dispatcher" roli yo'q: backendda
rollar `passenger | driver | manager | admin | market | restaurant`. Panelga `manager`
yoki `admin` roli bilan kiriladi, kirgandan keyin `/dispatch` ga tushadi.

**Muammo:** panel hozir **sariq `#FACC15` + to'q ko'k (navy) `#080D1A`** rangida,
faqat dark rejim, navigatsiya yuqorida gorizontal. Lekin loyihaning qolgan qismi —
mobil ilova va super-app UI — **mint yashil `#1FCA8E`** ga o'tkazilgan
(`mobile/lib/core/config/app_theme.dart`). Ya'ni panel brenddan ajralib qolgan.

Repoda buning uchun tayyor spetsifikatsiya bor: **`dashboard_design_prompts.md`,
1-bo'lim "Dispatcher Dashboard"** (25–125-qatorlar). Bu task o'sha hujjatni
amalga oshirish haqida.

> ⚠️ `dashboard_design_prompts.md` da UI matnlari **inglizcha** deb yozilgan.
> **Bu task uchun bu qoida bekor qilinadi — barcha UI matnlari o'zbekcha bo'lishi kerak**
> (9-bo'limdagi lug'atga qarang). Qolgan hamma narsa o'sha hujjat bo'yicha.

---

## 2. Maqsad

Dispetcher panelini mint dizayn tizimiga to'liq o'tkazish: ranglar, layout, komponentlar,
light/dark rejim va o'zbek tilidagi interfeys. **Funksionallik o'zgarmaydi** — bu vizual
va UX qayta ishlash, yangi biznes-logika emas.

---

## 3. Dizayn tizimi (majburiy)

### Ranglar

| Nima | Qiymat |
|---|---|
| Asosiy (primary / CTA) | `#1FCA8E` |
| Primary dark | `#10A064` |
| Primary light | `#27D89B` |
| Matn (ink) | `#0F1B22` |
| Fon — light | `#F4F7F8` |
| Fon — dark | `#0B1210` |

**Status ranglari:**
`created` = kulrang, `searching` = amber, `accepted` = ko'k, `arrived` = mint och,
`in_progress` = mint, `completed` = to'q yashil, `cancelled` = qizil.

**Muhim qoida:** amber/to'q sariq rang **faqat "qo'lda aralashuv" (manual override)**
uchun ishlatiladi. Mint = tizim avtomatik qilyapti, amber = odam aralashdi. Bu ikkisi
vizual jihatdan aniq farq qilishi kerak.

### Shrift
- Asosiy matn: **Manrope** (allaqachon ulangan — `--font-manrope`)
- Raqamlar, ID, narx, vaqt: **JetBrains Mono** (`--font-jetbrains-mono`)

### Layout
- **Chap sidebar** (yig'iladigan/collapsible) — hozirgi yuqoridagi gorizontal nav o'rniga.
  Hozirgi nav 13 ta element bilan `lg` dan pastda faqat ikonkaga siqilib ketadi
  (`layout.tsx:112-131`) — sidebar bu muammoni hal qiladi.
- **Yuqori header:** shahar bo'yicha aktiv buyurtmalar soni (live badge), onlayn haydovchilar
  soni, "Istisnolar" badge'i (0 dan katta bo'lsa qizil bo'lib pulsatsiya qiladi), qidiruv,
  bildirishnoma qo'ng'irog'i, operator profili, **light/dark toggle**.
- **Light va dark — ikkalasi ham** ishlashi kerak. Hozir faqat dark
  (`globals.css:7` da `color-scheme: dark` qattiq yozilgan).
- Desktop-first. Planshetda buzilmasin. Mobil layout shart emas — bu ichki xodim vositasi.

---

## 4. Qamrov — 13 ta sahifa

Hammasi qayta dizayn qilinadi. Ustuvorlik tartibi shu (yuqoridagilar muhimroq):

| # | Sahifa | Fayl | Nima qiladi |
|---|---|---|---|
| 0 | **Layout** | `src/app/dispatch/layout.tsx` | Sidebar + header + RBAC nav filtri |
| 1 | **Live Dispatch** | `src/app/dispatch/page.tsx` | Asosiy ekran — aktiv buyurtmalar + onlayn haydovchilar/xarita |
| 2 | **Istisnolar** | `src/app/dispatch/exceptions/page.tsx` | Haydovchi topilmagan buyurtmalar + SOS signallari |
| 3 | **Buyurtmalar** | `src/app/orders/page.tsx`, `src/app/orders/[id]/page.tsx` | Jadval + detal sahifa |
| 4 | **Buyurtma yaratish** | `src/app/create-order/page.tsx` | Call-center uchun qo'lda buyurtma |
| 5 | **Haydovchilar** | `src/app/dispatch/drivers/page.tsx` | Ro'yxat, tasdiqlash, komissiya, tarif darajasi |
| 6 | **Overview** | `src/app/dispatch/overview/page.tsx` | Umumiy statistika |
| 7 | **Audit log** | `src/app/dispatch/audit-log/page.tsx` | Qo'lda aralashuvlar tarixi |
| 8 | **Smena hisoboti** | `src/app/dispatch/shift-report/page.tsx` | Operator smenasi statistikasi |
| 9 | **Moliya** | `src/app/dispatch/finance/page.tsx` | Pul yechish so'rovlari |
| 10 | **Tariflar** | `src/app/dispatch/tariffs/page.tsx` | Tarif o'zgartirish so'rovlari |
| 11 | **Promo kodlar** | `src/app/dispatch/promo-codes/page.tsx` | Promo kod boshqaruvi |
| 12 | **Bonuslar** | `src/app/dispatch/bonuses/page.tsx` | Haydovchi bonus qoidalari |
| 13 | **Qo'llab-quvvatlash** | `src/app/dispatch/support/page.tsx` | Murojaatlar |

Har bir sahifada quyidagilar bo'lishi shart: **yuklanish holati (skeleton), bo'sh holat
(empty state), xato holati**. Hozir ba'zi joylarda bular yo'q yoki oddiy matn.

---

## 5. Asosiy ekran — Live Dispatch (eng muhim)

**Kontekst — bu butun dizaynni belgilaydi:** haydovchi tayinlash **to'liq avtomatik**.
Matching servis GPS bo'yicha eng yaqin onlayn haydovchini topadi, taklif qiladi, 15 soniya
kutadi, rad etilsa yoki javob bo'lmasa keyingisiga o'tadi — odam aralashuvisiz.

**Dispetcherning ishi — haydovchi tayinlash EMAS.** Uning ishi: (1) tizim holatini
kuzatish, (2) algoritm hal qila olmagan istisnolarni hal qilish (haydovchi topilmadi,
SOS, mashina buzildi, mijoz shikoyati). Qo'lda tayinlash bor, lekin **faqat sabab talab
qilinadigan ataylab qilingan override sifatida** — hech qachon har bir buyurtmadagi
asosiy tugma sifatida emas.

Shuning uchun:

**Chap panel — buyurtmalar oqimi (asosan READ-ONLY):**
- Har bir karta: buyurtma ID, mijoz ismi/telefoni, olib ketish/tashlab ketish manzili,
  xizmat turi ikonkasi (taxi/cargo), status badge, tayinlangan haydovchi (avatar + ism + reyting)
- `searching` holatida — **progress indikatori** ("3 tadan 2-haydovchiga taklif qilinmoqda...")
  — operator algoritmni **ko'rib turishi** kerak, ko'r-ko'rona kutmasligi
- Filtr tablari: Hammasi / Qidirilmoqda / Tayinlangan / Yo'lda / Yakunlangan
- Kartani bosganda **read-only detal drawer** ochiladi: mijoz tarixi, narx tafsiloti,
  qaysi haydovchilarga qanday tartibda taklif borgani, vaqt belgilari.
  **Bu yerda "tayinlash" tugmasi YO'Q.**

**O'ng panel — jonli xarita:**
- Barcha onlayn haydovchilar mint mashina ikonkasi bilan; band bo'lganlar kulrang
- Tanlangan buyurtma uchun olib ketish/tashlab ketish nuqtalari va marshrut chizig'i
- Xarita ustida suzuvchi panel: shahar bo'yicha zichlik statistikasi (band/bo'sh nisbati)

Hozirgi kodda xarita allaqachon bor (`DriverMap.tsx` + Leaflet) va ro'yxat/xarita
almashtirgichi ishlaydi (`page.tsx:172-195`) — buni saqlab qolib, dizaynini yangilash kerak.

---

## 6. Istisnolar sahifasi — dispetcherning haqiqiy ish ro'yxati

Bu oddiy buyurtmalar jadvali emas. Ikki bo'lim:
1. **"Haydovchi topilmadi"** — matching servis qidiruv oynasidan keyin taslim bo'lgan buyurtmalar
2. **"SOS / Xavfsizlik"** — panik signallari, qizil rangda, doim eng tepada

Har bir karta: nima bo'lgani, qancha vaqtdan beri hal qilinmagani, va bir bosishli
amallar: **"Mijozga qo'ng'iroq"**, **"Qo'lda aralashuv"** (override oqimini ochadi),
**"Hal qilindi"**.

Sidebar'dagi shu sahifaning badge soni — operator butun smena davomida kuzatadigan raqam.

**Bo'sh holat muhim:** bo'sh Istisnolar sahifasi — bu **yaxshi, normal** holat.
Uni xotirjam/ijobiy qilib dizayn qiling (masalan ✓ belgisi + "Istisnolar yo'q —
hammasi avtomatik ishlayapti"), "nimadir yetishmayapti" degan taassurot bermasin.

---

## 7. Qo'lda aralashuv (Manual Override) oqimi

Faqat Istisnolar sahifasidan yoki allaqachon tayinlangan buyurtmadagi ataylab
"Aralashuv" tugmasidan ochiladi.

- Modal/drawer: buyurtma xulosasi → **majburiy sabab maydoni** (erkin matn, minimum ~5 belgi)
  → haydovchi tanlagich (ism/raqam/telefon bo'yicha qidiruv, faqat onlayn va bo'sh haydovchilar)
- **Sabab kiritilmaguncha yuborish tugmasi o'chiq turadi** — har bir aralashuv audit logga yoziladi
- Amber urg'u + "Qo'lda aralashuv" yorlig'i bilan oddiy amallardan vizual ajralib tursin

Backend allaqachon shunga moslashgan: `assignDriver(orderId, driverId, reason)` va
`reassignDriver(orderId, driverId, reason)` — `reason` parametri majburiy
(`src/lib/api.ts:307`, `:323`). Hozirgi `AssignDriverModal.tsx` da bu bor — logikani
buzmang, faqat dizaynini yangilang.

---

## 8. RBAC — ruxsatlar tizimi (buzilmasligi shart)

Panelni `manager` akkauntlar ishlatadi va **har bir manager har bir sahifani ko'ra olmaydi**.
Sidebar `GET /users/me` dan keladigan `permissions: string[]` massivi bo'yicha filtrlanadi.

Hozirgi mantiq `layout.tsx:35-49` va `:84-86` da:
- Har bir nav elementida `perm` maydoni bor (masalan `dispatch`, `drivers_view`,
  `tariffs_manage`, `promo_manage`, `bonuses_view`, `support_manage`, `withdrawals_view`)
- `perm: null` — har doim ko'rinadi (Overview, Shift Report)
- `admin` roli hamma narsani ko'radi, filtr unga qo'llanilmaydi
- Ruxsati yo'q element **butunlay yashiriladi**, o'chirilgan (disabled) holda emas

**Talab:** agar akkauntda faqat `dispatch` ruxsati bo'lsa, sidebar'da atigi bir nechta
element qoladi — shunda ham **sidebar buzilgan ko'rinmasligi kerak**, chiroyli ko'rinsin.
Buni albatta sinab ko'ring.

---

## 9. Til — UI matnlari o'zbekcha

Hozir aralash: ko'p joyi inglizcha ("Live Dispatch", "Active Orders", "Searching"),
ba'zi joyi o'zbekcha ("Ro'yxat", "Xarita"). **Hammasi o'zbekchaga o'tkaziladi.**

Terminlar lug'ati (shundan chetlanmang, izchillik muhim):

| Inglizcha | O'zbekcha |
|---|---|
| Live Dispatch | Jonli dispetcher |
| Active Orders | Aktiv buyurtmalar |
| Online Drivers | Onlayn haydovchilar |
| Exceptions | Istisnolar |
| Orders | Buyurtmalar |
| Create Order | Buyurtma yaratish |
| Drivers | Haydovchilar |
| Audit Log | Amallar tarixi |
| Shift Report | Smena hisoboti |
| Finance | Moliya |
| Tariffs | Tariflar |
| Promo Codes | Promo kodlar |
| Bonuses | Bonuslar |
| Support | Qo'llab-quvvatlash |
| Overview | Umumiy ko'rinish |
| Manual Override | Qo'lda aralashuv |
| Searching | Qidirilmoqda |
| Accepted | Qabul qilindi |
| Arrived | Yetib keldi |
| In Progress | Yo'lda |
| Completed | Yakunlandi |
| Cancelled | Bekor qilindi |
| Available | Bo'sh |
| Busy | Band |
| Refresh | Yangilash |
| Logout | Chiqish |

Status matnlari `src/lib/constants.ts:36-44` (`ORDER_STATUS_LABELS`) da markazlashgan —
tarjimani **faqat shu yerdan** qiling, sahifalarga tarqatmang.

**Pul:** "125 000 so'm" ko'rinishida (probel bilan ajratilgan, `so'm` kichik harflarda).
**Sana/vaqt:** `date-fns` allaqachon ulangan, o'zbek lokalini ishlating.

---

## 10. Texnik cheklovlar — BULARGA TEGMANG

Bu **faqat UI** taski. Quyidagilar o'zgarmaydi:

| Tegmang | Sabab |
|---|---|
| `src/lib/api.ts` — funksiya imzolari, interfeyslar | Backend bilan shartnoma. Yangi maydon kerak bo'lsa avval so'rang. |
| `src/hooks/*.ts` (`useActiveOrders`, `useOnlineDrivers`, `useSocket`, `useSupportThreads`) | Real-time mantiq. Faqat qaytargan ma'lumotini boshqacha ko'rsating. |
| `src/lib/socket.ts`, `src/lib/auth.ts` | WebSocket va token boshqaruvi. |
| `backend/`, `mobile/`, `web-admin/`, `web-market/`, `web-restaurant/` | Bu task doirasidan tashqarida. |

**Ruxsat etiladi va kutiladi:** `src/components/ui/*` ni to'liq qayta yozish
(Button, Card, Badge, Input, Select, Modal), `src/components/dispatch/*` ni qayta yozish,
`tailwind.config.js` va `globals.css` ni yangilash, yangi komponentlar qo'shish.

**Hydration ogohlantirishi:** `layout.tsx:60-69` dagi izohga e'tibor bering —
`localStorage` faqat `useEffect` ichida o'qiladi, render tanasida emas. Theme toggle
qo'shganda ham **aynan shu tuzoq bor** — dark/light holatini render paytida
`localStorage` dan o'qisangiz hydration mismatch chiqadi. `next-themes` ishlatish
yoki `useEffect` orqali qo'lda hal qilish kerak.

---

## 11. Lokal ishga tushirish

```bash
git clone git@github.com:Diyorbek321/angrentaxi.git
cd angrentaxi/web-manager
npm install

# .env.local fayl yarating:
cat > .env.local <<'EOF'
NEXT_PUBLIC_API_URL=https://angrentaxi-production.up.railway.app/api/v1
NEXT_PUBLIC_SOCKET_URL=https://angrentaxi-production.up.railway.app
EOF

npm run dev     # http://localhost:3002
```

Backend allaqachon ishlab turibdi (Railway'da) — lokal backend ko'tarish shart emas.

**Kirish:** `http://localhost:3002/login` → telefon `+998901234568` → "Kod yuborish".
OTP kodi javobda qaytadi va formaga **avtomatik to'ladi** (test rejimi) — "Kirish" bosing.

| Rol | Telefon | OTP |
|---|---|---|
| Manager | `+998901234568` | `123456` |
| Admin (hammasini ko'radi) | `+998901234567` | `123456` |

RBAC ni sinash uchun ikkala akkaunt bilan ham kiring — sidebar farqi ko'rinishi kerak.

> ℹ️ `localhost:3000`–`3003` backend CORS ro'yxatiga kiritilgan, ishlaydi.
> Agar boshqa portda ishga tushirsangiz CORS xatosi chiqadi (brauzer konsolida ko'rinadi).

---

## 12. Deploy — muhim ogohlantirish

**GitHub'ga push qilish bu panelni deploy QILMAYDI.** Faqat `backend` servisi
push'da avtomatik yangilanadi. `web-manager` Railway'ga qo'lda yuklanadi:

```bash
cd web-manager
railway up . --path-as-root --service web-manager --ci
```

Deploy kirish menda (repo egasida) — siz faqat push qiling, men deploy qilaman.
Yoki Railway'ga kirish kerak bo'lsa ayting.

Ishlab turgan versiya: https://web-manager-production-74b0.up.railway.app

---

## 13. Bajarilgan deb hisoblash mezonlari (Definition of Done)

- [ ] 13 ta sahifa + layout mint dizayn tizimida
- [ ] Chap collapsible sidebar; 13 ta element ham, 2 ta element ham chiroyli ko'rinadi
- [ ] Light va dark rejim ikkalasi ham ishlaydi, toggle bor, tanlov saqlanadi, hydration ogohlantirishi yo'q
- [ ] Barcha UI matnlari o'zbekcha, 9-bo'lim lug'atiga mos
- [ ] Har bir sahifada: skeleton yuklanish, bo'sh holat, xato holati
- [ ] Istisnolar sahifasining bo'sh holati "xotirjam/ijobiy" ko'rinishda
- [ ] Qo'lda aralashuv amber rangda, sabab majburiy, sababsiz yuborilmaydi
- [ ] `searching` buyurtmada progress indikatori bor
- [ ] Xarita ishlaydi, haydovchilar mint/kulrang ajratilgan
- [ ] `npm run build` xatosiz o'tadi
- [ ] TypeScript xatolari yo'q (`npx tsc --noEmit`)
- [ ] `src/lib/api.ts` va `src/hooks/*` o'zgarmagan (`git diff` bilan tekshiriladi)
- [ ] Manager va admin akkauntlari bilan sinalgan, RBAC to'g'ri ishlaydi
- [ ] Planshet (1024px) da layout buzilmaydi

---

## 14. Ish tartibi

1. `main` dan yangi branch: `git checkout -b redesign/dispatcher-mint`
2. Avval **dizayn tizimi + layout** (tailwind config, globals.css, ui komponentlar, sidebar) —
   bu baza, qolgani shunga tayanadi
3. Keyin sahifalar, 4-bo'limdagi ustuvorlik tartibida
4. Kichik-kichik commit qiling, bitta katta commit emas. Format:
   `refactor(web-manager): <nima qilindi>`
5. Tugagach Pull Request oching, screenshotlar bilan (light + dark, kamida 5 ta ekran)

**Savol tug'ilsa** — taxmin qilib ketmang, so'rang. Ayniqsa:
API dan yangi ma'lumot kerak bo'lsa, biror funksionallikni o'zgartirish kerak
ko'rinsa, yoki spetsifikatsiyada ziddiyat topsangiz.

---

## 15. Foydali fayllar

| Fayl | Nima uchun |
|---|---|
| `dashboard_design_prompts.md`, 1-bo'lim | To'liq dizayn spetsifikatsiyasi (asosiy manba) |
| `mobile/lib/core/config/app_theme.dart` | Mint ranglar manbasi — moslik shu yerdan olinadi |
| `docs/ARCHITECTURE.md` | Umumiy arxitektura |
| `web-manager/src/lib/constants.ts` | Status/label konstantalari |
| `web-manager/src/app/dispatch/layout.tsx` | Hozirgi RBAC nav mantiqi (izohlari bilan o'qing) |
