import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

// ============================================================================
// XATO HOLATI — umumiy vidjetlar.
//
//   `AppErrorState`    — to'liq ekran / blok xatosi, "Qayta urinish" bilan.
//   `InlineErrorWidget` — forma yoki karta ichidagi ingichka xato banneri.
//
// Kontrast: xato MATNI `kErrorDeep` (#B91C1C, oq ustida 6.47:1 AA).
// `kError` (#E5484D) faqat ikona va to'ldirish uchun (3.91:1 — UI).
// Xato faqat RANG bilan bildirilmaydi: ikona + matn har doim birga.
// ============================================================================

class AppErrorState extends StatelessWidget {
  const AppErrorState({
    super.key,
    required this.message,
    this.title = 'Xatolik yuz berdi',
    this.onRetry,
    this.retryLabel = 'Qayta urinish',
    this.compact = false,
  });

  final String message;
  final String title;
  final VoidCallback? onRetry;
  final String retryLabel;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final iconBox = compact ? 64.0 : 88.0;

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
                    color: kErrorLight,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.error_outline_rounded,
                    size: compact ? 30 : 40,
                    color: kError,
                  ),
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
              const SizedBox(height: kSpace2),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: kFontBody,
                  height: 1.45,
                  color: kInkMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (onRetry != null) ...[
                SizedBox(height: compact ? kSpace4 : kSpace6),
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 180),
                  child: ElevatedButton(
                    onPressed: onRetry,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(180, kControlHeight),
                    ),
                    child: Text(retryLabel),
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

/// Eski nom — mavjud chaqiruvlar buzilmasligi uchun saqlanadi.
class AppErrorWidget extends StatelessWidget {
  const AppErrorWidget({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel = 'Qayta urinish',
  });

  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    return AppErrorState(
      message: message,
      onRetry: onRetry,
      retryLabel: retryLabel,
    );
  }
}

/// Forma / karta ichidagi ingichka xato banneri.
class InlineErrorWidget extends StatelessWidget {
  const InlineErrorWidget({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel = 'Qayta urinish',
  });

  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      liveRegion: true,
      label: 'Xatolik: $message',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(kSpace3),
        decoration: BoxDecoration(
          color: kErrorLight,
          borderRadius: BorderRadius.circular(kRadiusSm),
          border: Border.all(color: kErrorBorder),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline_rounded, color: kError, size: 20),
            const SizedBox(width: kSpace2),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: kErrorDeep,
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(width: kSpace2),
              SizedBox(
                height: kMinTapTarget,
                child: TextButton(
                  onPressed: onRetry,
                  style: TextButton.styleFrom(
                    foregroundColor: kErrorDeep,
                    padding: const EdgeInsets.symmetric(horizontal: kSpace3),
                  ),
                  child: Text(
                    retryLabel,
                    style: const TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
