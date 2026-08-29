import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_platform.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// ============================================================================
// Angren Super App — Mint Design System (YAGONA MANBA / SINGLE SOURCE OF TRUTH)
//
// Bu fayl butun mobil ilova uchun yagona token manbai.
// Kanonik ta'rif: docs/DESIGN-TOKENS.md
//
// QOIDA: hech qanday feature faylida `Color(0xFF...)` yozmang — shu yerdagi
// tokenlardan foydalaning. Yangi rang kerak bo'lsa avval shu faylga qo'shing.
//
// `features/superapp/widgets/ag_design.dart` shu fayldan re-export qiladi
// (ag* nomlari saqlangan), o'z qiymatlarini E'LON QILMAYDI.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. BRAND — IKKI QATLAM: "interaktiv" va "aksent"
//
//    ⚠️ ENG KO'P XATO QILINADIGAN JOY. Farqni yodda tuting:
//
//    kPrimary (#0C7A4D, to'q yashil) = INTERAKTIV TO'LDIRISH.
//      Tugma foni, faol toggle, tanlangan chegara, progress, chat pufakchasi,
//      link matni, fokus halqasi. Ustidagi matn HAR DOIM OQ (5.38:1).
//
//    kMint (#1FCA8E, mint) = AKSENT / DEKORATIV.
//      Chip va badge foni, tinted yuza, dekorativ ikonka, gradient boshi,
//      faol holat indikatori, diagramma rangi. Ustidagi matn HAR DOIM
//      kOnMint (#06231A, 7.84:1) — hech qachon oq (oq = 2.12:1, AA emas).
//
//    QOIDA: mint yorug' yuzada MA'NO tashiy olmaydi (oq ustida 2.12:1,
//    3:1 dan past). Yorug' fonda ma'noli har qanday yashil element —
//    kPrimary. Mint faqat (a) qorong'i yuzada, (b) ink matn ortidagi
//    to'ldirish sifatida, yoki (c) sof dekorativ element sifatida.
// ---------------------------------------------------------------------------

// --- 1a. Interaktiv qatlam (to'q yashil) ---

/// Barcha interaktiv to'ldirishlar uchun asosiy rang.
/// Oq matn bilan 5.38:1 — WCAG AA (oddiy matn).
const Color kPrimary = Color(0xFF0C7A4D);

/// Hover / focus holati. Oq matn bilan 6.93:1.
const Color kPrimaryHover = Color(0xFF0A6741);

/// Bosilgan (pressed / active) holat. Oq matn bilan 9.66:1.
const Color kPrimaryPressed = Color(0xFF084F32);

/// Qorong'i temada interaktiv to'ldirish. Oq matn 4.50:1 (AA), va
/// qorong'i yuzalarda chegarasi ko'rinadi (#18241F ga nisbatan 3.56:1).
/// Yorug' temadagi #0C7A4D qorong'i `surface-2` ustida 2.98:1 berardi —
/// ya'ni tugma foniga qo'shilib ketardi.
const Color kPrimaryOnDark = Color(0xFF0E8855);

/// kPrimary to'ldirish ustidagi matn va ikona.
const Color kOnPrimary = Color(0xFFFFFFFF);

/// O'chirilgan (disabled) tugma foni va yozuvi.
/// kInkMuted `#EDF3F4` ustida 4.88:1 — AA.
const Color kPrimaryDisabled = Color(0xFFEDF3F4);

/// Klaviatura fokus halqasi. Oq ustida 5.38:1, fon ustida 4.99:1,
/// `surface-2` ustida 4.79:1 — hamma joyda 3:1 dan yuqori.
/// (Eski mint halqa oq ustida atigi 2.12:1 edi — ko'rinmas.)
const Color kFocusRing = Color(0xFF0C7A4D);

/// Qorong'i temadagi fokus halqasi. `#111A17` ustida 11.37:1.
const Color kFocusRingDark = Color(0xFF6FE4B8);

// --- 1b. Aksent qatlam (mint) ---

/// Brend minti — AKSENT. To'ldirish sifatida faqat ink matn bilan.
const Color kMint = Color(0xFF1FCA8E);

/// Yorqin mint — gradient boshi, badge, qorong'i temada urg'u.
const Color kMintBright = Color(0xFF27D89B);

