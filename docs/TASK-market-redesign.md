# TASK: Market (sotuvchi) panelini qayta dizayn qilish (web-market)

**Repo:** `github.com/Diyorbek321/angrentaxi`
**Papka:** `web-market/` — boshqa papkalarga tegilmaydi
**Taxminiy hajm:** ~2600 qator UI kodi, 7 ta sahifa + layout + login
**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
**Muddat:** kelishilgan holda

---

## 1. Kontekst — nima uchun bu ish kerak

Angren Taxi — Angren shahri uchun super-app: taksi, yuk tashish, market (onlayn do'kon)
va restoran (ovqat yetkazish). Backend NestJS'da, mobil ilova Flutter'da, web panellar
Next.js'da:

| Papka | Panel | Port |
|---|---|---|
| `web-admin` | Super admin | 3001 |
| `web-manager` | Dispetcher | 3002 |
| **`web-market`** | **Sotuvchi (do'kon egasi)** | **3003** |
| `web-restaurant` | Restoran | 3004 |

`web-market` — bu **do'kon egasi/xodimi uchun panel**. Do'kon o'z mahsulotlari,
buyurtmalari va zaxirasini shu yerdan boshqaradi. Panelga faqat `market` roli bilan
kirish mumkin (login sahifasi boshqa rollarni rad etadi).

**Muammo — panel brenddan ajralib qolgan:**

1. Butun loyiha **mint yashil `#1FCA8E`** ga o'tkazilgan
   (`mobile/lib/core/config/app_theme.dart` — rang manbai), lekin `web-market` da
   ko'chish **yarim yo'lda to'xtab qolgan**: `tailwind.config.js` da `brand.yellow`
   ning qiymati mint'ga o'zgartirilgan (klass nomi `brand-yellow` bo'lib qolgan),
   ammo qolgan hamma narsa hali eski sariq/navy tizimida:
   - `globals.css:12` — `--primary: 48 96% 53%` (sariq hue)
   - `globals.css:32` — `background-color: #080D1A` (qattiq yozilgan navy)
   - `layout.tsx:88` — logotip gradienti `from-brand-yellow to-amber-500` (mint→sariq)
   - `orders/page.tsx:250` — tugma `hover:bg-yellow-300`
   - `globals.css` da `.yellow-glow`, `.text-gradient-yellow` nomlari
2. **Faqat dark rejim.** Light rejim yo'q, toggle ham yo'q. Dizayn tizimi ikkalasini
   ham talab qiladi.
3. Sahifalar dizayni sodda: buyurtmalar oddiy tab+ro'yxat (kanban emas), mahsulotlar
   jadval (grid emas), hisobotlar sahifasida grafik yo'q, bo'sh/xato holatlari
   ko'p joyda yo'q.

Repoda buning uchun tayyor spetsifikatsiya bor: **`dashboard_design_prompts.md`,
3-bo'lim "Market Dashboard"** (232–298-qatorlar). Bu task o'sha hujjatni amalga
oshirish haqida.

> ⚠️ `dashboard_design_prompts.md` UI matnlari **inglizcha** deb yozilgan.
> **Bu task uchun bu qoida bekor qilinadi — barcha UI matnlari o'zbekcha bo'lishi
> kerak** (10-bo'limdagi lug'atga qarang). Qolgan hamma narsa o'sha hujjat bo'yicha.
>
> ⚠️ O'sha hujjatda backend qo'llab-quvvatlamaydigan 2 ta narsa bor —
> **ularni qilmaysiz**, 8-bo'limga qarang.

---

## 2. Maqsad

Sotuvchi panelini mint dizayn tizimiga to'liq o'tkazish: ranglar, layout, komponentlar,
light/dark rejim va o'zbek tilidagi interfeys. **Funksionallik o'zgarmaydi** — bu vizual
va UX qayta ishlash, yangi biznes-logika emas. Backend API'ga tegilmaydi.

---

## 3. Dizayn tizimi (majburiy)

### Ranglar

| Nima | Qiymat |
|---|---|
| Asosiy (primary / CTA) | `#1FCA8E` |
| Primary dark (hover) | `#10A064` |
| Primary light | `#27D89B` |
| Matn (ink) | `#0F1B22` |
| Fon — light | `#F4F7F8` |
| Fon — dark | `#0B1210` |

**Buyurtma statusi ranglari** (hozirgisi `src/components/StatusBadge.tsx` da):

| Status | O'zbekcha | Rang |
|---|---|---|
| `new` | Yangi | mint (diqqat tortadi) |
| `packing` | Yig'ilmoqda | ko'k |
| `shipped` | Yuborildi | binafsha |
| `delivered` | Yetkazildi | to'q yashil |
| `cancelled` | Bekor qilindi | qizil |

**Muhim qoida:** qizil va amber **faqat ogohlantirish** uchun — zaxira tugagan,
zaxira kam, bekor qilingan buyurtma. Oddiy ma'lumot uchun qizil ishlatilmaydi.

**Sariq/amber rangdan butunlay voz kechiladi** — `yellow-*`, `amber-*` Tailwind
klasslari kodda qolmasligi kerak (ogohlantirish rangidan boshqa joyda).
`brand-yellow` klass nomi ham **`brand-primary`** ga o'zgartiriladi (hozir qiymati
mint, nomi sariq — chalkash).

### Shrift
- Asosiy matn: **Manrope** (allaqachon ulangan — `--font-manrope`, `src/fonts/`)
- Raqamlar, narx, zaxira soni, ID, vaqt: **JetBrains Mono** (`--font-jetbrains-mono`)

### Layout
- **Chap sidebar** (hozir ham bor, `w-[252px]`) — saqlanadi, lekin qayta dizayn qilinadi
  va **yig'iladigan (collapsible)** bo'ladi.
- **Yuqori header:** do'kon nomi/logotipi, **"Ochiq/Yopiq" toggle** (do'konni vaqtincha
  yopish), yangi buyurtma bildirishnomasi, qidiruv, profil, **light/dark toggle**.
- **Light va dark — ikkalasi ham** ishlashi kerak. Tanlov `localStorage` da saqlanadi.
- Desktop-first. Planshetda (1024px) buzilmasin. Mobil layout shart emas — bu do'kon
  kompyuteridan ishlatiladigan vosita.

---

## 4. Qamrov — 7 sahifa + layout + login

| # | Sahifa | Fayl | Qator |
|---|---|---|---|
| 0 | **Layout** (sidebar + header) | `src/app/dashboard/layout.tsx` | 183 |
| 1 | **Buyurtmalar** | `src/app/dashboard/orders/page.tsx` | 260 |
| 2 | **Bosh sahifa (Overview)** | `src/app/dashboard/page.tsx` | 170 |
| 3 | **Mahsulotlar** | `src/app/dashboard/products/page.tsx` | 406 |
| 4 | **Zaxira** | `src/app/dashboard/stock/page.tsx` | 143 |
| 5 | **Kategoriyalar** | `src/app/dashboard/categories/page.tsx` | 112 |
| 6 | **Hisobotlar** | `src/app/dashboard/reports/page.tsx` | 144 |
| 7 | **Sozlamalar** | `src/app/dashboard/settings/page.tsx` | 225 |
| 8 | **Login** | `src/app/login/page.tsx` | 196 |

Ustuvorlik tartibi shu — yuqoridagilar muhimroq (Buyurtmalar sotuvchi kun bo'yi
qaraydigan ekran).

**Har bir sahifada quyidagilar bo'lishi SHART:**
- **skeleton yuklanish holati** (spinner emas, kontent shakliga o'xshagan skeleton)
- **bo'sh holat** (empty state) — ikonka + tushuntirish + kerak bo'lsa amal tugmasi
- **xato holati** — "Qayta urinish" tugmasi bilan

Hozir ko'p joyda bular yo'q yoki oddiy matn.

---

## 5. Sahifalar bo'yicha talablar

### 5.1 Buyurtmalar (eng muhim ekran)

Hozir: yuqorida statuslar bo'yicha tablar, pastda oddiy ro'yxat, bosilganda detal
paneli ochiladi.

**Kerak — kanban ustunlari:**
`Yangi` → `Yig'ilmoqda` → `Yuborildi` → `Yetkazildi` / `Bekor qilingan`

- Har bir ustun tepasida buyurtmalar soni.
- Buyurtma kartasi: qisqa ID, mijoz ismi + telefoni, manzil, mahsulotlar soni,
  umumiy summa, yetkazib berish turi (`self` = do'kon o'zi, `platform` = kuryer),
  kelgan vaqti ("5 daqiqa oldin").
- **`new` statusidagi karta ko'zga tashlanib turishi kerak** — mint chegara,
  yengil pulsatsiya. Sotuvchi buni o'tkazib yubormasligi kerak.
- Kartani bosganda **detal modal**: to'liq mahsulotlar ro'yxati (miqdor + narx),
  mijoz izohi (`note`), telefon raqami (bosilsa qo'ng'iroq), **har bir mahsulot
  yonida "yig'ildi" checkbox** (`togglePackItem` API'si bor — hozir ishlatiladi,
  saqlanadi), va bitta asosiy tugma keyingi bosqichga o'tkazish uchun (`advanceOrder`).
- **Kanban drag-and-drop SHART EMAS** — status faqat `advanceOrder` orqali ketma-ket
  o'zgaradi (`new → packing → shipped → delivered`), sakrash mumkin emas. Ustunlar
  faqat vizual guruhlash.
- Yangi buyurtma kelganda: toast + sidebar'dagi badge yangilanadi. Hozir 30 soniyada
  bir marta so'rov yuboriladi (`layout.tsx:56-72`) — **shu qoladi**, WebSocket
  qo'shmaysiz.
- **Ovozli signal (audio cue):** hozir yo'q. Ikonkasi bo'lsin (o'chirib/yoqib
  qo'yiladigan), lekin haqiqiy ovoz faylini qo'shishdan oldin **so'rang**.

### 5.2 Bosh sahifa (Overview)

`getDashboard()` qaytaradigan ma'lumot bilan ishlaydi (`api.ts:129-150`):
`todayOrdersCount`, `todayRevenue`, `outOfStockCount`, `activeProductsCount`,
`hiddenProductsCount`, `lowStock[]`, `recentOrders[]`, `bestSellers[]`.

- 4 ta StatCard: bugungi buyurtmalar, bugungi tushum, kutilayotgan buyurtmalar,
  zaxirasi kam mahsulotlar soni.
- "Diqqat talab qiladi" bloki: tugagan mahsulotlar + javobsiz (`new`) buyurtmalar.
  Bo'sh bo'lsa — **xotirjam, ijobiy ko'rinish** ("Hammasi joyida"), bo'sh jadval emas.
- Eng ko'p sotilgan 5 ta mahsulot (`bestSellers`).
- So'nggi buyurtmalar (`recentOrders`).

### 5.3 Mahsulotlar

Hozir: jadval ko'rinishi, "Mahsulot qo'shish" modali, ommaviy narx o'zgartirish modali.

**Kerak:** grid (karta) ko'rinishi + jadval ko'rinishi o'rtasida almashtirish tugmasi.
Karta: emoji rasm (8-bo'limga qarang), nomi, narxi, zaxirasi, `active/out/hidden`
holati toggle'i. Kategoriya va holat bo'yicha filtr, qidiruv. Ommaviy amallar
(hozirgi funksionallik saqlanadi: bir nechta mahsulotni tanlab narx o'zgartirish
yoki holatini o'zgartirish).

### 5.4 Zaxira

Jadval: mahsulot, hozirgi zaxira, kam zaxira chegarasi (`store.lowStockThreshold`),
o'zgarishlar tarixi (`getStockMovements` — `delta`, `note`, `createdAt`).
Zaxirasi kam qatorlar ajratib ko'rsatiladi, tugaganlari qizil.

> ⚠️ **Zaxira qo'shish uchun alohida API yo'q.** "Restock" `updateProduct(id, { stock })`
> orqali qilinadi. Yangi endpoint kutmang.

### 5.5 Kategoriyalar

Ro'yxat: emoji + nom + har bir kategoriyadagi mahsulotlar soni + faol/nofaol.
Tartibni o'zgartirish (`sortOrder` maydoni bor) — drag-and-drop bo'lsa yaxshi,
lekin **yuqoriga/pastga tugmalari ham yetarli**. Qo'shish/tahrirlash/o'chirish modali.

### 5.6 Hisobotlar

`getReports()` qaytaradi: `weeklyRevenue[]`, `categoryBreakdown[]`, `bestSellers[]`,
`stockTurnover`. Hozir sahifada **grafik yo'q** — faqat raqamlar.

- Chiziqli grafik: haftalik tushum
- Donut/bar: kategoriyalar bo'yicha taqsimot
- Eng ko'p sotilganlar reytingi
- **CSV eksport** (brauzer tomonida, backend'siz)

> Grafik kutubxonasi hali o'rnatilmagan. `recharts` qo'shishingiz mumkin,
> yoki sof SVG/CSS bilan chizsangiz ham bo'ladi. Bundle hajmiga e'tibor bering.

### 5.7 Sozlamalar

Do'kon profili: nomi, telefoni, manzili, ish vaqti (`workingHoursStart/End`),
yetkazib berish turi (`self` / `platform`), kam zaxira chegarasi.
Hammasi `updateStore()` orqali — **mavjud maydonlardan boshqasini qo'shmang**.

### 5.8 Login

Ikki bosqichli: telefon → OTP. Dev rejimida OTP kod javobda qaytadi va formaga
avtomatik to'ladi — **bu xatti-harakat saqlanadi**. `market` bo'lmagan rol rad
etiladi — bu tekshiruv ham saqlanadi (`login/page.tsx:75-83`).
Dizayn: mint, markazlashgan karta, brend belgisi bilan.

---

## 6. Qayta ishlatiladigan komponentlar

Yaratish (yoki qayta yozish) kutiladi:

`StatCard`, `ProductCard`, `OrderCard`, `OrderKanbanColumn`, `StockAlertRow`,
`Modal`, `Table`, `EmptyState`, `Skeleton`, `Badge`, `Select`, `Switch`,
`ThemeToggle`.

Mavjudlari (`src/components/ui/`): `Button.tsx`, `Input.tsx`, `Toast.tsx`,
`StatusBadge.tsx` — **bularni to'liq qayta yozish mumkin va kutiladi**.

---

## 7. Kod sifati

- Bitta fayl 400 qatordan oshmasin. Hozir `products/page.tsx` — 406 qator, ichida
  2 ta modal komponenti bor. **Ularni alohida fayllarga ajrating.**
- Modal, karta, jadval — hammasi `src/components/` ga chiqariladi, sahifa fayllari
  faqat ma'lumot olish + kompozitsiya bilan shug'ullanadi.
- Inline `style={{ ... }}` dan voz keching, Tailwind klasslariga o'tkazing.
- Sehrli piksel qiymatlari (`text-[13.5px]`, `rounded-[11px]`, `gap-[3px]`) —
  Tailwind konfiguratsiyasidagi shkalaga keltiring (`text-sm`, `rounded-xl`, ...).

---

## 8. Backend qo'llab-quvvatlamaydigan narsalar — QILINMAYDI

`dashboard_design_prompts.md` da yozilgan, lekin backend'da yo'q:

| Hujjatda | Nega qilinmaydi |
|---|---|
| **Mahsulot rasmi yuklash (`ImageUploadField`)** | `Product` modelida `image` maydoni yo'q. Uning o'rniga `emoji` + `hue` (rang) bor — mahsulot rasmi shu ikkisidan generatsiya qilinadi. **Emoji tanlash UI'sini chiroyli qiling**, rasm yuklashni qilmang. |
| **"Do'kon almashtirish" selektori (header'da)** | `getStore()` faqat kirgan foydalanuvchining do'konini qaytaradi. Ko'p do'konli rejim yo'q. |
| **Chegirma narxi (sale price)** | `Product` da faqat `price` bor. |
| **Kuryer holati buyurtma kartasida** | Buyurtmada kuryer ma'lumoti qaytmaydi, faqat `deliveryMode`. |

Agar bu maydonlar kerak deb hisoblasangiz — **avval so'rang**, o'zingiz backend'ga
qo'shmang.

---

## 9. Texnik cheklovlar — BULARGA TEGMANG

Bu **faqat UI** taski.

| Tegmang | Sabab |
|---|---|
| `src/lib/api.ts` — funksiya imzolari, interfeyslar, endpoint yo'llari | Backend bilan shartnoma. Yangi maydon kerak bo'lsa avval so'rang. |
| `src/lib/auth.ts`, `src/hooks/useAuth.ts` | Token va sessiya boshqaruvi. |
| `backend/`, `mobile/`, `web-admin/`, `web-manager/`, `web-restaurant/` | Bu task doirasidan tashqarida. |

**Ruxsat etiladi va kutiladi:** `src/components/**` ni to'liq qayta yozish,
`src/app/**` sahifalarini qayta yozish, `tailwind.config.js` va `globals.css` ni
yangilash, yangi komponent va yordamchi (util) fayllar qo'shish, `recharts` kabi
UI kutubxonasini qo'shish.

**Hydration tuzog'i:** theme toggle qo'shganda `localStorage` ni render tanasida
o'qimang — faqat `useEffect` ichida, yoki `next-themes` ishlating. Aks holda
Next.js hydration mismatch ogohlantirishi chiqadi.

---

## 10. Til — UI matnlari o'zbekcha

Hozirgi interfeys asosan o'zbekcha, **shu davom ettiriladi**. Terminlar lug'ati
(shundan chetlanmang, izchillik muhim):

| Inglizcha | O'zbekcha |
|---|---|
| Overview / Dashboard | Bosh sahifa |
| Orders | Buyurtmalar |
| Products | Mahsulotlar |
| Categories | Kategoriyalar |
| Stock | Zaxira |
| Reports | Hisobotlar |
| Settings | Sozlamalar |
| Store | Do'kon |
| Open / Closed | Ochiq / Yopiq |
| New | Yangi |
| Packing | Yig'ilmoqda |
| Shipped | Yuborildi |
| Delivered | Yetkazildi |
| Cancelled | Bekor qilindi |
| Low stock | Zaxira kam |
| Out of stock | Zaxira tugagan |
| Active / Hidden | Faol / Yashirilgan |
| Revenue | Tushum |
| Best sellers | Eng ko'p sotilgan |
| Restock | Zaxirani to'ldirish |
| Add product | Mahsulot qo'shish |
| Bulk actions | Ommaviy amallar |
| Delivery zone / fee | Yetkazib berish hududi / narxi |
| Search | Qidirish |
| Export CSV | CSV yuklab olish |
| Retry | Qayta urinish |
| Logout | Chiqish |

**Status matnlari markazlashtiriladi** — hozir `src/components/StatusBadge.tsx:2-8`
da. Tarjimalarni sahifalarga tarqatmang, bitta joydan oling.

**Birliklar:** `dona`, `kg`, `litr` (backend'dagi `ProductUnit` shu uch qiymat).
**Pul:** "125 000 so'm" ko'rinishida (probel bilan ajratilgan, `so'm` kichik harflarda).
**Sana/vaqt:** `date-fns` allaqachon ulangan, o'zbek lokalini ishlating.

---

## 11. Lokal ishga tushirish

```bash
git clone git@github.com:Diyorbek321/angrentaxi.git
cd angrentaxi/web-market
npm install

# .env.local fayl yarating:
cat > .env.local <<'EOF'
NEXT_PUBLIC_API_URL=https://angrentaxi-production.up.railway.app/api/v1
EOF

npm run dev     # http://localhost:3003
```

Backend allaqachon ishlab turibdi (Railway'da) — lokal backend ko'tarish shart emas.

**Kirish:** `http://localhost:3003/login` → telefon `+998901234573` → "Kod yuborish".
Dev rejimida OTP kodi (`123456`) javobda qaytadi va formaga **avtomatik to'ladi** —
"Kirish" bosing.

| Rol | Telefon | OTP |
|---|---|---|
| Sotuvchi (market) | `+998901234573` | `123456` |

> ⚠️ **CORS:** backend'da ruxsat etilgan manbalar `CORS_ORIGIN` env orqali
> belgilanadi. Agar `http://localhost:3003` ro'yxatda bo'lmasa, brauzer konsolida
> CORS xatosi chiqadi — **menga ayting, qo'shib qo'yaman**. Portni o'zgartirmang.

---

## 12. Deploy — muhim ogohlantirish

**GitHub'ga push qilish bu panelni deploy QILMAYDI.** Faqat `backend` servisi
push'da avtomatik yangilanadi. Web panellar Railway'ga qo'lda yuklanadi:

```bash
cd web-market
railway up . --path-as-root --service web-market --ci
```

Deploy kirish menda (repo egasida) — siz faqat push qiling va PR oching,
deploy'ni men qilaman.

---

## 13. Bajarilgan deb hisoblash mezonlari (Definition of Done)

- [ ] 7 ta sahifa + layout + login mint dizayn tizimida
- [ ] Kodda `yellow-*` / `amber-*` klasslari qolmagan (ogohlantirish rangidan boshqa joyda)
- [ ] `brand-yellow` klass nomi `brand-primary` ga o'zgartirilgan
- [ ] `globals.css` da qattiq yozilgan `#080D1A` yo'q, `--primary` mint hue'da
- [ ] Light va dark rejim ikkalasi ham ishlaydi, toggle bor, tanlov saqlanadi,
      hydration ogohlantirishi yo'q
- [ ] Buyurtmalar kanban ko'rinishida, `new` kartalar ko'zga tashlanadi
- [ ] Buyurtma detal modalida "yig'ildi" checkbox ishlaydi (`togglePackItem`)
- [ ] Status faqat ketma-ket o'zgaradi (`advanceOrder`), sakrash yo'q
- [ ] Hisobotlar sahifasida grafiklar va CSV eksport bor
- [ ] Har bir sahifada: skeleton yuklanish, bo'sh holat, xato holati
- [ ] Barcha UI matnlari o'zbekcha, 10-bo'lim lug'atiga mos
- [ ] Status matnlari bitta joyda markazlashgan
- [ ] Bitta fayl 400 qatordan oshmaydi, modallar alohida fayllarda
- [ ] `npm run build` xatosiz o'tadi
- [ ] TypeScript xatolari yo'q (`npx tsc --noEmit`)
- [ ] `npx eslint .` xatosiz
- [ ] `src/lib/api.ts`, `src/lib/auth.ts`, `src/hooks/useAuth.ts` o'zgarmagan
      (`git diff` bilan tekshiriladi)
- [ ] Planshet (1024px) da layout buzilmaydi
- [ ] Sidebar yig'ilgan holatda ham chiroyli ko'rinadi

---

## 14. Ish tartibi

1. `main` dan yangi branch: `git checkout -b redesign/market-mint`
2. Avval **dizayn tizimi + layout** (tailwind config, globals.css, ui komponentlar,
   sidebar, theme toggle) — bu baza, qolgani shunga tayanadi
3. Keyin sahifalar, 4-bo'limdagi ustuvorlik tartibida
4. Kichik-kichik commit qiling, bitta katta commit emas. Format:
   `refactor(web-market): <nima qilindi>`
5. Tugagach Pull Request oching, screenshotlar bilan (light + dark, kamida 5 ta ekran)

**Savol tug'ilsa** — taxmin qilib ketmang, so'rang. Ayniqsa:
API dan yangi ma'lumot kerak bo'lsa, biror funksionallikni o'zgartirish kerak
ko'rinsa, yoki spetsifikatsiyada ziddiyat topsangiz.

---

## 15. Foydali fayllar

| Fayl | Nima uchun |
|---|---|
| `dashboard_design_prompts.md`, 3-bo'lim (232–298-qatorlar) | To'liq dizayn spetsifikatsiyasi (asosiy manba) |
| `mobile/lib/core/config/app_theme.dart` | Mint ranglar manbai — moslik shu yerdan olinadi |
| `docs/TASK-dispatcher-redesign.md` | Xuddi shunday task, dispetcher paneli uchun — uslub namunasi |
| `web-market/src/lib/api.ts` | Barcha API funksiyalari va tiplari (o'qing, o'zgartirmang) |
| `web-market/src/components/StatusBadge.tsx` | Hozirgi status matnlari va ranglari |
| `backend/src/database/seeds/seed-market.ts` | Test ma'lumotlari qanday yaratilgani |
