import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

// ============================================================================
// STATUS BADGE — holat KO'RSATKICHI.
//
// ⚠️ QULAYLIK QOIDASI (WCAG 1.4.1 — "Use of Color"):
// buyurtma holati HECH QACHON faqat rang bilan berilmaydi. Har bir badge
// uchta signalni birga tashiydi:
//   1. IKONKA  — shakl orqali farqlanadi (rangni ko'rmaydiganlar uchun)
//   2. MATN    — holatning nomi
//   3. RANG    — faqat qo'shimcha, uchinchi darajali signal
//
// Rang tanlash (docs/DESIGN-TOKENS.md 7.1):
//   fon  = `*Light` tint (yumshoq yuza)
//   matn = `*Deep` (yorug' fonda AA'dan o'tadigan yagona variant)
//   ikona = `*Deep` (matn bilan bir xil — 4.5:1+)
// Muvaffaqiyat/faol holat uchun mint EMAS, `kPrimary` (5.38:1) —
// mint yorug' fonda 2.12:1 va ma'no tashiy olmaydi.
// ============================================================================

enum AppStatusTone {
  /// Muvaffaqiyat / yakunlangan / faol.
  success,

  /// Jarayonda / kutilmoqda — neytral ma'lumot.
  info,

  /// Diqqat talab qiladi / kechikish.
  warning,

  /// Bekor qilingan / xato.
  danger,

  /// Ma'nosiz / arxiv / noaniq.
  neutral,
}

extension AppStatusToneStyle on AppStatusTone {
  Color get background => switch (this) {
        AppStatusTone.success => kMintTint,
        AppStatusTone.info => kInfoLight,
        AppStatusTone.warning => kWarningLight,
        AppStatusTone.danger => kErrorLight,
        AppStatusTone.neutral => kSurface2,
      };

  /// Matn va ikona rangi — hammasi oq/tint yuzada 4.5:1 dan yuqori.
  Color get foreground => switch (this) {
        AppStatusTone.success => kPrimary, // 4.95:1 mint tint ustida
        AppStatusTone.info => kInfoDeep, // 6.70:1
        AppStatusTone.warning => kWarningDeep, // 5.02:1
        AppStatusTone.danger => kErrorDeep, // 6.47:1
        AppStatusTone.neutral => kInkMuted, // 4.88:1
      };

  /// Rangni ko'rmaydigan foydalanuvchi uchun ZAXIRA signal.
  IconData get icon => switch (this) {
        AppStatusTone.success => Icons.check_circle_rounded,
        AppStatusTone.info => Icons.schedule_rounded,
        AppStatusTone.warning => Icons.warning_amber_rounded,
        AppStatusTone.danger => Icons.cancel_rounded,
        AppStatusTone.neutral => Icons.remove_circle_outline_rounded,
      };
}

/// Ikonka + matn + tinted fon. Buyurtma, to'lov va hujjat holatlari uchun.
class AppStatusBadge extends StatelessWidget {
  const AppStatusBadge({
    super.key,
    required this.label,
    required this.tone,
    this.icon,
    this.dense = false,
  });

  final String label;
  final AppStatusTone tone;

  /// Holatga xos ikonka. Berilmasa `tone` ning zaxira ikonasi ishlatiladi.
  final IconData? icon;

  final bool dense;

  @override
  Widget build(BuildContext context) {
    final fg = tone.foreground;
    return Semantics(
      container: true,
      label: 'Holat: $label',
      excludeSemantics: true,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: dense ? kSpace2 : kSpace3,
          vertical: dense ? 4 : 6,
        ),
        decoration: BoxDecoration(
          color: tone.background,
          borderRadius: BorderRadius.circular(kRadiusXs),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon ?? tone.icon, size: dense ? 12 : 14, color: fg),
            SizedBox(width: dense ? 4 : kSpace1 + 2),
            // Nishon tor konteynerga (yon panel, ikki ustunli tartib)
            // tushganda matn qisqarishi kerak — aks holda `Row` toshib
            // ketadi. Ikonka har doim qoladi: holat FAQAT rang bilan
            // emas, ikonka bilan ham berilishi shart (WCAG 1.4.1).
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: fg,
                  fontSize: dense ? kFontMicro : kFontCaption,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
