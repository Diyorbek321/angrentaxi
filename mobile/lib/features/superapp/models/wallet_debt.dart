import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:equatable/equatable.dart';

// ============================================================================
// HAMYON QARZI — docs/INCIDENT-POLICY.md §7.
//
//   GET  /payments/wallet/debt        → WalletDebt
//   POST /payments/wallet/debt/settle → WalletDebt (hamyondagi pul bilan)
//
// Qarz yangi buyurtmani to'sadi (400 `WALLET_DEBT_OUTSTANDING`). Bonus qarzni
// yopmaydi — server `realBalance` ni shu qoida bilan beradi.
// ============================================================================

/// Xato buyurtma qarz sababli rad etilganimi.
bool isWalletDebtError(Object? error) => ApiError.from(error)?.code == ApiErrorCode.walletDebtOutstanding;

class WalletDebtItem extends Equatable {
  const WalletDebtItem({required this.id, required this.amount, required this.reason, this.orderId});

  factory WalletDebtItem.fromJson(Map<String, dynamic> json) => WalletDebtItem(
        id: json['id']?.toString() ?? '',
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        reason: json['reason']?.toString() ?? '',
        orderId: json['orderId']?.toString(),
      );

  final String id;
  final double amount;

  /// `ride_shortfall|delivery_refused|late_cancel|no_show|incident_penalty`.
  final String reason;
  final String? orderId;

  String get reasonLabel {
    final l10n = AppL10n.current;
    return switch (reason) {
      'ride_shortfall' => l10n.saDebtReasonRide,
      'delivery_refused' => l10n.saDebtReasonDelivery,
      'late_cancel' => l10n.saDebtReasonLateCancel,
      'no_show' => l10n.saDebtReasonNoShow,
      'incident_penalty' => l10n.saDebtReasonIncident,
      _ => l10n.saDebtReasonOther,
    };
  }

  @override
  List<Object?> get props => [id, amount, reason, orderId];
}

class WalletDebt extends Equatable {
  const WalletDebt({
    required this.total,
    required this.items,
    required this.canSettleNow,
    required this.topUpNeeded,
    required this.topUpAvailable,
    required this.minTopUp,
    required this.supportPhone,
  });

  factory WalletDebt.fromJson(Map<String, dynamic> json) => WalletDebt(
        total: (json['total'] as num?)?.toDouble() ?? 0,
        items: (json['items'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(WalletDebtItem.fromJson)
            .toList(growable: false),
        canSettleNow: json['canSettleNow'] == true,
        topUpNeeded: (json['topUpNeeded'] as num?)?.toDouble() ?? 0,
        topUpAvailable: json['topUpAvailable'] == true,
        minTopUp: (json['minTopUp'] as num?)?.toDouble() ?? 0,
        supportPhone: json['supportPhone']?.toString() ?? '',
      );

  final double total;
  final List<WalletDebtItem> items;
  final bool canSettleNow;
  final double topUpNeeded;

  /// Karta orqali to'ldirish mumkinmi: provayder sozlangan VA `walletTopupEnabled`.
  final bool topUpAvailable;
  final double minTopUp;
  final String supportPhone;

  bool get hasDebt => total > 0;

  /// Yetishmagan summa to'ldiriladi; provayder quyi chegarasidan kam emas.
  double get topUpAmount => topUpNeeded > minTopUp ? topUpNeeded : minTopUp;

  @override
  List<Object?> get props => [total, items, canSettleNow, topUpNeeded, topUpAvailable, minTopUp, supportPhone];
}
