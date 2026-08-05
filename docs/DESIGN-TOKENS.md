# Angren Mint Design System — Kanonik Dizayn Tokenlari

> **Bu hujjat yagona haqiqat manbai (single source of truth).**
> Mobil ilova, dispetcher paneli, market paneli, restoran paneli va admin
> paneli — hammasi shu yerdagi qiymatlarga bo'ysunadi.
>
> Qiymatni o'zgartirmoqchi bo'lsangiz: **avval shu hujjatni yangilang**,
> keyin barcha implementatsiyalarni birga yangilang. Aks holda tizim yana
> uch joyda bir-biriga mos kelmaydigan holatga qaytadi.

**Versiya:** 1.1 — 2026-08-05 (ikki qatlamli brend modeli, ega qarori)
**Amalga oshirish fayllari:**

| Platforma | Fayl | Roli |
|---|---|---|
| Mobil (Flutter) | `mobile/lib/core/config/app_theme.dart` | **Asosiy manba kodi.** Barcha `k*` tokenlar shu yerda. |
| Mobil (superapp) | `mobile/lib/features/superapp/widgets/ag_design.dart` | Faqat alias (`agGreen = kPrimaryDark`). O'z qiymatini e'lon qilmaydi. `app_theme.dart` ni re-export qiladi. |
| Mobil (tashqi brend) | `mobile/lib/core/config/payment_brand_colors.dart` | **Dizayn tizimidan tashqarida.** Click/Payme ko'ki va karta chipi oltini — ataylab token qilinmaydi. |
| Dispetcher | `web-manager/src/app/globals.css` + `tailwind.config.js` | Ishlaydigan referens implementatsiya. |
| Boshqa panellar | `docs/design/globals-mint.css` + `docs/design/tailwind-mint.config.js` | **Tayyor nusxa** — to'g'ridan-to'g'ri ko'chiriladi. |

---

## 1. Nima uchun bu hujjat kerak bo'ldi

"Mint" dizayn tili uch joyda mustaqil ravishda takrorlangan edi va ular
bir-biriga mos kelmasdi. Aniqlangan ziddiyatlar:

| Token | `app_theme.dart` | `ag_design.dart` | `tailwind.config.js` / `globals.css` | Holat |
|---|---|---|---|---|
| primary | `#1FCA8E` | `#1FCA8E` (agMint) | `#1FCA8E` | ✅ mos |
| primary-dark | `#17A86A` | `#10A064` (agGreen) | `#10A064` | ❌ **ziddiyat** |
| mint-bright | — | `#27D89B` (agBright) | `#27D89B` (primary.light) | ⚠️ mobil'da yo'q edi |
| background | `#F6F8FA` | `#F4F7F8` (agBg) | `#F4F7F8` (`--bg`) | ❌ **ziddiyat** |
| surface-2 / input fill | `#EEF1F4` (kSurfaceGrey) | — | `#EDF3F4` (`--surface-2`) | ❌ **ziddiyat** |
| line / border | `#EEF1F4` (kSurfaceGrey) | `#E4E9ED` (agBorder) | `#DCE5E7` (`--line`) | ❌ **3 xil qiymat** |
| divider | `#EEF1F4` | `#F1F4F6` (agDivider) | — | ❌ **ziddiyat** |
| ink | `#0F1B22` | `#0F1B22` | `#0F1B22` | ✅ mos |
| ink-muted | `#6B7785` | `#6B7785` (agSubtle) | `#5A6C75` (`--ink-muted`) | ❌ **ziddiyat** |
| ink-subtle | — | `#9AA6B0` (agMuted) | `#85969E` (`--ink-subtle`) | ❌ **ziddiyat** |
| error/danger | `#E5484D` | `#E5484D` (agRed) | `#EF4444` (danger) | ❌ **ziddiyat** |
| warning | `#F5A623` | `#F59E0B` (agOrange) | `#F59E0B` (override) | ❌ **ziddiyat** |
| info | — | `#3B82F6` (agBlue) | `#3B82F6` | ✅ mos |
| purple | — | `#8B5CF6` (agPurple) | — | ⚠️ faqat bitta joyda |
| tint | `#E6FAF2` (kPrimaryLight) | `#E6FAF2` (agTint) | — | ⚠️ web'da yo'q edi |
| radius | 12 / 16 / 22 | 8, 9, 13, 14, 16, 18 (inline) | 12px, 14px (inline) | ❌ **shkalasiz** |
| font | Plus Jakarta Sans | — | Manrope | ⚠️ platformalararo farq |
| tipografika | 12–30 shkalasi | 10.5, 11, 12.5, 13, 14.5, 17, 19 (inline) | Tailwind standarti | ❌ **shkalasiz** |
| soya | `kInk 8%` (cardTheme) | 3 xil inline BoxShadow | `--shadow-card`, `--shadow-pop` | ❌ **ziddiyat** |
| animatsiya | yo'q | yo'q | 0.15s / 0.18s / 0.22s | ❌ **shkalasiz** |
| qorong'i tema | **yo'q** | **yo'q** | to'liq bor | ❌ **to'liq emas** |

