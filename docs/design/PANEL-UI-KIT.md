# Panel UI Kit — 4 ta web panel uchun yagona dizayn tizimi

**Versiya:** 1.1 — 2026-10-15 (migratsiya so'rovlari kitga qo'shildi)
**Qamrov:** `web-admin`, `web-manager`, `web-market`, `web-restaurant`
**Ustunlik:** `docs/DESIGN-TOKENS.md` (ranglar) > shu hujjat (panel zichligi, komponentlar, shell)

## 0. Maqsad

Panel — 8 soat ishlaydigan operator uchun "qaror yordamchisi". Yo'nalish:
**Linear / Stripe Dashboard** — zich, sokin, bezaksiz. Kulrang fon ustida oq
yuzalar, hairline chegaralar, rang faqat ma'no (holat, aksiya) uchun.

To'rt panel **bitta mahsulotga** o'xshashi shart: bir xil sidebar, topbar,
sahifa sarlavhasi, jadval, karta, tugma, badge, bo'sh/xato/yuklanish holatlari.

## 1. Kanonik manba va sync

- **Yagona manba:** `web-manager/` ichidagi quyidagi fayllar:
  - `src/components/ui/**` — primitivlar
  - `src/components/shell/**` — AppShell, Sidebar, Topbar, PageHeader va h.k.
  - `src/lib/format.ts` — pul, sana, telefon, raqam formatlash
  - `src/styles/tokens.css` — CSS o'zgaruvchilar (light + dark)
  - `tailwind.preset.js` — Tailwind tokenlari
- **Sync:** `scripts/sync-panel-ui.sh` shu fayllarni qolgan 3 panelga
  ko'chiradi. `--check` rejimi farq bo'lsa exit 1 qaytaradi (CI va
  test uchun). Har ko'chirilgan fayl boshida:
  `// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh`
- Panelga xos komponentlar (`components/dispatch/*`, `components/orders/*` …)
  sync qilinmaydi. Panelga xos CSS (Leaflet, kiosk) `globals.css` da qoladi;
  `globals.css` faqat `@import '../styles/tokens.css'` qiladi.
- Panel `tailwind.config.js` = `presets: [require('./tailwind.preset.js')]` +
  o'z `content` massivi + (ixtiyoriy) panelga xos qo'shimchalar.
- **Railway:** har panel o'z papkasidan build qilinadi — sync qilingan fayllar
  panel ichida commit qilinadi, shuning uchun deploy o'zgarmaydi.

## 2. Panel zichlik qatlami (Linear/Stripe)

Ranglar `DESIGN-TOKENS.md` dagidek qoladi. O'zgaradigani — **panel** uchun
shakl, soya, tipografika og'irligi:

| Token | Eski | Yangi (panel) | Izoh |
|---|---|---|---|
| `--radius-xs` | 8px | 6px | badge, checkbox, kbd |
| `--radius-sm` | 12px | 8px | tugma, input, select, chip |
| `--radius-md` | 16px | 10px | karta, jadval konteyneri |
| `--radius-lg` | 22px | 12px | modal, katta panel |
| `--radius-xl` | 28px | 14px | drawer (chap burchaklar) |
| `--shadow-card` | blur 24px | `0 0 0 1px line` + `0 1px 2px ink/4%` | hairline, "suzib yurmaydi" |
| `--shadow-pop` | — | o'zgarishsiz | faqat popover/modal/dropdown |
| `--shadow-cta` | yashil glow | **olib tashlanadi** (`none`) | tugmada glow yo'q |
| body matn | 14px | 13–14px | jadval 13px, forma 14px |
| sarlavha og'irligi | 800 | **600** (h1/h2/h3), display 700 | 800 faqat KPI qiymatida emas |
| `bg` | `#F4F7F8` | o'zgarishsiz | |

Mobil ilova o'z radiuslarini saqlaydi — bu qatlam faqat `tokens.css`
(panel) ichida. `DESIGN-TOKENS.md` ga "Web panel zichlik qatlami" bo'limi
qo'shiladi.

## 3. Tipografika va raqamlar

- Bitta oila: Manrope (sans). JetBrains Mono **faqat** ID, davlat raqami,
  SKU, kod (`#28687C`, `01 A 123 AA`, `CHY-3007`).
- **Pul monospace EMAS.** Pul, son, foiz, vaqt = sans + `tabular-nums`
  (`.num` utility). `so'm` qo'shimchasi `text-muted`, kichikroq.
- Davlat raqami bir qatorda (`whitespace-nowrap`), `PlateNumber` komponenti.
- Shkala: micro 11 / caption 12 / table 13 / body 14 / title 15 / h3 16 /
  h2 18 / h1 20 / kpi 24–28. Uppercase faqat jadval sarlavhasi va sidebar
  guruh nomida (11px, tracking 0.04em, 600).
- Barcha formatlash `lib/format.ts` orqali: `formatMoney(43500)` →
  `43 500 so'm`, `formatDateTime`, `formatRelative`, `formatPhone`
  (`+998 90 123 45 69`), `formatDuration` (kechikish: `2 kun 3 soat`,
  hech qachon `-126597:46`), `fullName(first, last)` (null → "Ism kiritilmagan").

