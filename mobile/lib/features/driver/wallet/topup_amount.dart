import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';

enum TopupAmountError { empty, invalid, belowMin, aboveMax }

/// Kiritilgan summani tekshiradi. Natija — (summa, xato); xato bo'lmasa
/// summa butun so'm.
///
/// Server ham chegaralarni tekshiradi (`walletTopupMin/Max`), lekin
/// haydovchi xatoni tugmani bosishdan OLDIN, maydon ostida ko'rishi kerak.
abstract final class TopupAmount {
  /// "100 000", "100,000", "100000 so'm" → 100000. Raqam bo'lmasa `null`.
  static int? parse(String? raw) {
    final cleaned = (raw ?? '')
        .toLowerCase()
        .replaceAll(RegExp(r"so['’‘`]?m|сум"), '')
        .replaceAll(RegExp(r'[\s,.  ]'), '');
    if (cleaned.isEmpty) return null;
    if (!RegExp(r'^\d+$').hasMatch(cleaned)) return null;
    return int.tryParse(cleaned);
  }

  static TopupAmountError? validate(
    String? raw, {
    required double min,
    required double max,
  }) {
    if ((raw ?? '').trim().isEmpty) return TopupAmountError.empty;
    final amount = parse(raw);
    if (amount == null || amount <= 0) return TopupAmountError.invalid;
    if (amount < min) return TopupAmountError.belowMin;
    if (amount > max) return TopupAmountError.aboveMax;
    return null;
  }

  static String message(
    TopupAmountError error, {
    required double min,
    required double max,
  }) {
    final l10n = AppL10n.current;
    return switch (error) {
      TopupAmountError.empty => l10n.wltValAmountEmpty,
      TopupAmountError.invalid => l10n.wltValAmountInvalid,
      TopupAmountError.belowMin =>
        l10n.wltValAmountMin(Formatters.formatPrice(min)),
      TopupAmountError.aboveMax =>
        l10n.wltValAmountMax(Formatters.formatPrice(max)),
    };
  }
}
