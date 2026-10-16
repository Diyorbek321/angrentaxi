import 'dart:math' as math;

import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';

// ============================================================================
// HAMYON: YECHISH USHLAB TURILISHI VA OCHIQ TO'LDIRISHLAR
// (docs/LEGAL-COMPLIANCE.md §21, §25 #3a / #13).
//
// `available = max(0, balance − held − bonus)`: karta orqali to'ldirilgan
// pul `holdDays` kun davomida, bonus esa doim komissiya/smenaga sarflanadi,
// lekin yechilmaydi.
// ============================================================================

/// Yechish mumkin bo'lgan summa. Ushlab turilgan summa noma'lum (eski
/// server) yoki qoldiq o'qilmagan bo'lsa — `null` (chegarani server qo'yadi).
///
/// Bonus (haydovchi/referal bonusi) ham ayiriladi: u komissiya va smenaga
/// sarflanadi, lekin yechib olinmaydi. Eski server `bonus` bermaydi — 0.
double? withdrawableAmount({
  required double? balance,
  required double? held,
  double? bonus,
}) {
  if (balance == null || held == null) return null;
  return math.max(0.0, balance - held - (bonus ?? 0));
}

/// "Bonus X — komissiya va smenaga sarflanadi, yechib bo'lmaydi".
/// Bonus yo'q yoki noma'lum — `null`.
String? withdrawalBonusNote(double? bonus) {
  if (bonus == null || bonus <= 0) return null;
  return AppL10n.current.wdrBonusNote(Formatters.formatPrice(bonus));
}

/// "Karta orqali to'ldirilgan X so'm N kundan keyin yechish mumkin".
/// Ushlab turilgan narsa yo'q yoki muddat o'chiq (0) — `null`.
String? withdrawalHoldNote({required double? held, required int holdDays}) {
  if (held == null || held <= 0 || holdDays <= 0) return null;
  return AppL10n.current
      .wdrHoldNote(Formatters.formatPrice(held), holdDays.toString());
}

/// `WALLET_WITHDRAWAL_ON_HOLD` — ilova tilida, aniq summalar bilan.
/// Boshqa kod — `null`.
String? withdrawalOnHoldMessage(ApiError? error) {
  if (error?.code != ApiErrorCode.walletWithdrawalOnHold) return null;
  final l10n = AppL10n.current;
  final available = error!.amount('available');
  final note = withdrawalHoldNote(
    held: error.amount('held'),
    holdDays: error.amount('holdDays')?.round() ?? 0,
  );
  final bonusNote = withdrawalBonusNote(error.amount('bonus'));
  final lines = <String>[
    if (note != null) note,
    if (bonusNote != null) bonusNote,
    if (available != null)
      available > 0
          ? l10n.wdrAmountExceedsAvailable(Formatters.formatPrice(available))
          : l10n.wdrNothingAvailable,
  ];
  return lines.isEmpty ? null : lines.join('\n');
}

/// `WALLET_TOPUP_TOO_MANY_PENDING` — ilova tilida. Boshqa kod — `null`.
String? topupTooManyPendingMessage(ApiError? error) {
  if (error?.code != ApiErrorCode.walletTopupTooManyPending) return null;
  final l10n = AppL10n.current;
  final max = error!.amount('maxPending')?.round();
  return max == null || max <= 0
      ? l10n.wltTooManyPendingNoCount
      : l10n.wltTooManyPending(max.toString());
}
