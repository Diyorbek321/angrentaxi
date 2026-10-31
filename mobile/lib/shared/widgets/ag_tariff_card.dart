import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

// ============================================================================
// TARIF KARTASI — Yandex Go tuzilma tilining imzo komponenti.
//
// Nima uchun mashina rasmi kartadan CHIQIB turadi:
// tarif tanlash qatorida uchta-to'rtta karta yonma-yon turadi va ularning
// matni deyarli bir xil ("Tejamkor · 18 000 · 3 daq"). Rasm karta ichida
// qolsa, kartalar bir xil to'rtburchaklar to'plamiga aylanadi va ko'z
// qaysi tarif qaysi ekanini o'qish uchun MATNNI o'qishga majbur bo'ladi.
// Rasm chekkadan chiqarilganda esa siluet kartaning konturini buzadi —
// tarif shakl orqali, o'qimasdan tanib olinadi.
//
// Shu sababli Stack `clipBehavior: Clip.none` bilan quriladi: rasm karta
// chegarasidan `_kArtOverhang` chiqadi va kesilmasligi SHART.
//
// ⚠️ CHAQIRUVCHI UCHUN: karta ustidagi bo'sh joyni ota-vidjet beradi —
// qator (`Row`) tepasida kamida `AgTariffCard.artOverhang` (20dp) joy
// qoldiring, aks holda rasm yuqoridagi element ustiga chiqadi.
// ============================================================================

/// Rasm karta chekkasidan qancha chiqib turadi.
const double _kArtOverhang = 20;

/// Kartaning tepa padding'i. Rasm karta ichiga `_kArtHeight - _kArtOverhang`
/// (18dp) kirib turadi, ya'ni nom bilan rasm orasida 4dp nafas qoladi —
/// aks holda nom rasm g'ildiragiga yopishib ko'rinadi.
const double _kCardTopPadding = 22;

const double _kArtWidth = 82;
const double _kArtHeight = 38;

/// Nishon kartaning burchagidan qancha ichkarida turadi. `kSpace1` (4dp)
/// bo'lsa nishon `kRadiusMd` burchak yoyi ustiga tushadi va qiyshiq
/// ko'rinadi — 6dp yoydan tashqarida qoladi.
const double _kBadgeInset = 6;

// Tipografika: bu o'lchamlar shkaladagi tokenlardan tashqarida
// (`kFontCaption` 12, `kFontMicro` 11). Sabab — karta qatorida to'rtta
// tarif 360dp ekranga sig'ishi kerak: nom 13sp da ellipsisga tushadi,
// ETA 11sp da narxdan yetarlicha ajralmaydi. Yarim punktli farq shu
// yerda ma'noga ega, shuning uchun mahalliy konstanta sifatida qoladi.
const double _kNameFontSize = 12.5;
const double _kEtaFontSize = 10.5;
const double _kBadgeFontSize = 9.5;

/// Rasm o'rnini bosuvchi neytral siluet.
///
/// Bo'sh joy qoldirish yaramaydi: kartalar qatorida bitta bo'shliq
/// "yuklanmadi" emas, "bu tarif boshqacha" degan ma'no beradi.
const Widget _kArtFallback = Icon(
  Icons.local_taxi_rounded,
  size: 28,
  color: kInkSubtle,
);

/// Tarif rasmini chizuvchi funksiya.
///
/// Rasm formati kartaning emas, CHAQIRUVCHINING qarori: karta `flutter_svg`
/// ga bog'lanmaydi, aks holda har bir ekran shu bog'liqlikni sudrab yuradi.
///
/// ⚠️ Tarif rasmlari SVG (`assets/tariffs/*.svg`), rastr dekoder esa ularni
/// ocha olmaydi — shuning uchun SVG yo'li berilganda `imageBuilder` MAJBURIY.
/// Berilmasa karta buzilmaydi, lekin mashina o'rniga neytral siluet chiqadi.
typedef AgTariffArtBuilder = Widget Function(
  BuildContext context,
  String assetPath,
);