## 4. Shell

```
┌──────────┬──────────────────────────────────────────────┐
│ Brand    │ Topbar: [live slot]   [search] [🔔] [◐] [👤] │  h-14, border-b
│──────────│──────────────────────────────────────────────│
│ GROUP    │ PageHeader: Title          [secondary][CTA]  │
│  Item    │   meta / description                         │
│  Item ●3 │ ─────────────────────────────────────────── │
│ GROUP    │ content (max-w none, px-6 py-5)              │
│  …       │                                              │
│──────────│                                              │
│ Collapse │                                              │
│ User     │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- **Sidebar** 240px / rail 56px. Element balandligi 32px, 13.5px matn, 16px
  ikona, `gap-2.5`. Guruh nomi 11px uppercase `text-subtle`, chevron yo'q
  (guruhlar yig'ilmaydi — elementlar kam). Label hech qachon 2 qatorga
  sinmaydi (`truncate` + tooltip); uzun nomlar qisqartiriladi.
- Faol element: `bg-surface-2` + chap 2px `primary` chiziq + `text-ink`
  font-600 + `aria-current="page"`.
- Badge: son (`danger` faqat exceptions/kritik; boshqasi neytral
  `bg-surface-3`). Doim yonib turadigan badge — taqiq.
- Pastda: yig'ish tugmasi + foydalanuvchi kartasi (avatar, ism, rol,
  chiqish menyusi). Holat cookie bilan saqlanadi (flash yo'q).
- **Topbar** 56px: chapda panelga xos live slot (manager: aktiv buyurtma /
  onlayn haydovchi / istisnolar; vendor: Ochiq/Yopiq + jonli holat; admin:
  tasdiq kutayotganlar), o'ngda qidiruv (⌘K), bildirishnoma, tema, profil.
  Sahifa nomi topbarda EMAS.
- **PageHeader:** dekorativ ikon-plitka YO'Q. `h1` (20px/600) + bir qator
  meta (`text-muted 13px`) + o'ngda amallar (ikkilamchi `secondary`, asosiy
  `primary`). Ostida chiziq yo'q — kontent 20px pastdan boshlanadi.
  Breadcrumb faqat 3+ daraja (detail sahifalar).
- "Yangilandi" holati faqat BITTA joyda — topbar live slotida.

## 5. Komponentlar (superset API)

Har biri: light + dark, `focus-visible`, disabled, loading.

| Komponent | Asosiy variantlar |
|---|---|
| `Button` | `primary` `secondary` (oq + hairline) `ghost` `danger` `danger-ghost`; `sm` 28px / `md` 32px / `lg` 40px; `icon`-only; `loading`; `asChild`/`href` |
| `IconButton` | 32px kvadrat, `aria-label` majburiy |
| `Input` `Textarea` `Select` | 32px, 8px radius, label/hint/error, prefix/suffix ikona |
| `SearchInput` | ikona + `⌘K`/clear |
| `Checkbox` `Switch` `RadioGroup` | |
| `Badge` / `StatusBadge` | `neutral` `success` `info` `warning`(=override, faqat qo'lda aralashuv) `danger` `violet`; `dot`; 20px balandlik, 12px matn, 6px radius — pill EMAS |
| `Card` | `Card`, `CardHeader(title, description, actions)`, `CardBody`, `CardFooter`; padding 16/20 |
| `StatCard` | label → qiymat (24px/600 `.num`) → delta (FAQAT haqiqiy oldingi davr bo'lsa) → izoh. Rangli chegara/ikon-plitka/soxta sparkline YO'Q |
| `DataTable` | sticky header, 40px qator (`compact` 32px), 13px, raqam ustunlari o'ngga, sort, tanlash + bulk bar, qator hover, bo'sh/yuklanish/xato holatlari ichida, `Pagination` pastda |
| `Pagination` | `1–20 / 68` + sahifa o'lchami + oldingi/keyingi |
| `Tabs` | underline (sahifa ichida) va `SegmentedControl` (filter) — ikki alohida komponent |
| `FilterBar` | qidiruv + select'lar + chip'lar + "Filtrlarni tozalash" |
| `Modal` `ConfirmDialog` `Drawer` | portal ORQALI (karta onClick'iga sizmasin), scrim `--scrim` tokeni, Esc, fokus tuzog'i |
| `Toast` | o'ng past, 4s, undo amali |
| `DropdownMenu` | profil menyusi, qator amallari (`⋯`) |
| `Tooltip` | rail rejimi, kesilgan matn |
| `Avatar` | initsiallar, ism bo'lmasa ikona (hech qachon "NN" null'dan) |
| `PlateNumber` `MoneyText` `RelativeTime` | domen atomlari |
| `EmptyState` | `first-use` / `cleared` / `no-results` (+ "Filtrlarni tozalash") |
| `ErrorState` | nima buzildi + "Qayta urinish"; oxirgi yaxshi ma'lumot saqlanadi |
| `Skeleton` | `SkeletonTable`, `SkeletonCards`, `SkeletonText` — haqiqiy layoutni takrorlaydi |
| `Kbd` | `⌘K` |

`--scrim` tokeni qo'shiladi (`#04140F` / 55%) — eski ochiq topilma yopiladi.

