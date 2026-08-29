import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

// ============================================================================
// MARSHRUT PANELI — xarita USTIDA suzuvchi manzil kartasi.
//
// Muammo: manzillar hozir pastdagi sheet ICHIDA turadi. Sheet xaritaning
// pastki uchdan birini doim yopib turadi, marshrutni ko'rish uchun esa
// sheetni ochish kerak — ya'ni safarning eng muhim ma'lumoti bir bosish
// narigi tomonda qoladi.
//
// Yechim (Yandex Go tuzilma tili): panel sheetdan CHIQARILADI va xarita
// ustida mustaqil karta bo'lib suzadi. Shunda marshrut doim ko'rinadi,
// xarita esa deyarli to'liq ochiq qoladi.
//
// ⚠️ IKKI NUQTA — IKKI XIL GLIF:
//   "qayerdan" → kPrimary DOIRA (boshlanish, joriy joylashuv),
//   "qayerga"  → kInk KVADRAT (manzil, marshrut oxiri).
// Ikkalasi bir xil shaklda bo'lsa, qatorlar faqat RANG bilan farq qiladi —
// rangni ajrata olmaydigan foydalanuvchi uchun panel ma'nosini yo'qotadi
// (WCAG 1.4.1: ma'lumot yolg'iz rang bilan berilmaydi).
// ============================================================================

// ---------------------------------------------------------------------------
// KOMPONENT O'LCHAMLARI
//
// Bular dizayn tizimining umumiy shkalasida yo'q (4pt grid'ga tushmaydi) —
// shuning uchun `app_theme.dart` ga qo'shilmadi, faqat shu komponent ichida
// yashaydi. Umumiy tokenga aylansa (masalan boshqa panel ham 42dp qator
// ishlatsa), o'shanda kanonik faylga ko'chiriladi.
// ---------------------------------------------------------------------------

/// Bitta manzil qatorining balandligi.
///
/// 42dp `kMinTapTarget` (48) dan past va bu ATAYLAB: ikki qator + ajratkich
/// panelni 85dp da ushlab turadi — xaritadan olinadigan joy shuncha. Qator
/// panelning butun kengligini egallagani uchun tegish maydoni gorizontal
/// jihatdan juda katta va WCAG 2.5.8 (AA, 24×24) bemalol bajariladi.
/// Ikkala qatorga ham 48dp berilsa panel 100dp+ ga chiqadi va u yana
/// sheetga o'xshab qoladi — ya'ni butun g'oya buziladi.
const double _kRowHeight = 42;

/// Boshlanish/manzil glifining o'lchami.
const double _kGlyphSize = 9;

/// Almashtirish tugmasining KO'RINADIGAN o'lchami. Tegish maydoni bundan
/// kattaroq — `_kSwapRight` / `_kSwapTop` izohlariga qarang.
const double _kSwapSize = 34;

/// Almashtirish ikonkasining o'lchami. 34dp doira ichida 18dp — ikonka
/// atrofida taxminan 8dp havo qoladi, ya'ni glif "siqilgan" ko'rinmaydi.
const double _kSwapIconSize = 18;

/// Glif ustuni: glif + undan keyingi bo'shliq. Matn shu masofadan boshlanadi.
const double _kGlyphColumn = _kGlyphSize + kSpace3;

/// 1-qatorda almashtirish tugmasi uchun ajratiladigan joy — tugmaning
/// ko'rinadigan kengligi + matn bilan orasidagi bo'shliq. Busiz uzun manzil
/// tugma ostiga kirib ketardi.
const double _kSwapReserve = _kSwapSize + kSpace3;

/// 34dp doira 48dp tegish maydonining markazida turadi, ya'ni quti doiradan
/// har tomonga 7dp kattaroq. Doira panel chetidan `kSpace4` da turishi uchun
/// quti chetidan 16 − 7 = 9dp da joylashadi.
const double _kSwapRight = kSpace4 - (kMinTapTarget - _kSwapSize) / 2;

/// Xuddi shu hisob vertikal bo'yicha: quti (48) qatordan (42) 3dp balandroq,
/// panelning `kSpace1` ichki bo'shlig'i shu farqni yutadi — shuning uchun
/// 48dp tegish maydoni panel chegarasidan tashqariga chiqmaydi.
const double _kSwapTop = kSpace1 - (kMinTapTarget - _kRowHeight) / 2;

/// Glif burchagini yumshatish. 9dp kvadrat uchun 2dp — shakl kvadratligicha
/// qoladi, lekin doira yonida "kesilgan" ko'rinmaydi.
const double _kGlyphCorner = 2;

// ---------------------------------------------------------------------------
// TEST KALITLARI
//
// Glif SHAKLI (doira ≠ kvadrat) shu komponentning asosiy a11y shartnomasi,
// shuning uchun u testdan topilishi kerak. Xususiy widget sinflarini test
// ko'ra olmaydi — kalit eng arzon yo'l.
// ---------------------------------------------------------------------------

