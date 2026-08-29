import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

// ============================================================================
// XARITA USTIDAGI PANEL — telefonda sheet, keng ekranda yon panel.
//
// Muammo: xarita ekranlarida panel `Positioned(bottom: 0, left: 0, right: 0)`
// bilan qo'yilgan edi. Telefonda bu to'g'ri, lekin:
//   · planshetda (900dp) panel butun kenglikka cho'ziladi — tugmalar
//     va matn qatorlari o'qib bo'lmaydigan darajada uzayadi;
//   · landshaft telefonda panel ekran balandligining yarmidan ko'pini
//     egallaydi va xaritadan deyarli hech narsa qolmaydi.
//
// Yechim: 720dp dan keng ekranda panel CHAP YON PANELga aylanadi —
// xarita to'liq ochiq qoladi, panel esa suzuvchi karta bo'ladi.
//
// ⚠️ `Stack` ning bevosita bolasi sifatida ishlatiladi (ichida `Positioned`
// qaytaradi).
// ============================================================================

/// Xarita ustidagi moslashuvchan panel.
///
/// ```dart
/// Stack(children: [
///   MyMap(),
///   AdaptiveMapPanel(
///     topGap: 88,                 // orqaga tugmasi uchun joy
///     child: Column(children: [...]),
///   ),
/// ])
/// ```
class AdaptiveMapPanel extends StatelessWidget {
  const AdaptiveMapPanel({
    super.key,
    required this.child,
    this.showHandle = true,
    this.topGap = kSpace10 + kSpace6,
    this.padding,
    this.crossAxisAlignment = CrossAxisAlignment.start,
    this.animateIn = true,
    this.layered = false,
  });

  final Widget child;

  /// Sudrash dastagi. Faqat pastdagi sheet rejimida ko'rsatiladi —
  /// yon panel sudralmaydi, shuning uchun u yerda dastak yolg'on
  /// signal bo'lardi.
  final bool showHandle;

  /// Yon panel rejimida yuqoridan qoldiriladigan bo'shliq — odatda
  /// suzuvchi "orqaga" tugmasi shu joyni egallaydi.
  final double topGap;

  final EdgeInsets? padding;
  final CrossAxisAlignment crossAxisAlignment;

  /// Ekran ochilganda panelning kirish animatsiyasi.
  ///
  /// ⚠️ Animatsiya panel KONTENTIGA qo'llanadi, tashqi `Positioned` ga EMAS.
  /// Ilgari chaqiruvchi ekranlar `Positioned(...).animate()` yozardi — bu
  /// Flutter'da "Incorrect use of ParentDataWidget" xatosini beradi, chunki
  /// `Positioned` ning bevosita ota-onasi `Stack` bo'lishi shart, orada
  /// animatsiya widgeti turolmaydi.
  final bool animateIn;

  /// QATLAMLI yuza rejimi (Yandex Go tuzilma tili).
  ///
  /// `false` (standart) — panel foni `scheme.surface` (oq). Eski chaqiruvchilar
  /// shu holatda qoladi, ya'ni bu bayroq orqaga mos.
  ///
  /// `true` — panel foni `scheme.surfaceContainer` (`kSurface2`), ichidagi
  /// kartalar esa `AgSurfaceCard` orqali oq bo'ladi. Chuqurlik shu ikki yuza
  /// FARQIDAN keladi, chegaradan emas — shuning uchun `AgSurfaceCard`
  /// chegarasiz. Ikkalasi birga ishlatilmasa qatlam ko'rinmaydi: oq ustidagi
  /// oq karta ajralmaydi.
  final bool layered;

  @override
  Widget build(BuildContext context) {
    final side = context.canSplitMapPanel;
    final scheme = Theme.of(context).colorScheme;
    final gutter = context.gutter;

    final panel = Container(
      width: double.infinity,
      padding: padding ??
          EdgeInsets.fromLTRB(
            gutter,
            kSpace3,
            gutter,
            // Pastdagi sheet tizim jest paneli ustiga tushmasligi kerak;
            // yon panel esa allaqachon `SafeArea` ichida.
            side ? gutter : kSpace8,
          ),
      decoration: BoxDecoration(
        color: layered ? scheme.surfaceContainer : scheme.surface,
        borderRadius: side
            ? BorderRadius.circular(kRadiusXl)
            : const BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
        boxShadow: kShadowPop,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: crossAxisAlignment,
        children: [
          if (showHandle && !side) ...[
            Center(
              child: ExcludeSemantics(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    // Qatlamli rejimda panel foni allaqachon
                    // `surfaceContainer`; tutqich undan bir pog'ona
                    // yuqori bo'lmasa ko'rinmay qoladi.
                    color: layered
                        ? scheme.outline
                        : scheme.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(kRadiusFull),
                  ),
                ),
              ),
            ),
            const SizedBox(height: kSpace4),
          ],
          child,
        ],
      ),
    );

    // Kirish animatsiyasi rejimga qarab farq qiladi: pastdagi sheet
    // pastdan ko'tariladi, yon panel esa chapdan suzib chiqadi.
    final animated = (!animateIn || AppMotion.reduced(context))
        ? panel
        : (side
            ? panel
                .animate()
                .fadeIn(duration: AppMotion.slow)
                .slideX(begin: -0.08, curve: AppMotion.emphasized)
            : panel.animate().slideY(
                  begin: 1,
                  end: 0,
                  duration: AppMotion.slower,
                  curve: AppMotion.emphasized,
                ));

    if (!side) {
      return Positioned(bottom: 0, left: 0, right: 0, child: animated);
    }

    return Positioned(
      left: 0,
      top: 0,
      bottom: 0,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(gutter, topGap, gutter, gutter),
          child: SizedBox(
            width: context.sidePanelWidth,
            // Kontent balandligi ekranga sig'masligi mumkin (kichik
            // landshaft telefon) — markazlashtiriladi va skroll qilinadi.
            child: Center(
              child: SingleChildScrollView(
                physics: const ClampingScrollPhysics(),
                child: animated,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
