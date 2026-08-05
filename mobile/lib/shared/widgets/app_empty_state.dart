import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

// ============================================================================
// BO'SH HOLAT (empty state) — umumiy vidjet.
//
// Har bir ro'yxat/katalog ekrani uch holatga ega bo'lishi SHART:
//   yuklanmoqda  → `AppSkeleton*` (spinner emas)
//   bo'sh        → `AppEmptyState`
//   xato         → `AppErrorState` (shared/widgets/error_widget.dart)
//
// Ikonka `kInkSubtle` (3.67:1 — UI elementi sifatida o'tadi), sarlavha `kInk`,
// izoh `kInkMuted` (5.47:1). Ikonka dekorativ, shuning uchun
// `ExcludeSemantics` bilan o'raladi — ekran o'quvchi faqat matnni o'qiydi.
// ============================================================================

class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  /// Dekorativ ikonka — ma'no tashimaydi, matn uni takrorlaydi.
  final IconData icon;

  /// Nima yo'qligini bir jumlada aytadi.
  final String title;

  /// Nima qilish kerakligini tushuntiradi (ixtiyoriy).
  final String? message;

  final String? actionLabel;
  final VoidCallback? onAction;

  /// Karta ichida yoki sheet'da ishlatilganda kichikroq variant.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final iconBox = compact ? 64.0 : 88.0;
    final iconSize = compact ? 30.0 : 40.0;

    return Semantics(
      container: true,
      child: Center(
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: kSpace6,
            vertical: compact ? kSpace5 : kSpace8,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ExcludeSemantics(
                child: Container(
                  width: iconBox,
                  height: iconBox,
                  decoration: const BoxDecoration(
                    color: kSurface2,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: iconSize, color: kInkSubtle),
                ),
              ),
              SizedBox(height: compact ? kSpace3 : kSpace5),
              Text(
                title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: compact ? kFontTitle : kFontH3,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              if (message != null) ...[
                const SizedBox(height: kSpace2),
                Text(
                  message!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: kFontBody,
                    height: 1.45,
                    color: kInkMuted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
              if (actionLabel != null && onAction != null) ...[
                SizedBox(height: compact ? kSpace4 : kSpace6),
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 180),
                  child: ElevatedButton(
                    onPressed: onAction,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(180, kControlHeight),
                    ),
                    child: Text(actionLabel!),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