@visibleForTesting
const Key kRoutePanelFromGlyphKey = Key('ag_route_panel_from_glyph');

@visibleForTesting
const Key kRoutePanelToGlyphKey = Key('ag_route_panel_to_glyph');

@visibleForTesting
const Key kRoutePanelSwapKey = Key('ag_route_panel_swap');

/// Xarita ustida suzuvchi "qayerdan → qayerga" paneli.
///
/// Sheet ICHIGA qo'yilmaydi — u sheetning o'rnini bosadi.
///
/// ```dart
/// Stack(children: [
///   const AppVectorMap(),
///   Positioned(
///     top: MediaQuery.paddingOf(context).top + kSpace3,
///     left: kSpace4,
///     right: kSpace4,
///     child: AgRoutePanel(
///       from: 'Amir Temur ko\'chasi 12',
///       to: 'Angren bozori',
///       distanceLabel: '4.2 km',
///       onSwap: controller.swapAddresses,
///       onTapTo: () => Navigator.pushNamed(context, '/passenger/destination'),
///     ),
///   ),
/// ])
/// ```
class AgRoutePanel extends StatelessWidget {
  const AgRoutePanel({
    super.key,
    required this.from,
    required this.to,
    this.distanceLabel,
    this.onSwap,
    this.onTapFrom,
    this.onTapTo,
    this.showSwap = true,
  });

  /// Boshlanish manzili.
  final String from;

  /// Borish manzili.
  final String to;

  /// Ixtiyoriy masofa yozuvi ("4.2 km"). Bo'sh yoki `null` bo'lsa qator
  /// faqat manzildan iborat bo'ladi.
  final String? distanceLabel;

  final VoidCallback? onSwap;
  final VoidCallback? onTapFrom;
  final VoidCallback? onTapTo;

  /// Almashtirish tugmasini ko'rsatish. Safar boshlanib bo'lgan ekranlarda
  /// (haydovchi yo'lda) yo'nalishni teskari qilish ma'nosiz — o'sha yerda
  /// `false` berib, tugma bilan birga u egallagan joy ham olib tashlanadi.
  final bool showSwap;

  @override
  Widget build(BuildContext context) {
    final distance = distanceLabel;
    final hasDistance = distance != null && distance.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        // Panel xarita ustida SUZADI — balandligi soya bilan beriladi,
        // shuning uchun karta soyasi (elev-1) emas, panel soyasi (elev-2).
        boxShadow: kShadowPop,
      ),
      // Qator ripple'i panelning yumaloq burchaklaridan chiqib ketmasligi
      // uchun. Qatorlar to'liq kenglikda bosiladi, ya'ni ripple burchakka
      // yetib boradi.
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: kSpace1),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _RouteRow(
                  glyph: const _FromGlyph(),
                  text: from,
                  semanticsLabel: 'Qayerdan: $from',
                  onTap: onTapFrom,
                  reserveSwapSpace: showSwap,
                ),
                const _RowDivider(),
                _RouteRow(
                  glyph: const _ToGlyph(),
                  text: to,
                  semanticsLabel: hasDistance
                      ? 'Qayerga: $to, $distance'
                      : 'Qayerga: $to',
                  onTap: onTapTo,
                  trailing: hasDistance ? _DistanceLabel(text: distance) : null,
                ),
              ],
            ),
          ),
          // Tugma qator ICHIDA emas, panel ustida turadi: 42dp qator 48dp
          // tegish maydonini sig'dira olmaydi, `Stack` esa uni qator
          // chegarasidan tashqariga chiqarishga imkon beradi.
          if (showSwap)
            Positioned(
              top: _kSwapTop,
              right: _kSwapRight,
              width: kMinTapTarget,
              height: kMinTapTarget,
              child: _SwapButton(key: kRoutePanelSwapKey, onTap: onSwap),
            ),
        ],
      ),
    );
  }
}

/// Bitta manzil qatori: glif + matn + ixtiyoriy o'ng yozuv.
class _RouteRow extends StatelessWidget {
  const _RouteRow({
    required this.glyph,
    required this.text,
    required this.semanticsLabel,
    required this.onTap,
    this.trailing,
    this.reserveSwapSpace = false,
  });

  final Widget glyph;
  final String text;
  final String semanticsLabel;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool reserveSwapSpace;