### 5.1 v1.1 qo'shimchalari (4 panel migratsiyasidan keyin)

Panelda "kitni aylanib o'tish" (hack) o'rniga quyidagilar ishlatiladi:

| Komponent | Yangi API |
|---|---|
| `FilterBar` | `searchAriaLabel`, `onSearchClear`, `searchClassName` (default `w-full sm:w-72`) — qidiruvni ichiga qo'lda `SearchInput` qo'yilmaydi |
| `DataTable` | `title` / `description` / `actions` sarlavha qatori (Card+CardHeader o'rami o'rniga); `footer` (sahifasiz ro'yxat soni); `rowLabel(row)` → checkbox nomi "Tanlash: …"; `isFiltered` + `onClearFilters` (+ ixtiyoriy `emptyFiltered`) → o'rnatilgan `no-results` bo'sh holati |
| `Tabs` / `SegmentedControl` | `size` `sm`/`md`/`lg` (lg = 40px touch), `fullWidth` (teng kenglik, gorizontal skroll yo'q) |
| `Switch` | `size="lg"` (44×26, touch) |
| `LiveMetric` | `tone="attention"` — sokin info rangi ("ish kutyapti": yangi buyurtma > 0). Amber EMAS (amber = faqat qo'lda aralashuv), qizil faqat istisno/kritik |
| `AppShell` | `banner` — topbar va `<main>` orasidagi, skroll bilan ketmaydigan qator ("Qabul yopiq" pauza banneri) |
| `LiveStatus` / `PollStatus` | ixtiyoriy `onRefresh` + `isRefreshing` → pill yonida ↻ (`RefreshButton`). Bitta callback ramka + joriy sahifani yangilaydi: `PageRefreshProvider` (layout) + `usePageRefresh(reload)` (sahifa) + `useRefreshAll()` (shell) — `components/shell` dan |
| `format.ts` | `formatPrepTimer(order, now)` — oshxona taymeri: vaqt bor "12:30", kechikdi "Kechikmoqda · 2 soat 15 daq", 24 soatdan eski → tushgan sana. `shortId(id)` = `#` + BIRINCHI 6 belgi, kichik harf (`#a1b2c3`), `font-mono` — 4 panelda (jadval, drawer, toast, CSV) yagona buyurtma raqami |
| `Button` | `href` `tel:` / `mailto:` / `sms:` / `http(s)://` yoki `external` → oddiy `<a>` (http/external yangi tabda). `buttonVariants` + qo'lda `<a>` kerak emas |
| `PageBody` | sahifa skroll konteyneri + standart padding (`width="narrow"` forma/detal uchun) |
| `KeyValue` | `DetailCard(title, actions)`, `KeyValueList`, `KeyValue(label)` — detal sahifa va drawer'lardagi kalit–qiymat ro'yxati |
| `Badge` | `muted-danger` — neytral fon ustida past urg'uli qizil matn: "Bekor qilindi" holati (jonli qizil ogohlantirishlar yonida baqirmaydi) |

## 6. Dashboard va grafiklar

- 3–5 KPI, eng muhimi chapda. Soxta delta/sparkline — taqiq.
- Grafik: ma'lumot nuqtasi < 3 bo'lsa grafik o'rniga "Grafik uchun
  ma'lumot yetarli emas" bo'sh holati (bitta ulkan bar emas).
- Bar kengligi max 32px; grid chiziqlari faqat gorizontal, `line` rangida;
  o'qlar 11px `text-subtle`; pie/donut/gauge — taqiq.

## 7. Matn va til

- Faqat o'zbekcha (lotin). Status yorliqlari bitta `constants` modulida.
- Bo'sh ma'lumot: `—` (em dash), `null null` / `undefined` hech qachon.
- Test ma'lumotlari (`E2E …`) dizayn muammosi emas — tegilmaydi.

## 8. Muzlatilgan (tegilmaydi)

API client, hook'lar, socket, auth, route-guard, server.js — imzolari
o'zgarmaydi. Har amal oldingidek yetib boriladi, RBAC filtri saqlanadi.
Mavjud testlar o'zgartirilmaydi (faqat UI matni o'zgargan joyda moslanadi).

## 9. "Tayyor" mezoni (har panel)

- `npx tsc --noEmit` = 0, `npm test` yashil, `npm run lint` toza
- `scripts/sync-panel-ui.sh --check` = 0
- Grep invariantlari: `rounded-ds-lg|rounded-2xl|rounded-3xl` (karta/tugmada) 0,
  `shadow-cta` 0, `font-extrabold|font-\[800\]` sarlavhada 0,
  `font-mono` faqat ID/plate/SKU/kod da, `window.confirm|alert(` 0,
  `null null` chiqishi mumkin bo'lgan `${a} ${b}` ism birlashtirishlari 0
- Har sahifada loading / empty / error mavjud
- 1024px va 1440px, light va dark — buzilish yo'q
