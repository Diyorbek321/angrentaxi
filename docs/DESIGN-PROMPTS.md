# Angren Super App — Design Prompts (Stitch / Claude)

> Bu promptlarni **Google Stitch** (stitch.withgoogle.com) yoki **Claude**ga
> joylab, UI/UX dizaynni generatsiya qilasiz. Inglizcha — chunki dizayn AI'lari
> inglizchada eng yaxshi ishlaydi.

---

## 0. QANDAY ISHLATISH

1. **Master prompt** (1-bo'lim) — har doim birinchi joylang. Bu dizayn tilini o'rgatadi.
2. **Screen prompt** (2-bo'lim) — kerakli ekranni joylang.
3. Stitch'da: har ekran uchun alohida prompt. Claude'da: "design system + screen" birga.
4. Natijani yoqtirmasangiz — "make it more premium / add depth / Yandex Go style" deb qo'shing.

---

## 1. MASTER PROMPT (design system — har doim birinchi)

```
You are a senior product designer. Design a modern, premium mobile super-app
UI called "Angren Go" — a ride-hailing + delivery super-app for Angren,
Uzbekistan (like Yandex Go / Bolt). It has 4 services: Taxi, Cargo, Food, Market.

DESIGN LANGUAGE — follow Yandex Go's structure with these exact rules:
- Layout: map-first screens; content lives in rounded bottom sheets that slide up.
- Primary color (accent): mint green #1FCA8E, with darker #17A86A for gradients/pressed.
- Tinted surface: #E6FAF2. Ink/near-black text: #0F1B22. Secondary text: #6B7785.
- Background: off-white #F6F8FA. Cards/sheets: pure white #FFFFFF.
- Status: error #E5484D, warning #F5A623.
- Typography: Plus Jakarta Sans. Headings extra-bold (w800), body regular,
  labels semibold. Tight letter-spacing on big headings.
- Corner radius: 16px buttons & inputs, 22–28px cards & bottom sheets, pills fully rounded.
- Shadows: soft, low-opacity, large blur (depth without harshness).
- Buttons: full-width, 54–58px tall, mint gradient with white text, subtle glow.
- Primary CTA button is mint (NOT black) — this is the brand difference from Yandex.
- Icons: rounded style (Material Symbols Rounded).
- Feel: clean, airy, premium, lots of whitespace, micro-interactions, gentle motion.
- Language: Uzbek (labels like "Qayoqqa boramiz?", "Buyurtma", "Online bo'lish").

Deliver iOS + Android mobile screens, light mode. Keep it consistent across screens.
```

---

## 2. SCREEN PROMPTS (har biri alohida)

### 2.1 — Super-app home (asosiy ekran)
```
Screen: Super-app home / launcher.
- Top: greeting "Salom, Diyor 👋" (w800) + subtitle "Bugun nima kerak?", and a
  rounded profile avatar button (mint-tinted) on the right.
- A dark gradient promo banner card "Angren Go — Taksi, yuk, ovqat, market bir ilovada"
  with a lightning bolt icon.
- Section title "Xizmatlar", then a 2×2 grid of 4 vibrant gradient service cards:
  • Taksi (green gradient, taxi icon)
  • Yuk tashish (blue gradient, truck icon)
  • Ovqat (orange gradient, restaurant icon)
  • Market (purple gradient, basket icon)
  Each card: white icon in a frosted square, title (w800 white), subtitle, soft colored shadow.
- A "Buyurtmalar tarixi" quick-link row at the bottom.
```

### 2.2 — Taxi home (map + search)
```
Screen: Taxi home, map-first (like Yandex Go).
- Full-screen map fills the background.
- Floating frosted-glass top bar: a menu button (left) and a "Joriy joylashuv"
  location pill with a mint location icon.
- A rounded white bottom sheet (28px top radius) sliding up from bottom with:
  • drag handle
  • big heading "Qayoqqa boramiz?" (w800)
  • a prominent search field "Manzilni qidiring..." with a mint gradient search icon square
  • "Saqlangan joylar" — horizontal row of square tiles: Uy, Ish, Bozor, Qo'shish
    (each: colored rounded icon + label).
- Center map pin to pick pickup point.
```

### 2.3 — Tariff / Order (Yandex Go signature screen)
```
Screen: Ride options / order confirmation (Yandex Go style).
- Top 55%: map showing the route — a mint polyline from pickup (mint dot) to
  destination (dark pin). Floating round back button top-left.
- Bottom sheet (rounded, white):
  • drag handle
  • compact route summary card (pickup → dropoff with a timeline connector)
  • HORIZONTAL scrolling tariff cards (112px wide each): taxi icon, name
    (Standard/Comfort/Business), price; selected card has a mint border + tinted bg.
  • payment chips row: "Naqd" and "Karta" (selected = mint tint + border)
  • full-width mint gradient "Buyurtma" button, 58px tall, showing the price
    on the right (e.g. "Buyurtma · 12 000 so'm"), with a soft mint glow.
```

### 2.4 — Searching for driver
```
Screen: Searching for a driver.
- Map background with the pickup point.
- Center: an animated pulsing mint badge (rings expanding) with a car icon.
- Bottom sheet: "Haydovchi qidirilmoqda..." title, a shimmer/skeleton driver card,
  and a "Bekor qilish" outline button.
```

### 2.5 — Trip tracking (active ride)
```
Screen: Active trip tracking.
- Map with the route, a moving car marker, pickup and dropoff markers.
- Bottom sheet:
  • status pill (e.g. "Haydovchi yo'lda", colored)
  • driver card: gradient-ring avatar, name (w700), car model + plate, star rating
    badge, and two filled round buttons (mint call + chat).
  • route timeline (pickup → dropoff) with the price.
  • ETA chip "5 daqiqa".
```

### 2.6 — Food / Market — vendor list
```
Screen: Food (or Market) vendors list.
- Top: search bar "Restoran yoki taom qidiring", category chips row
  (Hammasi, Fast-food, Milliy, Shirinliklar...).
- Vertical list of restaurant/shop cards: cover image, name (w700), rating star,
  delivery time "25-35 daq", delivery fee, a mint "Ochiq" badge. Rounded 22px, soft shadow.
- Bottom: a mint cart bar if items are added ("Savatcha · 2 ta · 48 000 so'm").
```

### 2.7 — Vendor/product detail + cart
```
Screen: Restaurant detail with menu and cart.
- Hero cover image with the shop name, rating, delivery info overlaid.
- Category tabs, then product cards: image, name, description, price, a round mint
  "+" add button.
- Sticky bottom mint "Savatcha" button with item count and total.
Then a Cart screen: list of items with quantity steppers, subtotal, delivery fee,
total, payment method selector (Naqd/Karta), and a mint "Buyurtma berish" button.
```

### 2.8 — Driver app — home (online/offline)
```
Screen: Driver home, map-first.
- Map background; floating top bar with driver avatar + today's earnings chip.
- Bottom sheet: when OFFLINE — "Ishlashni boshlash" heading + earnings row
  (Bugun / Tarix) + a big mint gradient "Online bo'lish" button with glow.
  When ONLINE — a pulsing mint "Buyurtma kutilmoqda..." indicator + "Offline bo'lish"
  dark button.
```

### 2.9 — Driver — order offer (incoming)
```
Screen: Incoming order offer (full-screen modal).
- Top: a circular countdown timer (15s) around a mint badge.
- A mint gradient "earnings" card showing the estimated fare (white text).
- Pickup → dropoff route rows, distance.
- Two big buttons: red "Rad etish" (outline) and mint "Qabul qilish".
```

### 2.10 — Vendor panel (web — restoran/do'kon egasi)
```
Screen: Vendor dashboard (web, desktop + responsive).
- Left sidebar: Dashboard, Buyurtmalar, Mahsulotlar, Balans, Sozlamalar (mint active state).
- Dashboard: stat cards (Bugungi sotuv, Buyurtmalar soni, Balans), a sales chart,
  recent orders table.
- "Mahsulotlar" page: product grid with image, name, price, stock, availability toggle,
  and an "Add product" modal (name, price, image upload, category, stock).
- "Buyurtmalar" page: live order cards with Accept / Ready buttons.
- Clean, mint accent, Plus Jakarta Sans, rounded cards, lots of whitespace.
```

---

## 3. TEMPLATE (istalgan yangi ekran uchun)

```
Screen: [EKRAN NOMI].
Purpose: [nima qiladi].
Layout: [map-first / list / form / bottom sheet].
Components: [ro'yxat — kartalar, tugmalar, maydonlar].
Primary action: [asosiy mint tugma matni].
Follow the Angren Go design system (mint #1FCA8E, Plus Jakarta Sans, rounded,
Yandex Go layout, premium & airy).
```

---

## 4. STITCH uchun maslahatlar

- Stitch (stitch.withgoogle.com) — Google'ning bepul AI UI vositasi (mobil/web UI yasaydi).
- Har ekranni **alohida** generatsiya qiling. Master prompt'ni qisqartirib har safar qo'shing.
- "Theme" sozlamasida rang #1FCA8E va shrift Plus Jakarta Sans ni bering.
- Natijani Figma'ga eksport qilib, keyin men kodga aylantiraman.

## 5. CLAUDE uchun maslahatlar

- Claude'ga: "Generate a Flutter widget for [screen] using this design system: [master prompt]"
  desangiz — to'g'ridan-to'g'ri **ishlaydigan Flutter kodi** beradi.
- Yoki "Create an HTML/CSS mockup of [screen]" — brauzerda ko'rasiz.
- Rasm (screenshot) yuborsangiz — "redesign this Yandex Go style" deb so'rang.

---

## Xulosa

1. **Master prompt** → dizayn tilini o'rgatadi
2. **Screen prompt** → har ekranni yasaydi
3. Stitch → vizual mockup; Claude → ishlaydigan kod
4. Natijani menga bering → ilovaga aylantra­man
```