  @override
  Widget build(BuildContext context) {
    // Qator balandligi 42dp da QOTIB turadi (panel sheetga o'smasligi
    // kerak), shrift esa breakpointga ergashadi: tor ekranda 0.94x,
    // planshetda 1.1x. 1.4x tizim shkalasida ham 16×1.1×1.4×1.2 ≈ 29dp —
    // 42dp qatorga bemalol sig'adi, shuning uchun qator qat'iyligi
    // masshtablangan matn bilan ziddiyatga kirmaydi.
    final style = Theme.of(context).textTheme.bodyLarge!.copyWith(
          fontSize: context.fs(kFontBodyLg),
          fontWeight: FontWeight.w600,
          color: kInk,
          height: 1.2,
        );

    return AppPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      // Qator balandligi qat'iy 42dp — `AppPressable` uni 48dp ga
      // cho'zmasligi kerak, aks holda panel sheet o'lchamiga qaytadi.
      minTapTarget: false,
      // Karta ICHIDAGI qator masshtablanmaydi (panel joyida qotib turadi,
      // faqat qator kichrayardi — bu buzuq ko'rinadi). Javob ripple bilan.
      pressedScale: 1,
      enableRipple: true,
      borderRadius: BorderRadius.zero,
      child: ExcludeSemantics(
        // Matn `semanticsLabel` ichida rol bilan birga ("Qayerga: ...")
        // allaqachon bor — ikkinchi marta o'qilishi shovqin bo'lardi.
        child: SizedBox(
          height: _kRowHeight,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: kSpace4),
            child: Row(
              children: [
                glyph,
                const SizedBox(width: kSpace3),
                Expanded(
                  child: Text(
                    text,
                    maxLines: 1,
                    // O'zbekcha manzillar uzun ("Mustaqillik shoh
                    // ko'chasi, 42-uy") — qator hech qachon o'ralmaydi.
                    overflow: TextOverflow.ellipsis,
                    style: style,
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: kSpace3),
                  trailing!,
                ],
                if (reserveSwapSpace) const SizedBox(width: _kSwapReserve),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Boshlanish nuqtasi — kPrimary DOIRA.
class _FromGlyph extends StatelessWidget {
  const _FromGlyph();

  @override
  Widget build(BuildContext context) {
    return Container(
      key: kRoutePanelFromGlyphKey,
      width: _kGlyphSize,
      height: _kGlyphSize,
      decoration: const BoxDecoration(
        color: kPrimary,
        shape: BoxShape.circle,
      ),
    );
  }
}

/// Manzil — kInk KVADRAT.
///
/// Doira EMAS: "qayerdan" va "qayerga" hech qachon bir xil glif bo'lmaydi,
/// aks holda ikki qatorni faqat rang ajratib turardi.
class _ToGlyph extends StatelessWidget {
  const _ToGlyph();

  @override
  Widget build(BuildContext context) {
    return Container(
      key: kRoutePanelToGlyphKey,
      width: _kGlyphSize,
      height: _kGlyphSize,
      decoration: const BoxDecoration(
        color: kInk,
        borderRadius: BorderRadius.all(Radius.circular(_kGlyphCorner)),
      ),
    );
  }
}

/// Manzil qatorining o'ng chekkasidagi masofa yozuvi.
class _DistanceLabel extends StatelessWidget {
  const _DistanceLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: Theme.of(context).textTheme.bodySmall!.copyWith(
            fontSize: context.fs(kFontLabel),
            fontWeight: FontWeight.w600,
            color: kInkMuted,
          ),
    );
  }
}

/// Qatorlar orasidagi ajratkich.
///
/// Chapdan glif ustuni kengligicha suriladi: doira va kvadrat uzluksiz
/// "marshrut ustuni" bo'lib o'qiladi, chiziq esa faqat matnlarni ajratadi.
class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(
        left: kSpace4 + _kGlyphColumn,
        right: kSpace4,
      ),
      child: Divider(height: 1, thickness: 1, color: kDivider),
    );
  }
}

/// Manzillarni almashtirish tugmasi — 34dp doira, 48dp tegish maydoni.
class _SwapButton extends StatelessWidget {
  const _SwapButton({super.key, required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;

    return AppPressable(
      onTap: onTap,
      semanticsLabel: 'Manzillarni almashtirish',
      // Yo'nalish teskarisiga aylandi — bu tanlov o'zgarishi, oddiy
      // teginish emas.
      haptic: AppHapticLevel.select,
      // Ikonka kichik — nozik masshtab sezilmaydi.
      pressedScale: 0.9,
      // Tegish maydonini `Positioned` allaqachon 48dp qilib bergan;
      // qo'shimcha `ConstrainedBox` faqat markazlashni buzardi.
      minTapTarget: false,
      child: Center(
        child: Container(
          width: _kSwapSize,
          height: _kSwapSize,
          decoration: BoxDecoration(
            color: kSurface2,
            shape: BoxShape.circle,
            // kSurface2 oq panel ustida atigi 1.04:1 — to'ldirish YOLG'IZ
            // tugma chegarasini ko'rsata olmaydi (WCAG 1.4.11 uchun 3:1
            // kerak). Shuning uchun interaktiv chegara qo'shiladi.
            border: Border.all(color: kLineInteractive),
          ),
          child: Icon(
            Icons.swap_vert_rounded,
            size: _kSwapIconSize,
            color: enabled ? kInk : kInkSubtle,
          ),
        ),
      ),
    );
  }
}
