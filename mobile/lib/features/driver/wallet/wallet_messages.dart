import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/shift_pass.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:equatable/equatable.dart';

/// `wallet:updated` realtime hodisasi (docs/LEGAL-COMPLIANCE.md §17).
class WalletUpdate extends Equatable {
  const WalletUpdate({
    required this.balance,
    required this.delta,
    required this.reason,
    this.topupId,
  });

  final double balance;
  final double delta;

  /// `topup` | `topup_reversal` | `manual_adjustment` | `shift_pass_refund` |
  /// `vendor_settlement_reversal` | `refund_clawback` (noma'lum qiymat ham
  /// qabul qilinadi).
  final String reason;
  final String? topupId;

  static WalletUpdate? tryParse(dynamic data) {
    if (data is! Map) return null;
    final balance = data['balance'];
    if (balance is! num) return null;
    return WalletUpdate(
      balance: balance.toDouble(),
      delta: (data['delta'] as num?)?.toDouble() ?? 0,
      reason: (data['reason'] as String?) ?? '',
      topupId: data['topupId']?.toString(),
    );
  }

  @override
  List<Object?> get props => [balance, delta, reason, topupId];
}

String _signed(double amount) {
  final formatted = Formatters.formatPrice(amount.abs());
  if (amount > 0) return '+$formatted';
  if (amount < 0) return '−$formatted';
  return formatted;
}

/// Snackbar matni — haydovchi balans NEGA o'zgarganini bilishi kerak.
String walletUpdateText(WalletUpdate update) {
  final l10n = AppL10n.current;
  final amount = _signed(update.delta);
  return switch (update.reason) {
    'topup' => l10n.wltUpdTopup(amount),
    'topup_reversal' => l10n.wltUpdTopupReversal(amount),
    'manual_adjustment' => l10n.wltUpdManual(amount),
    'shift_pass_refund' => l10n.wltUpdShiftRefund(amount),
    'vendor_settlement_reversal' => l10n.wltUpdVendorReversal(amount),
    'refund_clawback' => l10n.wltUpdRefundClawback(amount),
    _ => l10n.wltUpdGeneric(amount),
  };
}

/// "5 soat 12 daqiqa" / "40 daqiqa".
String formatShiftRemaining(Duration remaining) {
  final l10n = AppL10n.current;
  final totalMinutes = remaining.inMinutes;
  final hours = totalMinutes ~/ 60;
  final minutes = totalMinutes % 60;
  if (hours <= 0) return l10n.shfMinutes(minutes);
  return l10n.shfHoursMinutes(hours, minutes);
}

/// "So'nggi 7 kunda komissiyaga X so'm to'ladingiz, smena bilan Y so'm
/// bo'lardi." Safar bo'lmagan bo'lsa taqqoslash ma'nosiz — boshqa matn.
String shiftPassComparisonText(ShiftPassComparison c) {
  final l10n = AppL10n.current;
  if (c.workingDays <= 0) return l10n.shfComparisonNoTrips(c.periodDays);
  return l10n.shfComparison(
    c.periodDays,
    Formatters.formatPrice(c.commissionPaid),
    Formatters.formatPrice(c.passCost),
  );
}

/// Qaysi biri arzonroq — taqqoslash ostidagi qisqa xulosa. Safar
/// bo'lmagan bo'lsa `null`.
String? shiftPassVerdictText(ShiftPassComparison c) {
  if (c.workingDays <= 0) return null;
  final l10n = AppL10n.current;
  final savings = Formatters.formatPrice(c.savings.abs());
  return switch (c.cheaperOption) {
    ShiftPassCheaperOption.shiftPass => l10n.shfVerdictShift(savings),
    ShiftPassCheaperOption.commission => l10n.shfVerdictCommission(savings),
    ShiftPassCheaperOption.equal => l10n.shfVerdictEqual,
  };
}

/// Xizmat turi kodi → mahalliy nom (smena qamrovi uchun).
String serviceTypeLabel(String code) {
  final l10n = AppL10n.current;
  return switch (code) {
    'taxi' => l10n.drvTypeTaxi,
    'cargo' => l10n.drvTypeCargo,
    'food' => l10n.drvTypeFood,
    'market' => l10n.drvTypeMarket,
    _ => code,
  };
}