Va uchala manbada ham **bitta `primary` ikki xil ishni bajarardi** —
ham tugma foni, ham dekorativ aksent. Aynan shu narsa kontrast muammosini
hal qilib bo'lmaydigan qilib qo'ygan edi (2.1-bo'limga qarang).

Bundan tashqari `web-manager/tailwind.config.js` dagi izoh
*"sourced from mobile/lib/core/config/app_theme.dart so the panel matches
the app"* **yolg'on edi** — `primary.dark` app_theme'dagidan farq qilardi.

Va mobile'ning 19 ta feature faylida jami **41 ta qattiq kodlangan
`Color(0xFF...)`** bor edi (5-bo'limga qarang).

---

## 2. Ziddiyatlar bo'yicha qarorlar va asoslash

Tanlash mezonlari (vazifada belgilangan tartibda):
**(a)** foydalanuvchi ko'proq ko'radigan yuza ustunlik qiladi →
**(b)** WCAG AA kontrasti (oddiy matn 4.5:1, katta matn/UI 3:1) →
**(c)** mavjud kodda kengroq ishlatilgani.

Barcha kontrast nisbatlari WCAG 2.1 relative-luminance formulasi bo'yicha
**hisoblangan** (taxmin emas).

### 2.1. Ikki qatlamli brend modeli (EGA QARORI)

Eng muhim tuzilma qarori. Ilgari bitta `primary` (mint `#1FCA8E`) ham
tugma foni, ham dekorativ aksent edi — bu esa hal qilib bo'lmaydigan
kontrast muammosini keltirib chiqarardi: mint ustidagi oq matn **2.12:1**,
ya'ni AA (4.5:1) dan ham, non-text 3:1 dan ham past.

**Ega qarori: interaktiv to'ldirishning FONI to'qlashadi, matn OQ qoladi.**

Shundan kelib chiqib brend ikki qatlamga ajratildi:

| Qatlam | Token | Qiymat | Ustidagi matn | Roli |
|---|---|---|---|---|
| **Interaktiv** | `primary` | `#0C7A4D` | **oq** — 5.38:1 ✓ AA | Tugma foni, faol toggle, tanlangan chegara, progress, link, fokus halqasi |
| **Aksent** | `mint` | `#1FCA8E` | **`mint-on` `#06231A`** — 7.84:1 ✓ AA | Chip/badge foni, tinted yuza, dekorativ ikonka, gradient boshi, diagramma |

**Rad etilgan muqobil:** mintni fon sifatida saqlab, matnni `#06231A` ga
o'tkazish (7.84:1). Ega rad etdi — u ilovaning ko'rinishini haddan tashqari
o'zgartirardi. Qabul qilingan variant esa **matn rangini umuman
o'zgartirmaydi**, faqat fonni to'qlashtiradi.

#### ⚠️ Mint uchun majburiy cheklov (kontrastdan kelib chiqadi)

`mint` (`#1FCA8E`) yorug' yuzada **ma'no tashiy olmaydi**:

| Kombinatsiya | Nisbat | Natija |
|---|---|---|
| `#1FCA8E` oq yuzada | **2.12:1** | ✗ non-text 3:1 dan past |
| `#1FCA8E` `#F4F7F8` fonida | **1.97:1** | ✗ |
| `#1FCA8E` qorong'i yuzada (`#111A17`) | **8.36:1** | ✓ |
| `#10A064` (`mint-deep`) oq yuzada | **3.37:1** | ✓ non-text |
| `#10A064` (`mint-deep`) `#F4F7F8` fonida | **3.13:1** | ✓ non-text |

**Qoida:** mint faqat (a) qorong'i yuzada, (b) ink matn ortidagi to'ldirish
sifatida, yoki (c) sof dekorativ (ma'no tashimaydigan) element sifatida.
Yorug' fonda **ko'rinishi shart** bo'lgan mint element — status nuqtasi,
indikator, diagramma segmenti — **`mint-deep` (`#10A064`)** ishlatadi.

### 2.2. Hover / pressed / disabled holatlari

| Holat | Token | Qiymat | Oq matn bilan | Fondan farqi |
|---|---|---|---|---|
| Normal | `primary` | `#0C7A4D` | **5.38:1** ✓ AA | — |
| Hover / focus | `primary-hover` | `#0A6741` | **6.93:1** ✓ AA | 1.29:1 (sezilarli) |
| Pressed / active | `primary-pressed` | `#084F32` | **9.66:1** ✓ AA | 1.80:1 (aniq) |
| Disabled | `primary-disabled` fon `#EDF3F4` + `ink-muted` yozuv | — | **4.88:1** ✓ AA | — |

Har uchala holat ham oq matn bilan AA'dan o'tadi, ya'ni holat o'zgarganda
matn rangini almashtirish kerak emas. Disabled holat rang bilan emas,
**yorug'lik va to'yinganlikning yo'qolishi** bilan bildiriladi — shuning
uchun uning yozuvi `ink-muted` (4.88:1), ya'ni o'qilishi saqlanadi.

**Tugma chegarasi (WCAG 1.4.11, 3:1):** `#0C7A4D` oq yuzada 5.38:1, ilova
fonida 4.99:1 — chegara aniq. Qorong'i temada esa `#0C7A4D` `surface-2`
(`#18241F`) ustida atigi **2.98:1** berardi — tugma fonga qo'shilib ketardi.
Shuning uchun **qorong'i tema uchun alohida `primary-on-dark = #0E8855`**:
oq matn bilan **4.50:1** (AA chegarasida) va `surface-2` bilan **3.56:1** ✓.

### 2.3. Fokus halqasi (yangi token — ilgari umuman yo'q edi)

Klaviatura navigatsiyasi uchun ko'rinadigan fokus indikatori majburiy
(WCAG 2.4.7 + 1.4.11 uchun fon bilan 3:1).

`web-manager/globals.css` da `:focus-visible { outline: 2px solid #1fca8e }`
bor edi — **oq ustida 2.12:1, fon ustida 1.97:1**, ya'ni fokus halqasi
amalda ko'rinmasdi. Bu tuzatildi:

| Token | Yorug' | Qorong'i | Kontrast |
|---|---|---|---|
| `focus-ring` | `#0C7A4D` | `#6FE4B8` | oq: **5.38:1** · bg: **4.99:1** · surface-2: **4.79:1** · dark surface: **11.37:1** — hammasi ✓ |

Halqa `2px` qalinlikda va `2px` offset bilan chiziladi — offset tufayli
halqa tugmaning o'zi bilan emas, **sahifa foni bilan** kontrast hosil
qiladi, shuning uchun to'q yashil tugma ustida ham ko'rinadi.

### 2.4. `mint-deep` / `primary-text`: yorug' fonda yashil MATN

`#10A064` matn sifatida oq ustida 3.37:1 — AA'dan o'tmaydi. Shuning uchun
yashil matn, link va chip yozuvi har doim **`#0C7A4D`** (oq ustida
**5.38:1**, mint tint ustida **4.95:1**). Qorong'i temada bu rol
**`#6FE4B8`** ga o'tadi (**11.37:1**) — `--primary-text` CSS o'zgaruvchisi
va Tailwind'dagi `text-primary-text` ikkala temani avtomatik hal qiladi.

### 2.5. `background`: `#F6F8FA` ❌ → **`#F4F7F8`** ✅

**Qaror: `#F4F7F8`.**
(a) Foydalanuvchi ko'proq ko'radigan yuza — superapp ekranlari (`agBg`) va
dispetcher paneli (`--bg`), ikkalasi ham `#F4F7F8`. `#F6F8FA` faqat
`Scaffold` fonida edi. (c) 2 manba vs 1. Kontrast farqi ahamiyatsiz
(ink 16.44:1 → 16.25:1, ikkalasi ham AA'dan ancha yuqori).

### 2.6. `ink-muted`: `#6B7785` ❌ → **`#5A6C75`** ✅

| Nomzod | Oq ustida | Fon `#F4F7F8` ustida | `#EDF3F4` ustida |
|---|---|---|---|
| `#6B7785` (mobil, 2 manba) | 4.56:1 ✓ | **4.24:1 ✗** | ~4.1:1 ✗ |
| `#5A6C75` (web) | **5.47:1 ✓** | **5.08:1 ✓** | **4.88:1 ✓** |

**Qaror: `#5A6C75`.**
Mezon (c) mobil foydasiga ishlaydi, lekin **(b) ustun turadi**: `#6B7785`
oq karta ustida arang o'tadi, ilova fonida esa (barcha ikkilamchi yozuvlar
shu yerda) **AA'dan o'tmaydi**. `#5A6C75` har uch yuzada ham o'tadi.

### 2.7. `ink-subtle`: `#9AA6B0` / `#85969E` ❌ → **`#78888F`** ✅

| Nomzod | Oq ustida | Fon ustida |
|---|---|---|
| `#9AA6B0` (agMuted) | **2.48:1 ✗** | **2.31:1 ✗** |
| `#85969E` (web) | 3.06:1 ✓ | **2.85:1 ✗** |
| `#78888F` (**yangi**) | **3.67:1 ✓** | **3.41:1 ✓** |

**Qaror: `#78888F`.**
Ikkala mavjud qiymat ham kamida bitta yuzada 3:1 dan past — ya'ni
placeholder va passiv ikonalar ko'rinmas darajada edi. `#78888F` — ikkala
mavjud qiymatga eng yaqin, lekin har ikkala fonda ham 3:1 dan o'tadigan
qiymat. **Bu token faqat katta matn, placeholder va dekorativ ikonalar
uchun** — oddiy matn uchun `ink-muted` ishlating.

### 2.8. `danger`: `#EF4444` ❌ → **`#E5484D`** ✅

**Qaror: `#E5484D`.** (c) 2 manba (app_theme `kError` + ag_design `agRed`)
vs 1. (b) `#E5484D` 3.91:1, `#EF4444` 3.76:1 — ikkalasi ham oddiy matn
uchun yetarli emas, shuning uchun **`danger-deep = #B91C1C` (6.47:1)**
matn uchun alohida token sifatida saqlanadi.

### 2.9. `warning`: `#F5A623` ❌ → **`#F59E0B`** ✅

**Qaror: `#F59E0B`.** (c) 2 manba vs 1. (b) `#F5A623` oq ustida 2.03:1,
`#F59E0B` 2.15:1 — **amber hech qachon oq fonda matn rangi bo'lolmaydi**.
Matn uchun `warning-deep = #B45309` (5.02:1), yoki amber to'ldirish ustida
`ink` (8.15:1).

### 2.10. `line` (chegara): 3 xil qiymat → **`#E4E9ED`** ✅

**Qaror: `#E4E9ED` (agBorder).**
(a) Mobil ilova foydalanuvchiga ko'proq ko'rinadi. Chegaralar matn emas,
shuning uchun (b) qo'llanilmaydi (1.22:1 vs 1.28:1 — ikkalasi ham dekorativ).
Karta **ichidagi** ingichka ajratkich uchun alohida `divider = #F1F4F6`
saqlanadi (agDivider), kuchli chegara uchun `line-strong = #C6D4D7`.

### 2.11. Shrift: **platformalararo ataylab farqli**

Mobil `Plus Jakarta Sans`, web `Manrope`. Ikkalasi ham geometrik-gumanistik
grotesk, x-height va og'irlik shkalasi juda yaqin. Ikkalasini birlashtirish
har ikkala platformadagi HAR BIR ekranni qayta ko'rib chiqishni talab qiladi
— bu poydevor bosqichining doirasidan tashqarida.

**Qaror:** shrift *oilasi* platformaga bog'liq, lekin **shkala, og'irliklar
va letter-spacing kanonik va bir xil** (7-bo'lim). Bu farq — bilib qilingan
va hujjatlashtirilgan yagona istisno.

---

## 3. Kanonik tokenlar

### 3.1. Brend — INTERAKTIV qatlam (`primary`)

> Tugma foni, faol toggle, tanlangan chegara, progress, chat pufakchasi,
> link matni, fokus halqasi. **Ustidagi matn har doim OQ.**

| Token | Qiymat | Dart | Tailwind | Qayerda ishlatiladi | Kontrast |
|---|---|---|---|---|---|
| `primary` | `#0C7A4D` | `kPrimary` | `bg-primary` | Asosiy interaktiv to'ldirish | oq matn **5.38:1 AA** |
| `primary-hover` | `#0A6741` | `kPrimaryHover` | `bg-primary-hover` | Hover / focus holati | oq matn **6.93:1 AA** |
| `primary-pressed` | `#084F32` | `kPrimaryPressed` | `bg-primary-pressed` | Bosilgan holat | oq matn **9.66:1 AA** |
| `primary-on-dark` | `#0E8855` | `kPrimaryOnDark` | `bg-primary-on-dark` | Qorong'i temada to'ldirish | oq **4.50:1 AA**, `surface-2` bilan **3.56:1** |
| `on-primary` | `#FFFFFF` | `kOnPrimary` | `text-white` / `text-primary-on` | `primary` to'ldirish ustidagi matn/ikona | — |
| `primary-disabled` | `#EDF3F4` | `kPrimaryDisabled` | `bg-surface-2` | O'chirilgan tugma foni | yozuv `ink-muted` **4.88:1 AA** |
| `primary-text` | `#0C7A4D` / `#6FE4B8` | `kPrimary` / `kMintSoft` | `text-primary-text` | **Yorug'/qorong'i fonda yashil MATN**, link | **5.38:1** / **11.37:1 AA** |
| `focus-ring` | `#0C7A4D` / `#6FE4B8` | `kFocusRing` / `kFocusRingDark` | `ring-focus` | Klaviatura fokus halqasi (2px + 2px offset) | bg bilan **4.99:1** / **12.15:1** |

### 3.1b. Brend — AKSENT qatlam (`mint`)

> Chip/badge foni, tinted yuza, dekorativ ikonka, gradient boshi,
> diagramma rangi. **Ustidagi matn har doim `mint-on` — hech qachon oq.**

| Token | Qiymat | Dart | Tailwind | Qayerda ishlatiladi | Kontrast |
|---|---|---|---|---|---|
| `mint` | `#1FCA8E` | `kMint` | `bg-mint` | Aksent to'ldirish (ink matn bilan), qorong'i yuzada ikona | `mint-on` matn **7.84:1 AA**; oq yuzada 2.12:1 — **ma'no tashimaydi** |
| `mint-bright` | `#27D89B` | `kMintBright` | `bg-mint-bright` | Gradient boshi, badge | `mint-on` matn **9.01:1 AA** |
| `mint-deep` | `#10A064` | `kMintDeep` | `bg-mint-deep` | **Yorug' fonda ko'rinishi shart bo'lgan mint** — status nuqtasi, indikator, diagramma | oq yuzada **3.37:1** ✓ non-text |
| `mint-soft` | `#6FE4B8` | `kMintSoft` | `text-mint-soft` | Qorong'i fonda yashil matn/ikona | `#111A17` ustida **11.37:1 AA** |
| `mint-tint` | `#E6FAF2` / `#0E2A20` | `kMintTint` / `kMintTintDark` | `bg-mint-tint` | Chip, badge, tanlangan qator foni | ustida `ink` **16.10:1**, `primary-text` **4.95:1** |
| `on-mint` | `#06231A` | `kOnMint` | `text-mint-on` | `mint` / `mint-bright` to'ldirish ustidagi matn | **7.84:1** / **9.01:1 AA** |

> **Yodda tuting:** `text-white` + `bg-mint` = **2.12:1** — hech qachon.
> `text-white` + `bg-primary` = **5.38:1** — har doim.

### 3.2. Neytrallar

| Token | Yorug' | Qorong'i | Dart (light) | Tailwind | Qayerda | Kontrast (matn uchun) |
|---|---|---|---|---|---|---|
| `bg` | `#F4F7F8` | `#0B1210` | `kBackground` | `bg-bg` | Ilova/sahifa foni | — |
| `surface` | `#FFFFFF` | `#111A17` | `kSurface` | `bg-surface` | Karta, sheet, modal, navbar | — |
| `surface-2` | `#EDF3F4` | `#18241F` | `kSurface2` | `bg-surface-2` | Input to'ldirishi, skeleton, ikona konteyneri | — |
| `surface-3` | `#E2EBEC` | `#202F29` | `kSurface3` | `bg-surface-3` | Bosilgan holat, ichki blok | — |
| `line` | `#E4E9ED` | `#25352F` | `kLine` | `border-line` | Karta/input chegarasi | — |
| `line-strong` | `#C6D4D7` | `#374C44` | `kLineStrong` | `border-line-strong` | Kuchli ajratkich, jadval chizig'i | — |
| `divider` | `#F1F4F6` | `#1A2621` | `kDivider` | `border-divider` | Karta ICHIDAGI ingichka ajratkich | — |
| `ink` | `#0F1B22` | `#E8F1ED` | `kInk` | `text-ink` | Asosiy matn, sarlavha | L **17.50:1** / D **15.40:1** ✓ |
| `ink-muted` | `#5A6C75` | `#96AAA2` | `kInkMuted` | `text-muted` | Ikkilamchi matn, izoh, label | L **5.47:1** / D **7.24:1** ✓ AA |
| `ink-subtle` | `#78888F` | `#7E948B` | `kInkSubtle` | `text-subtle` | Placeholder, passiv ikona, timestamp | L **3.67:1** / D **5.49:1** — ⚠️ **faqat katta matn / UI** |

> Yorug' tema kontrasti `#FFFFFF` (surface) ustida, qorong'i tema `#111A17`
> (surface) ustida hisoblangan.

### 3.3. Semantik (status) ranglar

Har bir semantik rang **4 ta variantga** ega:
`DEFAULT` (to'ldirish/ikona) · `deep` (yorug' fonda MATN) ·
`light`/dark-variant (qorong'i fonda MATN) · `tint` (yumshoq fon).

| Semantika | DEFAULT | deep (light matn) | dark-variant | tint (L / D) | Ma'nosi |
|---|---|---|---|---|---|
| **danger** | `#E5484D` (3.91:1 UI) | `#B91C1C` (**6.47:1 AA**) | `#FF6369` (**6.12:1 AA**) | `#FEF2F2` / `#2A1416` | Xato, bekor qilish, SOS |
| **warning / override** | `#F59E0B` (2.15:1 — faqat fon) | `#B45309` (**5.02:1 AA**) | `#FBBF24` (**10.63:1 AA**) | `#FFFBEB` / `#2A1F08` | Ogohlantirish; dispetcherda — **qo'lda aralashuv** |
| **info** | `#3B82F6` (3.68:1 UI) | `#1D4ED8` (**6.70:1 AA**) | `#60A5FA` (**6.98:1 AA**) | `#EFF6FF` / `#0E1E33` | Ma'lumot, neytral holat |
| **violet (accent)** | `#8B5CF6` (4.23:1) | `#6D28D9` (**7.10:1 AA**) | `#A78BFA` (**6.52:1 AA**) | `#F5F3FF` / `#1E1633` | Promo, kategoriya, bonus |
| **success** | = `mint` `#1FCA8E` | = `primary` `#0C7A4D` | = `mint-soft` `#6FE4B8` | `#E6FAF2` / `#0E2A20` | Muvaffaqiyat, faol, onlayn |

> **Muhim qoida:** `success` uchun alohida yashil KIRITILMAYDI — u brend
> minti va interaktiv yashilning o'zi. Bu "yana bitta yashil" muammosining
> oldini oladi. Yorug' fondagi "onlayn" nuqtasi — `mint-deep` (3.37:1).
>
> **Dispetcher qoidasi (saqlanadi):** mint = tizim o'zi hal qilyapti,
> amber (`override`) = odam aralashdi. Bu ikki rang bir-biridan uzoq turishi shart.

### 3.4. Gradientlar

Gradient ustidagi matn kontrasti **gradientning eng och nuqtasida**
hisoblanadi (o'rtachasida emas) — chunki matn ana o'sha nuqtada eng yomon
o'qiladi.

| Token | Qiymat | Dart | Tailwind | Ustidagi matn | Eng och nuqta → eng to'q |
|---|---|---|---|---|---|
| `gradient-cta` | `#0C7A4D → #084F32`, 135° | `kGradientCta` | `bg-gradient-cta` | **oq** | **5.38:1 → 9.66:1** ✓ AA |
| `gradient-mint` | `#27D89B → #10A064`, 225° | `kGradientMint` | `bg-gradient-mint` | **`ink` (`#0F1B22`)** — oq TAQIQ | **9.48:1 → 5.19:1** ✓ AA (oq bo'lsa 1.85:1 ✗) |
| `gradient-ink` | `#0F1B22 → #1D3A2F`, 135° | `kGradientInk` | `bg-gradient-ink` | **oq** | **12.36:1 → 17.50:1** ✓ AA |

#### Nima uchun mint gradient CTA'dan chiqarildi

Eski CTA gradienti `#1FCA8E → #10A064` edi va ustida oq matn turardi:
eng och nuqtada **2.12:1**, eng to'q nuqtada **3.37:1** — **butun diapazon
AA'dan o'tmasdi**.

Uni saqlab qolish uchun uchta yo'l ko'rib chiqildi:

1. **Diapazonni to'qlashtirish.** Oq matn 4.5:1 talab qilgani uchun
   gradientning eng och nuqtasi `#0C7A4D` dan ochroq bo'la olmaydi
   (`#0E8D59` → 4.22:1 ✗, `#0E8855` → 4.50:1 — chegara). Ya'ni
   "to'qlashtirilgan mint gradient" amalda mint bo'lmay qoladi.
   → Natijada `gradient-cta` = `#0C7A4D → #084F32` (5.38 → 9.66).
2. **Matnni ink qilish.** Ega rad etdi (2.1-bo'lim).
3. **Gradientni CTA'dan chiqarish.** Qabul qilindi: `gradient-mint`
   endi faqat **dekorativ** — hero yuza, illustratsiya, header fon —
   va ustiga faqat `ink` matn qo'yiladi (9.48 → 5.19, ikkalasi ham AA).

`gradient-ink` (to'q kartalar) oq matn bilan eng och nuqtasida ham
**12.36:1** beradi — hech qanday o'zgarish talab qilmadi.

## 4. Ranglardan tashqari tokenlar

### 4.1. Radius shkalasi

| Token | px | Dart | CSS | Tailwind | Qayerda |
|---|---|---|---|---|---|
| `radius-xs` | 8 | `kRadiusXs` | `--radius-xs` | `rounded-ds-xs` | Badge, kichik teg, count pill |
| `radius-sm` | 12 | `kRadiusSm` | `--radius-sm` | `rounded-ds-sm` | Chip, ikona konteyneri, tooltip |
| `radius-md` | 16 | `kRadiusMd` | `--radius-md` | `rounded-ds-md` | **Tugma, input, standart karta** |
| `radius-lg` | 22 | `kRadiusLg` | `--radius-lg` | `rounded-ds-lg` | Katta karta, panel, hero |
| `radius-xl` | 28 | `kRadiusXl` | `--radius-xl` | `rounded-ds-xl` | Bottom sheet, modal, drawer |
| `radius-full` | 999 | `kRadiusFull` | — | `rounded-full` | Avatar, pill tugma |

> ⚠️ **Web:** Tailwind'ning standart `rounded-lg` / `rounded-xl` / `rounded-md`
> nomlari **ataylab qayta belgilanmadi** — faqat `web-manager` da ular 83 joyda
> ishlatilgan, bir zarbada o'zgartirish butun panelni buzadi. Yangi kod
> `rounded-ds-*` ishlatsin (`ds` = design system; `mint` endi rang qatlamining
> nomi). Migratsiya bosqichma-bosqich:
> `rounded-lg` (8px) → `rounded-ds-xs` (8px, bir xil), `rounded-xl` (12px)
> → `rounded-ds-sm` (12px, bir xil), `rounded-2xl` (16px) →
> `rounded-ds-md` (16px, bir xil). Ya'ni migratsiya **vizual jihatdan neytral**.

### 4.2. Spacing shkalasi (4pt grid)

| Token | px | Dart | Tailwind | Odatiy qo'llanishi |
|---|---|---|---|---|
| `space-1` | 4 | `kSpace1` | `p-1` / `gap-1` | Ikona bilan matn orasi |
| `space-2` | 8 | `kSpace2` | `p-2` | Element ichidagi kichik oraliq |
| `space-3` | 12 | `kSpace3` | `p-3` | Ro'yxat elementlari orasi |
| `space-4` | 16 | `kSpace4` | `p-4` | **Standart ekran gutter, karta padding** |
| `space-5` | 20 | `kSpace5` | `p-5` | Kengaytirilgan karta padding |
| `space-6` | 24 | `kSpace6` | `p-6` | Bo'limlar orasi |
| `space-8` | 32 | `kSpace8` | `p-8` | Katta bo'limlar orasi |
| `space-10` | 40 | `kSpace10` | `p-10` | Ekran yuqori/quyi bo'shlig'i |

Mobil'da ekran gutter uchun `kScreenPadding` (`EdgeInsets.symmetric(horizontal: 16)`).

### 4.2b. O'lcham shkalasi — tegish maydoni va boshqaruv balandligi

| Token | px | Dart | Qayerda |
|---|---|---|---|
| `min-tap-target` | 48 | `kMinTapTarget` | **Har qanday bosiladigan elementning minimal tegish maydoni** (WCAG 2.5.8 AA). Vizual o'lchami kichik bo'lsa `ConstrainedBox`/`SizedBox` bilan kengaytiriladi. |
| `control-height` | 54 | `kControlHeight` | To'liq kenglikdagi CTA tugmasi, input balandligi |
| `control-height-sm` | 48 | `kControlHeightSm` | Kompakt boshqaruv (chip tugma, ikona tugma) |

> Ilgari tugma balandligi 50 / 54 / 56 sifatida uch xil edi (`app_theme`,
> `AppButton`, `AgPrimaryButton`, `profile_tab`) — hammasi `kControlHeight` ga
> keltirildi.

### 4.3. Tipografika shkalasi

Shrift oilasi: **mobil — Plus Jakarta Sans**, **web — Manrope**
(2.11-bo'limdagi asoslashga qarang). Shkala ikkalasida bir xil.

| Token | px | rem | Og'irlik | Letter-spacing | Dart | Tailwind | Qayerda |
|---|---|---|---|---|---|---|---|
| `display` | 30 | 1.875 | 800 | −0.5 | `kFontDisplay` | `text-display` | Onboarding, katta summa |
| `h1` | 23 | 1.4375 | 700 | −0.3 | `kFontH1` | `text-h1` | Sahifa sarlavhasi |
| `h2` | 19 | 1.1875 | 800 | −0.2 | `kFontH2` | `text-h2` | Ekran header sarlavhasi |
| `h3` | 17 | 1.0625 | 800 | 0 | `kFontH3` | `text-h3` | Bo'lim sarlavhasi |
| `title` | 16 | 1 | 600 | 0 | `kFontTitle` | `text-title` | Karta sarlavhasi, tugma yozuvi |
| `body-lg` | 16 | 1 | 400 | 0 | `kFontBodyLg` | `text-body-lg` | Asosiy matn (muhim) |
| `body` | 14 | 0.875 | 400 | 0 | `kFontBody` | `text-body` | Asosiy matn |
| `label` | 13 | 0.8125 | 700 | 0 | `kFontLabel` | `text-label` | Tugma/teg yozuvi |
| `caption` | 12 | 0.75 | 500 | 0 | `kFontCaption` | `text-caption` | Izoh, timestamp |
| `micro` | 11 | 0.6875 | 800 | +0.2 | `kFontMicro` | `text-micro` | Badge, status pill |

> **WCAG eslatmasi:** "katta matn" = ≥18.66px bold yoki ≥24px normal.
> Ya'ni shkalada faqat `display` katta matn hisoblanadi. `h1`/`h2`
> (23px w700 / 19px w800) — 24px dan kichik, shuning uchun ular ham
> **4.5:1** talab qiladi. Sarlavhalarda faqat `ink` ishlating.

### 4.4. Elevation (soyalar)

| Token | Yorug' | Qorong'i | Dart | CSS / Tailwind | Qayerda |
|---|---|---|---|---|---|
| `elev-1` (card) | `0 1px 2px rgba(15,27,34,.05), 0 10px 24px -14px rgba(15,27,34,.22)` | `0 1px 2px rgba(0,0,0,.35), 0 12px 32px -16px rgba(0,0,0,.7)` | `kShadowCard` | `--shadow-card` / `shadow-card` | Karta, ro'yxat elementi, sticky header |
| `elev-2` (pop) | `0 8px 32px -8px rgba(15,27,34,.22), 0 2px 8px rgba(15,27,34,.08)` | `0 12px 40px -10px rgba(0,0,0,.75), 0 2px 8px rgba(0,0,0,.4)` | `kShadowPop` | `--shadow-pop` / `shadow-pop` | Modal, dropdown, bottom sheet |
| `elev-cta` | `0 14px 28px -8px rgba(12,122,77,.32)` | alfa `.45` | `kShadowCta` | `--shadow-cta` / `shadow-cta` | Asosiy tugma ostidagi yashil "glow" |
| `elev-ink` | `0 16px 34px rgba(15,27,34,.28)` | — | `kShadowInk` | — | To'q suzuvchi pill (savat bari) |

### 4.5. Animatsiya

| Token | Qiymat | Dart | CSS | Tailwind | Qayerda |
|---|---|---|---|---|---|
| `duration-fast` | 150ms | `kDurationFast` | `--duration-fast` | `duration-fast` | Hover, fade, kichik holat o'zgarishi |
| `duration-base` | 200ms | `kDurationBase` | `--duration-base` | `duration-base` | Drawer, tab almashish |
| `duration-slow` | 300ms | `kDurationSlow` | `--duration-slow` | `duration-slow` | Sahifa o'tishi, katta sheet |
| `duration-slower` | 500ms | `kDurationSlower` | `--duration-slower` | `duration-slower` | Onboarding, illustratsiya |
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | `kEaseStandard` | `--ease-standard` | `ease-standard` | Standart (kirish+chiqish) |
| `ease-emphasized` | `cubic-bezier(0.32, 0.72, 0, 1)` | `kEaseEmphasized` | `--ease-emphasized` | `ease-emphasized` | Sheet, drawer, modal |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | `kEaseOut` | `--ease-out` | `ease-out` | Paydo bo'lish |

Doimiy animatsiyalar (shkaladan tashqari, ataylab): `shimmer 1.6s`,
`pulse-ring 1.8s`.

---

## 5. Mobil'dagi qattiq kodlangan ranglar → token xaritasi

19 ta faylda 41 ta `Color(0xFF...)` topildi. Quyidagi jadval keyingi
agentlar uchun **almashtirish yo'riqnomasi**. `ag_design.dart` dagi 2 tasi
allaqachon tuzatildi.

| Hex | Nechta | Fayllar | Kanonik token | Izoh |
|---|---|---|---|---|
| `#06231A` | 8 | `home_tab`, `wallet_screen`, `promos_screen`, `referral_screen` | **`kOnMint` / `agOnMint`** | Mint pill ustidagi matn — to'g'ridan-to'g'ri mos |
| `#C2CCD4` | 4 | `support_screen`, `cart_screen`, `settings_screen`, `profile_tab` | **`kInkSubtle` / `agMuted`** | ⚠️ Oq ustida 1.63:1 — ko'rinmas; `#78888F` (3.67:1) ga o'tadi, **sezilarli o'zgarish** |
| `#F8FAFB` | 3 | `restaurant_detail_screen`, `product_detail_screen`, `topup_screen` | **`kSurface2` / `agSurface2`** | `#EDF3F4` — biroz to'qroq |
| `#DCE2E6` | 3 | `cart_screen`, `checkout_screen`, `order_detail_screen` | **`kLine` / `agBorder`** | Ajratkich chizig'i |
| `#1D3A2F` | 3 | `referral_screen`, `promos_screen`, `wallet_screen` | **`kGradientInk` / `agInkGradient`** | Ink gradient oxiri — gradientning o'zini ishlating |
| `#0F1B22` | 3 | `services_screen` va boshq. | **`kInk` / `agInk`** | To'g'ridan-to'g'ri mos |
| `#E7ECEF` | 2 | `orders_screen`, `order_detail_screen` | **`kLine` / `agBorder`** | — |
| `#EFF6FF` | 2 | `support_screen`, `checkout_screen` | **`kInfoLight`** | Yangi token |
| `#F59E0B` | 2 | `services_screen` | **`kWarning` / `agOrange`** | To'g'ridan-to'g'ri mos |
| `#3B82F6` | 2 | `services_screen` | **`kInfo` / `agBlue`** | To'g'ridan-to'g'ri mos |
| `#8B5CF6` | 2 | `services_screen` | **`kAccentViolet` / `agPurple`** | To'g'ridan-to'g'ri mos |
| `#1FCA8E` | 2 | `services_screen` | **`kMint` / `agMint`** | ⚠️ Aksent qatlami — `kPrimary` EMAS |
| `#1FA0E5`, `#0B6BB5` | 2+2 | `wallet_screen`, `topup_screen` | ❗ **mos token YO'Q** | To'lov provayderi (Click/Payme) brend ko'ki. **Ataylab token qilinmaydi** — bu tashqi brend rangi. `payment_brand_colors.dart` kabi alohida faylga chiqarish tavsiya etiladi |
| `#F4D04A`, `#D4A82B` | 1+1 | `add_card_screen` | ❗ **mos token YO'Q** | Karta chipi (oltin) — dekorativ illustratsiya. Alohida saqlansin |
| `#34C759`, `#1E9E45` | 1+1 | `wallet_screen` | ❗ **mos token YO'Q** | iOS-uslubidagi yashil. **`kMint`/`kMintDeep` ga ko'chirilsin** — brendga mos kelmaydi |
| `#FFD43B` | 1 | `home_tab` | ❗ | Reyting yulduzi (sariq). `kWarningDark` (`#FBBF24`) ga eng yaqin |
| `#12A877` | 1 | `services_screen` | **`kMintDeep`** | Taksi kartochkasi gradienti oxiri |
| `#F5A623` | 1 | `home_screen` | **`kWarning`** | Eski warning qiymati |
| `#FB923C`, `#A78BFA`, `#2563EB`, `#12A877` | 1 ta | `services_screen` | **`kWarning`/`kAccentVioletDark`/`kInfoDeep`/`kMintDeep`** | Xizmat kartochkalari gradienti — `kGradient*` ga o'tsin |
| `#F1D6D6` | 1 | `profile_tab` | **`kErrorBorder`** (`#F3D3D4`, yangi token) | Destruktiv harakat konturi — dekorativ, matn emas |
| `#DBF3E8` | 1 | `orders_screen` | **`kMintTint`** (`#E6FAF2`) | — |
| `#1D2D34`, `#23413A`, `#1F3A34`, `#2D2D2D` | 1 ta | `home_tab`, `add_card_screen`, `services_screen`, `earnings_screen` | **`kGradientInk`** | To'rt xil "to'q gradient oxiri" — bittaga birlashsin |
| `#F1F4F6` | 1 | — | **`kDivider`** | — |
| `#E4E9ED` | 1 | — | **`kLine`** | — |
| `#E6FAF2` | 1 | — | **`kPrimaryLight`** | — |
| `#E5484D` | 1 | — | **`kError`** | — |
| `#9AA6B0`, `#6B7785` | 1+1 | — | **`kInkSubtle`**, **`kInkMuted`** | Eski qiymatlar |
| `#27D89B` | 1 | — | **`kMintBright`** | — |
| `#10A064` | 1 | — | **`kMintDeep`** | — |
| `#FFFFFF` | 1 | — | **`kSurface`** | — |

---

## 6. Vizual jihatdan o'zgaradigan ekranlar va sahifalar

> **Asosiy tamoyil:** CTA MATNI o'zgarmaydi — u oq bo'lgan va oq qoladi.
> O'zgaradigan narsa — CTA **FONI**: mint (`#1FCA8E`) o'rniga to'q yashil
> (`#0C7A4D`). Mint yo'qolmaydi, u chip, badge, tinted yuza va
> indikatorlarda qoladi.

### 6.1. Mobil ilova

| O'zgarish | Ta'sir | Ta'sirlangan ekranlar |
|---|---|---|
| **`kPrimary` mint → to'q yashil (`#1FCA8E` → `#0C7A4D`)** — barcha interaktiv to'ldirishlar | 🔴 **Yuqori** | `ElevatedButton` ishlatadigan BARCHA ekranlar (login, OTP, destination, map_picker, tariff, KYC, withdraw, checkout, ...), `FloatingActionButton`, `app_button.dart` (umumiy tugma vidjeti), chat pufakchasi va yuborish tugmasi (`trip_chat_screen`), SOS snackbar (`passenger/home_screen`), tanlangan tarif/to'lov chegarasi (`tariff_select_screen`), progress indikatorlari (`tariff_select`, `driver_onboarding`), bottom-nav faol elementi |
| **`AgPrimaryButton` foni mint gradient → to'q yashil gradient**, yozuvi oq qoladi | 🔴 **Yuqori** | BARCHA superapp ekranlari: checkout, cart, product_detail, restaurant_detail, topup, add_card, order_detail, orders, promos, support, settings, profile_tab, wallet, home_tab |
| **`agHeader` gradienti mint → to'q yashil** | 🔴 **Yuqori** | `home_tab` va `profile_tab` hero header'lari. Sabab: ular ustida 13 va 11 ta oq matn bor edi, mint gradientning eng och nuqtasida **1.85:1** — jiddiy qoidabuzarlik. Matnni o'zgartirmaslik uchun fon to'qlashtirildi |
| Mint gradientli CTA'lar → `kGradientCta` | 🟡 O'rta | `tariff_select_screen` asosiy tugmasi, `driver/home_screen` "Onlayn" toggle'i, `passenger/home_screen` qidiruv ikonasi va qo'ng'iroq tugmasi, `order_offer_screen` daromad kartasi, `loading_widget` |
| `TextButton` / chip yozuvi `#17A86A` → `#0C7A4D` | 🟡 O'rta | login, OTP, profil ekranlaridagi ikkilamchi harakatlar |
| `agMuted` `#9AA6B0` → `#78888F` | 🟡 O'rta | `AgIconButton` chevron'lari, placeholder'lar — sezilarli to'qroq (maqsadli) |
| `agCardShadow` bir qatlamli → ikki qatlamli | 🟡 O'rta | `AgHeader` va barcha superapp kartalari |
| `kBackground` `#F6F8FA` → `#F4F7F8` | 🟢 Past | Barcha `Scaffold` fonlari |
| `kTextSecondary` `#6B7785` → `#5A6C75` | 🟢 Past | Barcha ikkilamchi yozuvlar |
| `kSurfaceGrey` `#EEF1F4` → `#EDF3F4` | 🟢 Past | Input to'ldirishlari |
| `kWarning` `#F5A623` → `#F59E0B` | 🟢 Past | Reyting yulduzi, ogohlantirishlar |

**Mint ATAYLAB saqlangan joylar** (aksent qatlami — vizual o'zgarish yo'q):
marshrut polilinesi va boshlanish nuqtasi (`tariff_select_screen`),
haydovchi avatarining gradient halqasi (`passenger/home_screen`),
"Tez xizmat" ikonasi va uning halosi (`services_screen`),
loader halosi (`loading_widget`), barcha chip/badge fonlari (`kMintTint`),
`agMint`/`agBright`/`agTint` ishlatadigan barcha superapp elementlari.

### 6.2. `web-manager` (hozir ishlab turgan panel)

| O'zgarish | Ta'sir | Qayerda |
|---|---|---|
| **`Button` primary varianti: mint fon + ink yozuv → to'q yashil fon + OQ yozuv** | 🔴 **Yuqori** | `components/ui/Button.tsx` — panelning barcha asosiy tugmalari. **Majburiy tuzatish:** eski `text-[#04231A]` yangi `#0C7A4D` fon ustida **3.10:1** bo'lib qolardi (AA'dan o'tmaydi) |
| Status/indikator nuqtalari `bg-primary` → `bg-mint-deep` | 🟡 O'rta | `drivers/page`, `dispatch/page` (ulanish), `DriverCard`, `DriverMap`, `Sidebar` (faol rail), `StatTile`, marshrut nuqtalari (`OrderCard`, `OrderDetailDrawer`, `AssignDriverModal`, `CreateOrderForm`, `orders/[id]`). Mint saqlanadi, lekin `#10A064` — yorug' fonda **2.12:1 → 3.37:1** |
| `Badge` primary varianti `text-primary-dark` → `text-primary-text` | 🟢 Past | `components/ui/Badge.tsx` — temaga mos yashil yozuv |
| **Fokus halqasi `#1FCA8E` → `#0C7A4D`/`#6FE4B8`** | 🟢 Past (lekin muhim) | Global `:focus-visible` — ilgari **2.12:1**, ya'ni klaviatura fokusi ko'rinmasdi |
| `.btn-cta` gradienti mint → to'q yashil, yozuv oq | 🟢 Past | Utility klass (hozircha kam ishlatilgan) |
| `--ink-subtle` `#85969E` → `#78888F` | 🟢 Past | Timestamp, placeholder |
| `--line` `#DCE5E7` → `#E4E9ED` | 🟢 Past | Barcha chegaralar |
| `danger` `#EF4444` → `#E5484D` | 🟢 Past | 62 ta joy |
| `.surface-card` radius 14px → 16px | 🟢 Past | Barcha kartalar |

**Nomi o'zgargan Tailwind kalitlari** (keyingi agentlar diqqatiga):
`primary.light`/`primary.dark` → **olib tashlandi** (`mint-bright`/`mint-deep`
ga o'tdi); `accent` (binafsha) → **`violet`**; `rounded-mint-*` → **`rounded-ds-*`**.
Panel ichida ularning barcha ishlatilishi tuzatildi.

### 6.3. `web-admin`, `web-market`, `web-restaurant`

**Hech qanday o'zgarish yo'q** — bu bosqichda tegilmadi. Hozirgi holat:

| Panel | Hozirgi holat | Muammo |
|---|---|---|
| `web-admin` | Sariq (`#FACC15`) + navy, shadcn HSL, faqat qorong'i tema | Mint tizimidan **butunlay ajralgan** |
| `web-market` | `brand.yellow` qiymati `#1FCA8E` ga o'zgartirilgan, lekin navy skeleti va `--primary: 48 96% 53%` (sariq!) saqlanib qolgan | **Yarim ko'chirilgan** |
| `web-restaurant` | `web-market` bilan bayt-bayt bir xil | Xuddi shu |

Keyingi agentlar `docs/design/tailwind-mint.config.js` + `globals-mint.css`
ni nusxalaganda bu yarim holat to'liq almashadi.

### 6.1b. Migratsiya natijasi (mobil, 2026-08-05)

19 ta feature faylidagi **41 ta** `Color(0xFF...)` + 3 ta model faylidagi
11 tasi tokenlarga o'tkazildi. `lib/features/` va `lib/shared/` da qattiq
kodlangan rang **qolmadi** (`grep -rn "Color(0xFF" lib/features lib/shared`
→ 0 natija).

Yagona istisno — `lib/core/config/payment_brand_colors.dart`:

| Rang | Nima | Nega token emas |
|---|---|---|
| `#1FA0E5` / `#0B6BB5` | `kBrandUzcardGradient` — Uzcard/Click brend ko'ki | Tashqi brend. Brend yangilansa dizayn tizimi o'zgarmasligi kerak |
| `#F4D04A` / `#D4A82B` | `kCardChipGradient` — plastik karta chipi (oltin) | Sof dekorativ illustratsiya, brend elementi |

Qolgan ikki "istisno" hujjatda tilga olingan edi, lekin ular ATAYLAB
tokenga o'tkazildi: `#34C759`/`#1E9E45` (Humo kartasining iOS-uslubidagi
yashili) → `kMint` / `kMintDeep`, chunki bu Angren brendining o'z yashili
bo'lishi kerak edi, tashqi brend emas.

### 6.1c. Yangi umumiy vidjetlar

| Vidjet | Fayl | Nima uchun |
|---|---|---|
| `AppEmptyState` | `shared/widgets/app_empty_state.dart` | Bo'sh holat — ilgari har ekran o'zicha yasardi yoki umuman yo'q edi |
| `AppErrorState` / `InlineErrorWidget` | `shared/widgets/error_widget.dart` | Xato holati; matn `kErrorDeep` (6.47:1), `kError` faqat ikona |
| `AppSkeleton*` | `shared/widgets/app_skeleton.dart` | Yuklanish — **spinner emas, skeleton**. `AppSkeleton`, `AppSkeletonTile`, `AppSkeletonCard`, `AppSkeletonList`, `AppSkeletonGrid`, `AppSkeletonGroup` |
| `AppStatusBadge` | `shared/widgets/app_status_badge.dart` | Holat **ikonka + matn + rang** uchtasi bilan (WCAG 1.4.1 — rang yolg'iz qolmasin) |

## 7. Foydalanish qoidalari

### 7.1. Eng muhim qoida — ikki qatlamni adashtirmang

```
INTERAKTIVMI?  (bosiladi, holatni bildiradi, matn ustida turadi)
   HA  → bg: primary (#0C7A4D)   matn: OQ            5.38:1 ✓
   YO'Q → bg: mint    (#1FCA8E)   matn: on-mint       7.84:1 ✓

Yorug' fonda ko'rinishi SHART bo'lgan mint (status nuqtasi, indikator)?
   → mint-deep (#10A064)                              3.37:1 ✓
```

**HECH QACHON:** `text-white` + `bg-mint` (2.12:1) · mint gradient ustida
oq matn (1.85:1) · mint rangli status nuqtasi yorug' fonda (2.12:1).

### 7.2. Qolgan qoidalar

1. **Hech qachon `Color(0xFF...)` yoki `#hex` yozmang.** Mobil'da `k*`
   (superapp'da `ag*`), web'da Tailwind klassi yoki `rgb(var(--token))`.
2. **Yangi rang kerakmi?** Avval `docs/DESIGN-TOKENS.md` → keyin
   `app_theme.dart` → keyin tailwind/css. Teskari tartib tizimni yana
   parchalaydi.
3. **`ag_design.dart` ga qiymat yozmang.** U faqat alias fayl.
4. **Matn rangi tanlashda:**
   - Oddiy matn (< 24px yoki < 18.66px bold) → `ink` yoki `ink-muted`;
     yashil matn kerak bo'lsa `primary-text`.
   - `mint`, `danger`, `warning`, `info`, `violet` ning `DEFAULT`
     variantini **matn uchun ishlatmang** — ular to'ldirish va ikona uchun.
     Matn uchun `*-deep` (yorug' tema) yoki `*-light` (qorong'i tema).
   - `ink-subtle` — faqat placeholder, timestamp, dekorativ ikona.
5. **Holatlar:** hover → `primary-hover`, pressed → `primary-pressed`,
   disabled → `surface-2` fon + `ink-muted` yozuv. Matn rangi hech qaysi
   holatda o'zgarmaydi (hammasi AA).
6. **Fokus:** har bir interaktiv element `focus-ring` ni `2px` qalinlik va
   `2px` offset bilan ko'rsatishi shart. Offset majburiy — usiz halqa to'q
   yashil tugma ustida yo'qoladi.
7. **Gradientlar:** CTA uchun faqat `gradient-cta` yoki `gradient-ink`
   (ikkalasi ham oq matn bilan AA). `gradient-mint` — dekorativ, faqat
   `ink` matn bilan.
8. **Qorong'i tema:** web'da `.dark` klassi orqali avtomatik. Mobil'da
   tokenlar tayyor (`k*Dark`), lekin `ThemeData.dark()` hali qurilmagan.
   Qorong'i temada interaktiv to'ldirish `primary-on-dark` (`#0E8855`).

## 8. Tekshirish

| Nima | Buyruq | Holat |
|---|---|---|
| Mobil statik tahlil | `cd mobile && flutter analyze --fatal-infos` | ✅ 0 muammo |
| Mobil testlar | `cd mobile && flutter test test/unit test/widget` | ✅ 157/157 (140 mavjud + 17 dizayn tizimi) |
| Qattiq kodlangan rang qolmagani | `cd mobile && grep -rn "Color(0xFF" lib/features lib/shared` | ✅ 0 natija |
| Panel tiplari | `cd web-manager && npx tsc --noEmit` | ✅ 0 xato |
| Panel testlari | `cd web-manager && npm test` | ✅ 43/43 |
| Panel build | `cd web-manager && npx next build` | ✅ muvaffaqiyatli |

Kontrast nisbatlari WCAG 2.1 relative-luminance formulasi bilan
hisoblangan (sRGB → linear → `(L1+0.05)/(L2+0.05)`).
