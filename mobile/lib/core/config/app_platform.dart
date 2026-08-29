import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ============================================================================
// PLATFORMAGA MOSLASHUV — bitta kod bazasi, ikkita to'g'ri his.
//
// Muammo: 114 fayldan atigi 1 tasida platforma tekshiruvi bor edi va
// `cupertino` importi umuman yo'q edi. Natijada iOS'da ilova Android
// ilovasiga o'xshardi: Material spinner, Material switch, Material dialog,
// va eng sezilarlisi — scroll oxirida iOS'ning "bounce" effekti o'rniga
// Android'ning "glow"i.
//
// Bu fayl FARQ QILISHI KERAK bo'lgan narsalarnigina ajratadi. Brend
// (rang, tipografika, radius) ikkala platformada bir xil qoladi —
// bu Angren Go, iOS ilovasi yoki Android ilovasi emas.
//
// AJRATILADI:  scroll fizikasi · yuklanish indikatori · switch · dialog ·
//              pull-to-refresh · status bar uslubi · orqaga qaytish jesti
// AJRATILMAYDI: rang · tipografika · spacing · radius · ikonalar · tugmalar
// ============================================================================

extension PlatformContext on BuildContext {
  TargetPlatform get platform => Theme.of(this).platform;

  bool get isIOS =>
      platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;

  bool get isAndroid => !isIOS;

  /// Platformaga mos scroll fizikasi.
  ///
  /// iOS: `BouncingScrollPhysics` — ro'yxat oxirida cho'ziladi va qaytadi.
  /// Android: `ClampingScrollPhysics` — chetda to'xtaydi (M3 stretch bilan).
  ///
  /// `AlwaysScrollableScrollPhysics` bilan birlashtiriladi, aks holda
  /// kontent kalta bo'lganda pull-to-refresh ishlamay qoladi.
  ScrollPhysics get scrollPhysics => isIOS
      ? const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics())
      : const AlwaysScrollableScrollPhysics(parent: ClampingScrollPhysics());
}

/// Platformaga mos yuklanish indikatori.
///
/// iOS'da aylanma chiziqchalar (`CupertinoActivityIndicator`), Android'da
/// aylanuvchi yoy. Ikkalasi ham brend rangida.
class AdaptiveProgress extends StatelessWidget {
  const AdaptiveProgress({
    super.key,
    this.size = 24,
    this.color,
    this.strokeWidth = 2.5,
  });

  final double size;
  final Color? color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? Theme.of(context).colorScheme.primary;

    if (context.isIOS) {
      return CupertinoActivityIndicator(radius: size / 2, color: tint);
    }

    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: strokeWidth,
        valueColor: AlwaysStoppedAnimation<Color>(tint),
      ),
    );
  }
}

/// Platformaga mos switch (haydovchi "onlayn" toggle'i, sozlamalar).
class AdaptiveSwitch extends StatelessWidget {
  const AdaptiveSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.semanticsLabel,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    void handle(bool next) {
      AppHaptics.select();
      onChanged?.call(next);
    }

    return Semantics(
      label: semanticsLabel,
      toggled: value,
      child: context.isIOS
          ? CupertinoSwitch(
              value: value,
              onChanged: onChanged == null ? null : handle,
              activeTrackColor: Theme.of(context).colorScheme.primary,
            )
          : Switch.adaptive(
              value: value,
              onChanged: onChanged == null ? null : handle,
            ),
    );
  }
}

/// Platformaga mos pull-to-refresh.
///
/// iOS'da `CupertinoSliverRefreshControl` sliver talab qilgani uchun bu
/// yerda ikkala platformada ham `RefreshIndicator` ishlatiladi, lekin
/// iOS'da u brend rangida va tortish masofasi qisqaroq — Cupertino
/// hissiga yaqinroq bo'ladi. Almashtirilganda haptik javob beriladi.
class AdaptiveRefresh extends StatelessWidget {
  const AdaptiveRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return RefreshIndicator.adaptive(
      onRefresh: () async {
        AppHaptics.impact();
        await onRefresh();
      },
      color: scheme.primary,
      backgroundColor: scheme.surface,
      displacement: context.isIOS ? 28 : 40,
      child: child,
    );
  }
}