/// Chuqurroq mint — gradient oxiri, qorong'i temada matn (5.27:1).
const Color kMintDeep = Color(0xFF10A064);

/// Yumshoq mint — qorong'i fonda matn/ikona. `#111A17` ustida 11.37:1.
const Color kMintSoft = Color(0xFF6FE4B8);

/// Mint tinted yuza — chip, badge, tanlangan qator (yorug' tema).
const Color kMintTint = Color(0xFFE6FAF2);

/// Mint tinted yuza — qorong'i tema.
const Color kMintTintDark = Color(0xFF0E2A20);

/// Mint / mint-bright TO'LDIRISH ustidagi matn va ikona.
/// `#1FCA8E` ustida 7.84:1, `#27D89B` ustida 9.01:1 — AA.
/// Mint to'ldirish ustida OQ MATN ISHLATMANG (2.12:1).
const Color kOnMint = Color(0xFF06231A);

// ---------------------------------------------------------------------------
// 2. NEYTRALLAR — YORUG' TEMA
// ---------------------------------------------------------------------------

/// Ilova foni (off-white).
const Color kBackground = Color(0xFFF4F7F8);

/// Karta / sheet / modal foni.
const Color kSurface = Color(0xFFFFFFFF);

/// Input to'ldirishi, skeleton, ikona konteyneri.
const Color kSurface2 = Color(0xFFEDF3F4);

/// Bosilgan holat, ichki blok foni.
const Color kSurface3 = Color(0xFFE2EBEC);

/// Chegara (border) — karta va input konturi.
const Color kLine = Color(0xFFE4E9ED);

/// Kuchli chegara — ajratilgan bloklar.
const Color kLineStrong = Color(0xFFC6D4D7);

/// INTERAKTIV komponent chegarasi — input, tanlanadigan karta, xarita tugmasi.
///
/// ⚠️ `kLine` (1.22:1) va `kLineStrong` (1.52:1) BEZAK ajratkichlari uchun
/// to'g'ri, lekin WCAG 1.4.11 komponentni ANIQLASH uchun kerak bo'lgan
/// chegaradan 3:1 talab qiladi. Input maydonlari `filled: true` +
/// `fillColor: surface2` bilan chizilardi va to'ldirish foni bilan atigi
/// 1.04:1 farq qilardi — ya'ni maydon chekkasi ko'rinmasdi.
///
/// Hech qanday to'ldirish rangi buni yolg'iz tuzata olmaydi: oq ustida 3:1 ga
/// yetish uchun fon shunchalik to'q bo'lishi kerakki, ichidagi matn kontrasti
/// buziladi. Shuning uchun yechim — CHEGARA.
///
/// Yorug'da 3.67:1 (oq ustida) va 3.28:1 (to'ldirish ustida).
const Color kLineInteractive = kInkSubtle;

/// Qorong'i temada interaktiv chegara. `kSurface2Dark` ustida 4.96:1.
const Color kLineInteractiveDark = kInkSubtleDark;

/// Karta ICHIDAGI ingichka ajratkich.
const Color kDivider = Color(0xFFF1F4F6);

/// Asosiy matn. Oq ustida 17.50:1, fon ustida 16.25:1.
const Color kInk = Color(0xFF0F1B22);

/// Ikkilamchi matn. Oq ustida 5.47:1, fon ustida 5.08:1 — AA.
const Color kInkMuted = Color(0xFF5A6C75);

/// Uchlamchi matn / placeholder / passiv ikona.
/// Oq ustida 3.67:1, fon ustida 3.41:1 — faqat KATTA matn va UI elementlari.
const Color kInkSubtle = Color(0xFF78888F);

// ---------------------------------------------------------------------------
// 3. NEYTRALLAR — QORONG'I TEMA
//    (mobil ilova hozir faqat yorug' temada; tokenlar keyingi bosqich uchun)
// ---------------------------------------------------------------------------

const Color kBackgroundDark = Color(0xFF0B1210);
const Color kSurfaceDark = Color(0xFF111A17);
const Color kSurface2Dark = Color(0xFF18241F);
const Color kSurface3Dark = Color(0xFF202F29);
const Color kLineDark = Color(0xFF25352F);
const Color kLineStrongDark = Color(0xFF374C44);
const Color kDividerDark = Color(0xFF1A2621);