/// Tarif kartasi — mashina rasmi tepa chekkadan chiqib turadi.
///
/// Kenglik MOSLASHUVCHAN: karta o'zi kenglik belgilamaydi, shuning uchun
/// `Expanded` ichida ham, `SizedBox` ichida ham ishlaydi.
///
/// ```dart
/// Row(
///   children: [
///     Expanded(
///       child: AgTariffCard(
///         name: 'Tejamkor',
///         priceLabel: '18 000',
///         etaLabel: '3 daq',
///         assetPath: 'assets/tariffs/car_econom.svg',
///         imageBuilder: (_, path) => SvgPicture.asset(path),
///         selected: true,
///         onTap: () => provider.selectTariff(Tariff.econom),
///       ),
///     ),
///   ],
/// )
/// ```
class AgTariffCard extends StatelessWidget {
  const AgTariffCard({
    super.key,
    required this.name,
    required this.priceLabel,
    required this.etaLabel,
    required this.assetPath,
    required this.onTap,
    this.selected = false,
    this.badge,
    this.imageBuilder,
  });

  /// Rasm karta chekkasidan chiqadigan masofa — ota-vidjet shu qadar
  /// yuqoridan bo'sh joy qoldirishi kerak.
  static const double artOverhang = _kArtOverhang;

  /// Rasm uyasining kaliti — test va tartib tahlili uchun.
  static const Key artKey = ValueKey('ag-tariff-card-art');

  /// Tarif nomi: "Tejamkor", "Komfort", "Yuk".
  final String name;

  /// Formatlangan narx. Karta raqamni O'ZI formatlamaydi — valyuta va
  /// ajratkich qoidalari `receipt_formatter` da, bitta joyda turadi.
  final String priceLabel;

  /// Kutish vaqti: "3 daq".
  final String etaLabel;

  /// Mashina rasmining yo'li. Rasmni karta O'ZI TANLAMAYDI — tarif bilan
  /// rasm bog'lanishi ma'lumot qatlamining ishi.
  ///
  /// SVG bo'lsa `imageBuilder` ham berilishi kerak.
  final String assetPath;

  final bool selected;

  /// Ixtiyoriy nishon: "TOP", "-20%".
  final String? badge;

  final VoidCallback? onTap;

  /// Rasmni boshqacha chizish kerak bo'lganda (masalan SVG).
  final AgTariffArtBuilder? imageBuilder;