/// Platformaga mos tasdiqlash oynasi.
///
/// iOS'da `CupertinoAlertDialog` (markazda, ajratilgan tugmalar),
/// Android'da Material 3 `AlertDialog` (chapga tekislangan, matn tugmalar).
/// Destruktiv harakat ikkala platformada ham qizil bo'ladi.
Future<bool> showAdaptiveConfirm(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Tasdiqlash',
  String cancelLabel = 'Bekor qilish',
  bool isDestructive = false,
}) async {
  AppHaptics.warning();

  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      final destructive = isDestructive
          ? kErrorDeep
          : Theme.of(dialogContext).colorScheme.primary;

      if (dialogContext.isIOS) {
        return CupertinoAlertDialog(
          title: Text(title),
          content: Padding(
            padding: const EdgeInsets.only(top: kSpace2),
            child: Text(message),
          ),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(cancelLabel),
            ),
            CupertinoDialogAction(
              isDestructiveAction: isDestructive,
              isDefaultAction: !isDestructive,
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(confirmLabel),
            ),
          ],
        );
      }

      return AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRadiusLg),
        ),
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(cancelLabel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: destructive),
            child: Text(confirmLabel),
          ),
        ],
      );
    },
  );

  return result ?? false;
}

/// Brend uslubidagi bottom sheet — ikkala platformada bir xil shakl,
/// lekin sudrash dastagi (grab handle) va burchak radiusi platformaga mos.
///
/// Planshetda sheet butun kenglikni egallamaydi — markazda cheklanadi
/// (`maxWidth`), aks holda 1000dp keng sheet xunuk ko'rinadi.
Future<T?> showAppSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool isDismissible = true,
  bool isScrollControlled = true,
  double? maxWidth,
}) {
  AppHaptics.impact();

  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    isDismissible: isDismissible,
    enableDrag: isDismissible,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: kInk.withValues(alpha: 0.32),
    constraints: BoxConstraints(maxWidth: maxWidth ?? 640),
    builder: (sheetContext) {
      final scheme = Theme.of(sheetContext).colorScheme;
      return Container(
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(kRadiusXl),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Sudrash dastagi — ikkala platformada ham "bu sheet
            // sudralishi mumkin"ligini bildiradigan yagona vizual signal.
            if (isDismissible)
              Padding(
                padding: const EdgeInsets.only(top: kSpace3, bottom: kSpace1),
                child: Container(
                  width: sheetContext.isIOS ? 36 : 32,
                  height: 4,
                  decoration: BoxDecoration(
                    color: scheme.outlineVariant,
                    borderRadius: BorderRadius.circular(kRadiusFull),
                  ),
                ),
              ),
            Flexible(child: builder(sheetContext)),
          ],
        ),
      );
    },
  );
}

/// Temaga mos status bar / navigatsiya paneli uslubi.
///
/// Yorug' temada status bar ikonalari QORA, qorong'i temada OQ bo'lishi
/// kerak — aks holda ular fonga qo'shilib ketadi va soat ko'rinmay qoladi.
SystemUiOverlayStyle systemOverlayFor(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  return SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    // iOS
    statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
    // Android
    statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
    systemNavigationBarColor: isDark ? kBackgroundDark : kBackground,
    systemNavigationBarIconBrightness:
        isDark ? Brightness.light : Brightness.dark,
    systemNavigationBarDividerColor: Colors.transparent,
  );
}

/// Ekranni chetdan surib yopish (iOS) yoki tizim orqaga jesti (Android)
/// bilan mos ishlaydigan "orqaga" harakati — haptik javob bilan.
void popWithFeedback(BuildContext context, {Object? result}) {
  AppHaptics.tap();
  Navigator.of(context).maybePop(result);
}

/// `AppMotion` ni shu fayldan ham olish uchun (ekranlar bitta import bilan
/// platformaga oid hamma narsani oladi).
typedef AppMotionRef = AppMotion;

/// Butun ilova uchun platformaga mos scroll xulqi.
///
/// `MaterialApp.scrollBehavior` ga beriladi va HAR BIR scroll qiluvchi
/// widgetga avtomatik qo'llanadi — 114 ekranning birortasida ham qo'lda
/// `physics:` yozish shart emas.
///
/// iOS: `BouncingScrollPhysics` (chetda cho'ziladi va qaytadi).
/// Android: `ClampingScrollPhysics` + Material 3 stretch effekti.
class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    return switch (getPlatform(context)) {
      TargetPlatform.iOS ||
      TargetPlatform.macOS =>
        const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      _ => const ClampingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
    };
  }

  /// Android'da chetdagi "glow" o'rniga M3 "stretch" — zamonaviyroq.
  @override
  Widget buildOverscrollIndicator(
    BuildContext context,
    Widget child,
    ScrollableDetails details,
  ) {
    return switch (getPlatform(context)) {
      TargetPlatform.iOS || TargetPlatform.macOS => child,
      _ => StretchingOverscrollIndicator(
          axisDirection: details.direction,
          child: child,
        ),
    };
  }
}
