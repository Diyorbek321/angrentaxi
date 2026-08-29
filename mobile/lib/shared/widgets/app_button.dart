import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_platform.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

// ============================================================================
// TUGMALAR — kanonik o'lchamlar va holatlar.
//
//   balandlik : `kControlHeight` (54) — barcha to'liq kenglikdagi CTA
//   radius    : `kRadiusMd` (16)
//   yozuv     : `kFontTitle` (16) / w700
//   normal    : `kPrimary`          + OQ matn (5.38:1 AA)
//   pressed   : `kPrimaryPressed`   + OQ matn (9.66:1 AA)
//   disabled  : `kPrimaryDisabled` fon + `kInkMuted` yozuv (4.88:1 AA)
//
// Matn rangi HECH QAYSI holatda o'zgarmaydi — uchala holat ham AA'dan o'tadi.
// (Mobil'da hover holati yo'q.)
// ============================================================================

/// To'q yashil to'ldirishli asosiy harakat tugmasi.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.isEnabled = true,
    this.backgroundColor,
    this.foregroundColor,
    this.icon,
    this.height = kControlHeight,
    this.semanticsLabel,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isEnabled;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final Widget? icon;
  final double height;

  /// Yozuv o'zi yetarli bo'lmasa (masalan "Davom etish") qo'shimcha izoh.
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final effectiveBg = backgroundColor ?? kPrimary;
    final effectiveFg = foregroundColor ?? kOnPrimary;
    final enabled = isEnabled && !isLoading && onPressed != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticsLabel ?? label,
      // Yuklanish holati ekran o'quvchiga e'lon qilinadi.
      value: isLoading ? 'Yuklanmoqda' : null,
      excludeSemantics: true,
      child: SizedBox(
        width: double.infinity,
        height: height < kMinTapTarget ? kMinTapTarget : height,
        child: ElevatedButton(
          // Haptika harakatdan OLDIN — foydalanuvchi bosgani tasdiqlanadi,
          // natija kutilmasdan.
          onPressed: enabled
              ? () {
                  AppHaptics.tap();
                  onPressed!();
                }
              : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: effectiveBg,
            foregroundColor: effectiveFg,
            disabledBackgroundColor: kPrimaryDisabled,
            disabledForegroundColor: kInkMuted,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(kRadiusMd),
            ),
            elevation: 0,
          ).copyWith(
            // Bosilgan holat: fon to'qlashadi, matn oq qoladi.
            backgroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.disabled)) {
                return kPrimaryDisabled;
              }
              if (states.contains(WidgetState.pressed)) {
                return backgroundColor == null ? kPrimaryPressed : effectiveBg;
              }
              return effectiveBg;
            }),
          ),
          // Yuklanish holati matn bilan almashganda "sakrash" bo'lmasligi
          // uchun `AnimatedSwitcher` — ikkalasi ham bir xil balandlikda.
          child: AnimatedSwitcher(
            duration: kDurationFast,
            child: isLoading
                ? AdaptiveProgress(
                    key: const ValueKey('loading'),
                    size: 22,
                    color: effectiveFg,
                  )
                : Row(
                    key: const ValueKey('label'),
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (icon != null) ...[
                        icon!,
                        const SizedBox(width: kSpace2),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: kFontTitle,
                            fontWeight: FontWeight.w700,
                            color: effectiveFg,
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

/// Konturli ikkilamchi harakat tugmasi — asosiy tugma bilan bir xil
/// balandlik va radius, lekin to'ldirishsiz.
class AppOutlinedButton extends StatelessWidget {
  const AppOutlinedButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.borderColor,
    this.textColor,
    this.icon,
    this.height = kControlHeight,
    this.semanticsLabel,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final Color? borderColor;
  final Color? textColor;
  final Widget? icon;
  final double height;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final effectiveBorder = borderColor ?? kLine;
    final effectiveText = textColor ?? kInk;
    final enabled = !isLoading && onPressed != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticsLabel ?? label,
      value: isLoading ? 'Yuklanmoqda' : null,
      excludeSemantics: true,
      child: SizedBox(
        width: double.infinity,
        height: height < kMinTapTarget ? kMinTapTarget : height,
        child: OutlinedButton(
          onPressed: enabled
              ? () {
                  AppHaptics.tap();
                  onPressed!();
                }
              : null,
          style: OutlinedButton.styleFrom(
            foregroundColor: effectiveText,
            side: BorderSide(color: effectiveBorder, width: 1.5),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(kRadiusMd),
            ),
          ).copyWith(
            // Bosilgan holatda ichki yuza biroz to'qlashadi.
            backgroundColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.pressed)) return kSurface2;
              return null;
            }),
          ),
          child: isLoading
              ? AdaptiveProgress(size: 22, color: effectiveText)
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[
                      icon!,
                      const SizedBox(width: kSpace2)
                    ],
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: kFontTitle,
                        fontWeight: FontWeight.w600,
                        color: effectiveText,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