  @override
  Widget build(BuildContext context) {
    // Ekran o'quvchi kartani bitta gap sifatida o'qiydi: bo'laklangan
    // matnlar ("Tejamkor" ... "18 000" ... "3 daq") alohida-alohida
    // o'qilsa, foydalanuvchi ular bitta tarifga tegishli ekanini
    // tushunmaydi.
    final semanticsLabel = <String>[
      name,
      if (badge != null) badge!,
      priceLabel,
      etaLabel,
    ].join(', ');

    return MergeSemantics(
      // Tanlangan holat FAQAT rang bilan berilmaydi: chegara qalinlashadi,
      // fon tinted bo'ladi va semantikada `selected` bayrog'i yoqiladi.
      child: Semantics(
        selected: selected,
        child: AppPressable(
          onTap: onTap,
          semanticsLabel: semanticsLabel,
          // Tarif almashtirish — "tanlov o'zgardi" hodisasi, oddiy
          // teginish emas.
          haptic: AppHapticLevel.select,
          child: ExcludeSemantics(
            child: Stack(
              clipBehavior: Clip.none,
              // `passthrough` — karta otadan kelgan cheklovni to'g'ridan-
              // to'g'ri oladi. `loose` (standart) bo'lsa karta `Expanded`
              // ichida ham kontent kengligicha qisqarib qolardi.
              fit: StackFit.passthrough,
              children: [
                _buildCard(),
                Positioned(
                  top: -_kArtOverhang,
                  left: 0,
                  right: 0,
                  child: Center(child: _buildArt(context)),
                ),
                if (badge != null)
                  Positioned(
                    top: _kBadgeInset,
                    right: _kBadgeInset,
                    child: _buildBadge(badge!),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCard() {
    return Container(
      padding: const EdgeInsets.fromLTRB(
        kSpace2,
        _kCardTopPadding,
        kSpace2,
        kSpace3,
      ),
      decoration: BoxDecoration(
        color: selected ? kMintTint : kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        // Tanlanmagan karta ham CHEGARASIZ qolmaydi: oq karta ilova foni
        // ustida 1.04:1 beradi — ya'ni chekkasi ko'rinmaydi va WCAG 1.4.11
        // (komponentni aniqlash uchun 3:1) buziladi. `kLine` bezak
        // ajratkichi bo'lgani uchun bu yerda yaramaydi, `kLineInteractive`
        // (3.67:1) kerak.
        border: Border.all(
          color: selected ? kPrimary : kLineInteractive,
          width: selected ? 2 : 1.5,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: _kNameFontSize,
              fontWeight: FontWeight.w700,
              color: kInk,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            priceLabel,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: kFontTitle,
              fontWeight: FontWeight.w800,
              // Tanlangan tarifning narxi interaktiv rangga o'tadi —
              // mint EMAS: mint yorug' yuzada 2.12:1 va matn tashiy olmaydi.
              color: selected ? kPrimary : kInk,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            etaLabel,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            // ⚠️ `kInkSubtle` EMAS. U oq ustida 3.67:1 beradi va
            // app_theme.dart da "faqat KATTA matn va UI elementlari" deb
            // belgilangan — 10.5sp esa eng kichik matn. `kInkMuted`
            // (5.47:1 oq, 5.2:1 mint tint ustida) AA'dan o'tadi va
            // ierarxiyada narxdan baribir pastda turadi.
            style: const TextStyle(
              fontSize: _kEtaFontSize,
              fontWeight: FontWeight.w600,
              color: kInkMuted,
            ),
          ),
        ],
      ),
    );
  }

  /// Rasm uyasi har doim bir xil o'lchamda: rasm yuklanmasa ham kartalar
  /// balandligi o'zgarmaydi va qator "sakramaydi".
  Widget _buildArt(BuildContext context) {
    return SizedBox(
      key: artKey,
      width: _kArtWidth,
      height: _kArtHeight,
      child: _buildArtChild(context),
    );
  }

  Widget _buildArtChild(BuildContext context) {
    final builder = imageBuilder;
    if (builder != null) return builder(context, assetPath);

    // SVG yo'lini `Image.asset` ga BERMAYMIZ. Rastr dekoder uni ocha
    // olmaydi va har qayta chizishda asset qaytadan o'qilib, xato
    // yoziladi — log shovqini ostida haqiqiy xatolar ko'rinmay qoladi.
    // Tarif rasmlari SVG bo'lgani uchun bu yo'l odatiy holat, istisno emas.
    if (_isVectorAsset(assetPath)) return _kArtFallback;

    return Image.asset(
      assetPath,
      width: _kArtWidth,
      height: _kArtHeight,
      fit: BoxFit.contain,
      // Asset ro'yxatdan o'tmagan yoki yo'q bo'lsa karta bo'sh joy bilan
      // qolmaydi — o'sha neytral siluet chiziladi.
      errorBuilder: (_, __, ___) => _kArtFallback,
    );
  }

  static bool _isVectorAsset(String path) =>
      path.toLowerCase().endsWith('.svg');

  /// Nishon foni mint — bu DEKORATIV aksent, shuning uchun ustidagi matn
  /// `kOnMint` (7.84:1). Mint ustida oq matn 2.12:1 berardi.
  Widget _buildBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: kSpace1, vertical: 2),
      decoration: BoxDecoration(
        color: kMint,
        borderRadius: BorderRadius.circular(kRadiusXs),
      ),
      child: Text(
        label,
        maxLines: 1,
        style: const TextStyle(
          fontSize: _kBadgeFontSize,
          fontWeight: FontWeight.w800,
          color: kOnMint,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