/// #111A17 ustida 15.40:1.
const Color kInkDark = Color(0xFFE8F1ED);

/// #111A17 ustida 7.24:1 — AA.
const Color kInkMutedDark = Color(0xFF96AAA2);

/// #111A17 ustida 5.49:1 — AA.
const Color kInkSubtleDark = Color(0xFF7E948B);

// ---------------------------------------------------------------------------
// 4. STATUS / SEMANTIK RANGLAR
// ---------------------------------------------------------------------------

/// Xato to'ldirish va ikona. Oq ustida 3.91:1 (katta matn / UI).
const Color kError = Color(0xFFE5484D);

/// Yorug' fondagi xato MATNI. Oq ustida 6.47:1 — AA.
const Color kErrorDeep = Color(0xFFB91C1C);

const Color kErrorLight = Color(0xFFFEF2F2);
const Color kErrorDark = Color(0xFFFF6369); // qorong'i temada, 6.12:1

/// Xato/destruktiv harakat konturi (masalan "Chiqish" tugmasi).
/// `kError` ning yumshatilgan varianti — dekorativ chegara, matn emas.
const Color kErrorBorder = Color(0xFFF3D3D4);

/// Ogohlantirish / qo'lda aralashuv (amber).
const Color kWarning = Color(0xFFF59E0B);

/// Yorug' fondagi amber MATN. Oq ustida 5.02:1 — AA.
const Color kWarningDeep = Color(0xFFB45309);

const Color kWarningLight = Color(0xFFFFFBEB);
const Color kWarningDark = Color(0xFFFBBF24); // qorong'i temada, 10.63:1

/// Ma'lumot / neytral urg'u (ko'k).
const Color kInfo = Color(0xFF3B82F6);

/// Yorug' fondagi ko'k MATN. Oq ustida 6.70:1 — AA.
const Color kInfoDeep = Color(0xFF1D4ED8);

const Color kInfoLight = Color(0xFFEFF6FF);
const Color kInfoDark = Color(0xFF60A5FA); // qorong'i temada, 6.98:1

/// Qo'shimcha urg'u (binafsha) — kategoriya ikonalari, promo.
const Color kAccentViolet = Color(0xFF8B5CF6);
const Color kAccentVioletDeep = Color(0xFF6D28D9); // oq ustida 7.10:1
const Color kAccentVioletLight = Color(0xFFF5F3FF);
const Color kAccentVioletDark = Color(0xFFA78BFA); // qorong'i temada, 6.52:1

/// Muvaffaqiyat holati (alohida yashil kiritilmaydi — brend minti).
/// Faqat to'ldirish/ikona sifatida, ink matn bilan.
const Color kSuccess = kMint;

/// Yorug' fondagi muvaffaqiyat MATNI. Oq ustida 5.38:1 — AA.
const Color kSuccessDeep = kPrimary;

/// Qorong'i fondagi muvaffaqiyat matni. `#111A17` ustida 11.37:1.
const Color kSuccessOnDark = kMintSoft;

const Color kSuccessLight = kMintTint;

// ---------------------------------------------------------------------------
// 5. GRADIENTLAR
// ---------------------------------------------------------------------------

