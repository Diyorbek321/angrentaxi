import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

// ============================================================================
// BOSILADIGAN O'RAM — ilovaning "tirik" hissi shu yerdan boshlanadi.
//
// Muammo: kartalar, ro'yxat qatorlari va plitkalar `GestureDetector` yoki
// `InkWell` ga o'ralgan edi — bosilganda HECH NARSA o'zgarmasdi (ripple
// ko'p hollarda karta soyasi ostida ko'rinmasdi) va barmoqda javob yo'q edi.
//
// `AppPressable` uchtasini birga beradi:
//   1. masshtab — bosilganda 0.97 ga kichrayadi (150ms), qo'yilganda qaytadi
//   2. haptika  — teginish aniqlanganda, harakat bajarilishidan OLDIN
//   3. semantika — tugma roli va yorlig'i ekran o'quvchi uchun
//
// Haptika `onTapDown` da, `onTap` da EMAS: foydalanuvchi barmog'ini
// qo'yganda javob olishi kerak, ko'targanda emas — aks holda kechikkan
// his qilinadi.
// ============================================================================

/// Har qanday widgetni bosiladigan qiladi: masshtab + haptika + semantika.
///
/// ```dart
/// AppPressable(
///   onTap: () => Navigator.pushNamed(context, '/passenger/tariff'),
///   semanticsLabel: 'Tarifni tanlash',
///   child: const TariffCard(),
/// )
/// ```
class AppPressable extends StatefulWidget {
  const AppPressable({
    super.key,
    required this.child,
    required this.onTap,
    this.onLongPress,
    this.semanticsLabel,
    this.pressedScale = 0.97,
    this.haptic = AppHapticLevel.tap,
    this.borderRadius,
    this.enableRipple = false,
    this.minTapTarget = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Ikonka yoki rasm yolg'iz bo'lsa MAJBURIY — aks holda ekran o'quvchi
  /// "tugma" deb o'qiydi-yu, nima qilishini ayta olmaydi.
  final String? semanticsLabel;

  /// Bosilgandagi masshtab. Katta kartalar uchun 0.98, kichik
  /// tugmalar uchun 0.94 mos keladi.
  final double pressedScale;

  final AppHapticLevel haptic;

  /// Ripple yoqilgan bo'lsa, uning shakli.
  final BorderRadius? borderRadius;

  /// Material ripple qo'shish. Standart holatda O'CHIQ — masshtab
  /// animatsiyasi allaqachon javob beradi va ikkalasi birga "shovqinli"
  /// ko'rinadi. Ro'yxat qatorlari uchun yoqish mantiqli.
  final bool enableRipple;

  /// Tegish maydonini kamida `kMinTapTarget` (48dp) ga kengaytirish.
  final bool minTapTarget;

  @override
  State<AppPressable> createState() => _AppPressableState();
}

/// Bosilishga qanday haptik javob berilishi.
enum AppHapticLevel {
  /// Haptika yo'q — masalan sof dekorativ yoki juda tez-tez bosiladigan.
  none,

  /// Yengil teginish — standart.
  tap,

  /// Tanlov o'zgardi — tarif, toggle, filtr.
  select,

  /// Sezilarli harakat — sheet ochish, ekran almashtirish.
  impact,
}

class _AppPressableState extends State<AppPressable> {
  bool _pressed = false;

  bool get _enabled => widget.onTap != null || widget.onLongPress != null;

  void _fire(AppHapticLevel level) {
    switch (level) {
      case AppHapticLevel.none:
        break;
      case AppHapticLevel.tap:
        AppHaptics.tap();
      case AppHapticLevel.select:
        AppHaptics.select();
      case AppHapticLevel.impact:
        AppHaptics.impact();
    }
  }

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    Widget content = widget.child;

    if (widget.enableRipple && _enabled) {
      content = Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          onLongPress: widget.onLongPress,
          borderRadius: widget.borderRadius ?? BorderRadius.circular(kRadiusMd),
          child: content,
        ),
      );
    }

    content = AnimatedScale(
      scale: _pressed ? widget.pressedScale : 1.0,
      duration: AppMotion.duration(context, AppMotion.fast),
      curve: AppMotion.standard,
      child: content,
    );

    if (widget.minTapTarget) {
      content = ConstrainedBox(
        constraints: const BoxConstraints(minHeight: kMinTapTarget),
        child: content,
      );
    }

    return Semantics(
      button: _enabled,
      enabled: _enabled,
      label: widget.semanticsLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _enabled
            ? (_) {
                _setPressed(true);
                _fire(widget.haptic);
              }
            : null,
        onTapUp: _enabled ? (_) => _setPressed(false) : null,
        onTapCancel: _enabled ? () => _setPressed(false) : null,
        // Ripple yoqilgan bo'lsa, bosishni InkWell bajaradi — ikki marta
        // chaqirilmasligi uchun bu yerda o'tkazib yuboriladi.
        onTap: _enabled && !widget.enableRipple ? widget.onTap : null,
        onLongPress: _enabled && !widget.enableRipple
            ? () {
                AppHaptics.longPress();
                widget.onLongPress?.call();
              }
            : null,
        child: content,
      ),
    );
  }
}

/// Ikonka tugmasi — kichik vizual o'lcham, to'liq tegish maydoni.
///
/// `AgIconButton` dan farqi: bu yerda fon ixtiyoriy va masshtab
/// animatsiyasi kuchliroq (0.9), chunki ikonka kichik bo'lgani uchun
/// nozik masshtab sezilmaydi.
class AppIconTap extends StatelessWidget {
  const AppIconTap({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
    this.color,
    this.background,
    this.size = 22,
    this.boxSize = 44,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final String semanticsLabel;
  final Color? color;
  final Color? background;
  final double size;
  final double boxSize;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final box = boxSize < kMinTapTarget ? kMinTapTarget : boxSize;

    return AppPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      pressedScale: 0.9,
      minTapTarget: false,
      child: SizedBox(
        width: box,
        height: box,
        child: Container(
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(kRadiusSm),
          ),
          child: Icon(
            icon,
            size: size,
            color: color ?? scheme.onSurface,
          ),
        ),
      ),
    );
  }
}
