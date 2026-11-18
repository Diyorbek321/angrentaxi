import 'package:angren_taxi/l10n/l10n.dart';

/// One row of the wallet ledger, as returned by `GET /payments/transactions`.
///
/// The wallet screen used to render two hardcoded rows ("Hisob to'ldirildi
/// +50 000", "Taksi to'lovi −18 000") that were identical for every user and
/// never changed. This is the real thing.
class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.amount,
    required this.isCredit,
    required this.status,
    required this.createdAt,
    this.orderId,
    this.paymentMethod,
    this.externalId,
  });

  final String id;
  final double amount;

  /// Credits add to the balance, debits subtract from it.
  final bool isCredit;

  /// `completed`, `pending`, `failed` or `refunded`. Only completed rows move
  /// the balance, so a pending row is shown but visually distinguished.
  final String status;

  final DateTime createdAt;
  final String? orderId;
  final String? paymentMethod;

  /// Free-text marker the backend sets on non-order movements — `commission`,
  /// `withdrawal_<id>`, `referral_bonus_...`. Used to label the row.
  final String? externalId;

  bool get isPending => status == 'pending';

  factory WalletTransaction.fromJson(Map<String, dynamic> json) {
    return WalletTransaction(
      id: json['id'] as String,
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      isCredit: json['type'] == 'credit',
      status: json['status'] as String? ?? 'completed',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ??
          DateTime.now(),
      orderId: json['orderId'] as String?,
      paymentMethod: json['paymentMethod'] as String?,
      externalId: json['externalId'] as String?,
    );
  }

  /// Human label in Uzbek, derived from what the row actually represents
  /// rather than from a fixed string.
  String get title {
    final marker = externalId ?? '';

    if (marker == 'commission') return AppL10n.current.saTxnCommission;
    if (marker.startsWith('withdrawal_')) return AppL10n.current.saTxnWithdrawal;
    if (marker.startsWith('referral_bonus')) return AppL10n.current.saTxnReferralBonus;
    if (marker.startsWith('bonus')) return AppL10n.current.saTxnBonus;
    if (orderId != null) {
      return isCredit
          ? AppL10n.current.saTxnTripEarning
          : AppL10n.current.saTxnTripPayment;
    }
    return isCredit
        ? AppL10n.current.saTxnTopUp
        : AppL10n.current.saTxnDebit;
  }
}