/// Interaktiv CTA gradienti — OQ matn bilan ishlatiladi.
///
/// Gradientning ENG OCH nuqtasi (`#0C7A4D`) oq matn bilan 5.38:1,
/// eng to'q nuqtasi (`#084F32`) 9.66:1 — butun diapazon AA'dan o'tadi.
///
/// ⚠️ Eski mint CTA gradienti (`#1FCA8E → #10A064`) olib tashlandi:
/// uning eng och nuqtasida oq matn atigi 2.12:1 berardi. Mint gradientni
/// AA'ga keltirish uchun boshini `#0C7A4D` gacha to'qlashtirish kerak edi —
/// ya'ni u baribir mint bo'lmay qolardi.
const LinearGradient kGradientCta = LinearGradient(
  colors: [kPrimary, kPrimaryPressed],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

/// Dekorativ mint gradient — HERO yuzalar, header, illustratsiya.
///
/// ⚠️ CTA sifatida ISHLATILMAYDI va ustiga OQ MATN QO'YILMAYDI.
/// Ustidagi matn faqat `kInk`: eng och nuqtada (`#27D89B`) 9.48:1,
/// eng to'q nuqtada (`#10A064`) 5.19:1 — ikkalasi ham AA.
const LinearGradient kGradientMint = LinearGradient(
  colors: [kMintBright, kMintDeep],
  begin: Alignment.topRight,
  end: Alignment.bottomLeft,
);

/// To'q "ink" kartalar (balans, promo, referal banner) uchun gradient.
/// Oq matn bilan eng och nuqtada 12.36:1 — AA.
const Color kInkGradientEnd = Color(0xFF1D3A2F);

/// `kGradientInk` ning rang ro'yxati — o'z `begin`/`end` i kerak bo'lgan
/// joylar shu ro'yxatni ishlatadi (to'rt xil "to'q gradient oxiri" o'rniga).
const List<Color> kGradientInkColors = [kInk, kInkGradientEnd];

const LinearGradient kGradientInk = LinearGradient(
  colors: kGradientInkColors,
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

// ---------------------------------------------------------------------------
// 6. RADIUS SHKALASI
// ---------------------------------------------------------------------------

const double kRadiusXs = 8; // badge, kichik teg
const double kRadiusSm = 12; // chip, ikona konteyneri
const double kRadiusMd = 16; // tugma, input, karta
const double kRadiusLg = 22; // katta karta, panel
const double kRadiusXl = 28; // bottom sheet, modal
const double kRadiusFull = 999; // pill

// ---------------------------------------------------------------------------
// 7. SPACING SHKALASI (4pt grid)
// ---------------------------------------------------------------------------

const double kSpace1 = 4;
const double kSpace2 = 8;
const double kSpace3 = 12;
const double kSpace4 = 16; // standart ekran gutter
const double kSpace5 = 20;
const double kSpace6 = 24;
const double kSpace8 = 32;
const double kSpace10 = 40;

/// Ekran chetlari uchun standart gorizontal padding.
const EdgeInsets kScreenPadding = EdgeInsets.symmetric(horizontal: kSpace4);

// ---------------------------------------------------------------------------
// 7b. O'LCHAM SHKALASI (tegish maydonlari va boshqaruv balandliklari)
// ---------------------------------------------------------------------------

/// Minimal tegish maydoni (WCAG 2.5.8 AA / Material). Har qanday bosiladigan
/// element kamida shu o'lchamda bo'lishi SHART — vizual o'lchami kichik
/// bo'lsa, `SizedBox`/`ConstrainedBox` bilan tegish maydoni kengaytiriladi.
const double kMinTapTarget = 48;

/// Asosiy tugma va input balandligi (to'liq kenglikdagi CTA).
const double kControlHeight = 54;

/// HAYDOVCHI ekranlaridagi asosiy amal balandligi.
///
/// ⚠️ Nega `kControlHeight` (54) yetarli emas. Haydovchi nishonni HARAKATDAGI
/// avtomobildan uradi: yo'l tebranishi, qishda qo'lqop, quyosh aksi. Iste'molchi
/// uchun 44–48 dp yetarli, bu yerda esa amaliy pol 56 dp.
///
/// 64 — asosiy amal (Qabul qilish, Yetib keldim, Safarni boshlash). Ikkilamchi
/// haydovchi nishonlari `kMinTapTargetDriver` dan past bo'lmasligi kerak.
const double kControlHeightDriver = 64;

/// Haydovchi ekranlaridagi eng kichik teginish nishoni.
///
/// `kMinTapTarget` (48) iste'molchi uchun; haydovchida 56. Ular orasida
/// kamida 8 dp bo'shliq bo'lsin, buzg'unchi amal yonida 12 dp.
const double kMinTapTargetDriver = 56;

/// Ikkilamchi/kompakt boshqaruv balandligi (chip tugma, ikona tugma).
const double kControlHeightSm = 48;

// ---------------------------------------------------------------------------
// 8. TIPOGRAFIKA SHKALASI
//    Mobil: Plus Jakarta Sans. Web: Manrope (docs/DESIGN-TOKENS.md ga qarang).
// ---------------------------------------------------------------------------

const double kFontDisplay = 30;
const double kFontH1 = 23;
const double kFontH2 = 19;
const double kFontH3 = 17;
const double kFontTitle = 16;
const double kFontBodyLg = 16;
const double kFontBody = 14;
const double kFontLabel = 13;
const double kFontCaption = 12;
const double kFontMicro = 11;

// ---------------------------------------------------------------------------
// 9. ELEVATION / SOYALAR
// ---------------------------------------------------------------------------

/// elev-1 — kartalar, ro'yxat elementlari.
final List<BoxShadow> kShadowCard = [
  BoxShadow(
    color: kInk.withValues(alpha: 0.05),
    blurRadius: 2,
    offset: const Offset(0, 1),
  ),
  BoxShadow(
    color: kInk.withValues(alpha: 0.22),
    blurRadius: 24,
    spreadRadius: -14,
    offset: const Offset(0, 10),
  ),
];

/// elev-2 — suzuvchi panellar, sheet, dropdown, sticky header.
final List<BoxShadow> kShadowPop = [
  BoxShadow(
    color: kInk.withValues(alpha: 0.22),
    blurRadius: 32,
    spreadRadius: -8,
    offset: const Offset(0, 8),
  ),
  BoxShadow(
    color: kInk.withValues(alpha: 0.08),
    blurRadius: 8,
    offset: const Offset(0, 2),
  ),
];

/// elev-cta — asosiy tugma ostidagi mint "glow".
final List<BoxShadow> kShadowCta = [
  BoxShadow(
    color: kPrimary.withValues(alpha: 0.32),
    blurRadius: 28,
    spreadRadius: -8,
    offset: const Offset(0, 14),
  ),
];

/// elev-ink — to'q pill / sticky cart bar ostidagi soya.
final List<BoxShadow> kShadowInk = [
  BoxShadow(
    color: kInk.withValues(alpha: 0.28),
    blurRadius: 34,
    offset: const Offset(0, 16),
  ),
];

// ---------------------------------------------------------------------------
// 10. ANIMATSIYA
// ---------------------------------------------------------------------------

const Duration kDurationFast = Duration(milliseconds: 150);
const Duration kDurationBase = Duration(milliseconds: 200);
const Duration kDurationSlow = Duration(milliseconds: 300);
const Duration kDurationSlower = Duration(milliseconds: 500);

/// Standart (kirish + chiqish) — Material `cubic-bezier(0.4, 0, 0.2, 1)`.
const Curve kEaseStandard = Curves.easeInOut;

/// Urg'uli (sheet, drawer) — `cubic-bezier(0.32, 0.72, 0, 1)`.
const Curve kEaseEmphasized = Cubic(0.32, 0.72, 0, 1);

/// Chiqish / paydo bo'lish.
const Curve kEaseOut = Curves.easeOut;

// ---------------------------------------------------------------------------
// 11. ORQAGA MOSLIK ALIASLARI (eski ekranlar shu nomlarga murojaat qiladi)
// ---------------------------------------------------------------------------

const Color kTextPrimary = kInk;

/// ⚠️ Eski nomlar. `kPrimaryDark`/`kPrimaryLight` endi AKSENT qatlamiga
/// ishora qiladi (mint), interaktiv qatlamga emas. Yangi kod `kMint*`
/// ishlatsin.
const Color kPrimaryDark = kMintDeep;
const Color kPrimaryLight = kMintTint;
const Color kPrimaryBright = kMintBright;
const Color kPrimaryDeep = kPrimary;
const Color kTextSecondary = kInkMuted;
const Color kSurfaceGrey = kSurface2;
const Color kPrimaryYellow = kMint;
const Color kSecondaryBlack = kInk;
const Color kBackgroundWhite = kBackground;

// ---------------------------------------------------------------------------
// 12. THEME — YORUG' VA QORONG'I
//
// Ikkala tema BITTA quruvchi funksiyadan chiqadi (`_buildTheme`). Sabab:
// ilgari faqat yorug' tema bor edi va qorong'i tokenlar (3-bo'lim) hech
// qayerda ishlatilmasdi. Ikkita alohida `ThemeData` yozilsa, ular vaqt
// o'tishi bilan bir-biridan uzoqlashadi — bitta joyda `Brightness` bo'yicha
// tarmoqlanish esa buni imkonsiz qiladi.
//
// ⚠️ QORONG'I TEMA — TESKARI AGDARILGAN YORUG' TEMA EMAS:
//   · fon sof qora emas (#0B1210) — sof qorada OLED "smearing" bo'ladi
//     va kontrast haddan tashqari keskin his qilinadi;
//   · yuza balandlashgan sari OCHROQ bo'ladi
//     (surface #111A17 → surface2 #18241F → surface3 #202F29);
//   · interaktiv yashil OCHROQ variantga o'tadi (`kPrimaryOnDark`), chunki
//     yorug' temadagi #0C7A4D qorong'i yuzada 2.98:1 berib, tugma fonga
//     qo'shilib ketardi;
//   · soyalar qorong'i temada deyarli ko'rinmaydi — balandlik chegara
//     (`kLineDark`) va yuza rangi orqali beriladi.
// ---------------------------------------------------------------------------

/// Ikkala tema uchun umumiy quruvchi.
ThemeData _buildTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;

  // --- Rang rollari ---
  final primary = isDark ? kPrimaryOnDark : kPrimary;
  final pressed = isDark ? kPrimary : kPrimaryPressed;
  final background = isDark ? kBackgroundDark : kBackground;
  final surface = isDark ? kSurfaceDark : kSurface;
  final surface2 = isDark ? kSurface2Dark : kSurface2;
  final surface3 = isDark ? kSurface3Dark : kSurface3;
  final line = isDark ? kLineDark : kLine;
  final lineStrong = isDark ? kLineStrongDark : kLineStrong;
  final lineInteractive =
      isDark ? kLineInteractiveDark : kLineInteractive;
  final ink = isDark ? kInkDark : kInk;
  final inkMuted = isDark ? kInkMutedDark : kInkMuted;
  final error = isDark ? kErrorDark : kError;
  final tint = isDark ? kMintTintDark : kMintTint;
  final disabledBg = isDark ? kSurface3Dark : kPrimaryDisabled;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: primary,
    onPrimary: kOnPrimary,
    primaryContainer: tint,
    onPrimaryContainer: isDark ? kMintSoft : kOnMint,
    secondary: isDark ? kMintSoft : kInk,
    onSecondary: isDark ? kOnMint : kOnPrimary,
    secondaryContainer: tint,
    onSecondaryContainer: isDark ? kMintSoft : kOnMint,
    tertiary: isDark ? kAccentVioletDark : kAccentViolet,
    onTertiary: isDark ? kInk : kOnPrimary,
    error: error,
    onError: isDark ? kInk : kOnPrimary,
    errorContainer: isDark ? kSurface2Dark : kErrorLight,
    onErrorContainer: isDark ? kErrorDark : kErrorDeep,
    surface: surface,
    onSurface: ink,
    surfaceContainerLowest: background,
    surfaceContainerLow: surface,
    surfaceContainer: surface2,
    surfaceContainerHigh: surface3,
    surfaceContainerHighest: surface3,
    onSurfaceVariant: inkMuted,
    outline: lineStrong,
    outlineVariant: line,
    shadow: kInk,
    scrim: kInk,
    inverseSurface: isDark ? kSurface : kInk,
    onInverseSurface: isDark ? kInk : kSurface,
    inversePrimary: isDark ? kPrimary : kMintSoft,
  );

  final textTheme = GoogleFonts.plusJakartaSansTextTheme(TextTheme(
    headlineLarge: TextStyle(
      fontSize: kFontDisplay,
      fontWeight: FontWeight.w800,
      color: ink,
      letterSpacing: -0.5,
    ),
    headlineMedium: TextStyle(
      fontSize: kFontH1,
      fontWeight: FontWeight.w700,
      color: ink,
      letterSpacing: -0.3,
    ),
    headlineSmall: TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w700,
      color: ink,
    ),
    titleMedium: TextStyle(
      fontSize: kFontTitle,
      fontWeight: FontWeight.w600,
      color: ink,
    ),
    bodyLarge: TextStyle(fontSize: kFontBodyLg, color: ink),
    bodyMedium: TextStyle(fontSize: kFontBody, color: ink),
    bodySmall: TextStyle(fontSize: kFontCaption, color: inkMuted),
    labelLarge: TextStyle(
      fontSize: kFontTitle,
      fontWeight: FontWeight.w700,
      color: ink,
    ),
  ));

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: background,

    // Barcha ekran o'tishlari shu yerda belgilanadi: iOS'da Cupertino
    // siljishi (+ chetdan surib orqaga qaytish), Android'da Material 3
    // "shared axis". 35 ta mavjud `MaterialPageRoute` chaqiruvi shu
    // sozlama tufayli avtomatik to'g'ri animatsiyaga o'tadi.
    pageTransitionsTheme: kAppPageTransitions,

    // Ripple'ni iOS'da o'chirish TO'G'RI EMAS — Flutter'da InkWell hamma
    // joyda ishlatiladi; o'rniga splash radiusi kichraytiriladi va bosilish
    // holati asosan `AppPressable` ning masshtab animatsiyasi bilan beriladi.
    splashFactory: InkSparkle.splashFactory,

    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      systemOverlayStyle: systemOverlayFor(brightness),
      titleTextStyle: GoogleFonts.plusJakartaSans(
        color: ink,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
      iconTheme: IconThemeData(color: ink),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: kOnPrimary,
        disabledBackgroundColor: disabledBg,
        disabledForegroundColor: inkMuted,
        elevation: 0,
        minimumSize: const Size(double.infinity, kControlHeight),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRadiusMd),
        ),
        textStyle: GoogleFonts.plusJakartaSans(
          fontSize: kFontTitle,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ).copyWith(
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) return disabledBg;
          if (states.contains(WidgetState.pressed)) return pressed;
          return primary;
        }),
      ),
    ),

    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: isDark ? kMintSoft : kPrimary,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: ink,
        minimumSize: const Size(double.infinity, kControlHeight),
        side: BorderSide(color: line, width: 1.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRadiusMd),
        ),
        textStyle: const TextStyle(
          fontSize: kFontTitle,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface2,
      hintStyle: TextStyle(color: inkMuted),
      // ⚠️ Ilgari ikkalasi ham `BorderSide.none` edi. Maydon faqat
      // `fillColor: surface2` bilan ajralardi va u fon bilan 1.04:1 —
      // chekka ko'rinmasdi (WCAG 1.4.11, 3:1 talab qilinadi).
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
        borderSide: BorderSide(color: lineInteractive, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
        borderSide: BorderSide(color: lineInteractive, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
        borderSide: BorderSide(
          color: isDark ? kFocusRingDark : kFocusRing,
          width: 2,
        ),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
        borderSide: BorderSide(color: error, width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
        borderSide: BorderSide(color: error, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),

    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRadiusLg),
        // Qorong'i temada soya ko'rinmaydi — balandlik chegara bilan beriladi.
        side: isDark ? BorderSide(color: line) : BorderSide.none,
      ),
      color: surface,
      shadowColor: kInk.withValues(alpha: isDark ? 0.4 : 0.08),
    ),

    chipTheme: ChipThemeData(
      backgroundColor: tint,
      labelStyle: TextStyle(
        color: isDark ? kMintSoft : kPrimary,
        fontWeight: FontWeight.w600,
      ),
      side: BorderSide.none,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
      ),
    ),

    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: surface,
      elevation: 0,
      modalBackgroundColor: surface,
      dragHandleColor: line,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
    ),

    dialogTheme: DialogThemeData(
      backgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRadiusLg),
      ),
    ),

    dividerTheme: DividerThemeData(
      color: line,
      thickness: 1,
      space: 1,
    ),

    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: surface,
      selectedItemColor: isDark ? kMintSoft : kPrimary,
      unselectedItemColor: inkMuted,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: tint,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
    ),

    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: primary,
      foregroundColor: kOnPrimary,
    ),

    snackBarTheme: SnackBarThemeData(
      backgroundColor: isDark ? surface3 : kInk,
      contentTextStyle: TextStyle(
        color: isDark ? ink : kSurface,
        fontSize: kFontBody,
        fontWeight: FontWeight.w600,
      ),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
    ),

    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: primary,
      linearTrackColor: surface2,
      circularTrackColor: surface2,
    ),

    listTileTheme: ListTileThemeData(
      iconColor: inkMuted,
      textColor: ink,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
    ),

    textTheme: textTheme,
    iconTheme: IconThemeData(color: ink),
  );
}

/// Yorug' tema — ilovaning standart ko'rinishi.
final ThemeData appTheme = _buildTheme(Brightness.light);

/// Qorong'i tema — 3-bo'limdagi tokenlar ustiga qurilgan.
final ThemeData appDarkTheme = _buildTheme(Brightness.dark);
