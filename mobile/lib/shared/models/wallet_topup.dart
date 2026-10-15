import 'package:equatable/equatable.dart';

// ============================================================================
// HAMYONNI TO'LDIRISH — docs/LEGAL-COMPLIANCE.md §11, §17.
//
//   POST /payments/wallet/topup   → WalletTopup & { topupId, checkoutUrl }
//   GET  /payments/wallet/topup/:id → WalletTopup
//   GET  /payments/wallet/topups    → WalletTopup[] (oxirgi 20)
//
// Kirim faqat provayder callback'i `paid` ga o'tkazganda tushadi — ilova
// "to'ladim" tugmasi hech narsani tasdiqlamaydi, faqat holatni kutadi.
// ============================================================================

enum WalletTopupStatus { pending, paid, failed, cancelled, expired, unknown }

WalletTopupStatus _statusFromWire(String? value) => switch (value) {
      'pending' => WalletTopupStatus.pending,
      'paid' => WalletTopupStatus.paid,
      'failed' => WalletTopupStatus.failed,
      'cancelled' => WalletTopupStatus.cancelled,
      'expired' => WalletTopupStatus.expired,
      _ => WalletTopupStatus.unknown,
    };

extension WalletTopupStatusX on WalletTopupStatus {
  /// Bu holatdan keyin o'zgarish kutilmaydi — so'rovni to'xtatish mumkin.
  bool get isFinal =>
      this != WalletTopupStatus.pending && this != WalletTopupStatus.unknown;
}

/// Ilovada tanlanadigan provayderlar. UZPS (`uzcard`) server tomonda bor,
/// lekin vazifada faqat Payme / Click so'ralgan.
enum WalletTopupProvider { payme, click }

extension WalletTopupProviderWire on WalletTopupProvider {
  String get wireValue => switch (this) {
        WalletTopupProvider.payme => 'payme',
        WalletTopupProvider.click => 'click',
      };

  String get displayName => switch (this) {
        WalletTopupProvider.payme => 'Payme',
        WalletTopupProvider.click => 'Click',
      };
}

DateTime? _date(dynamic value) =>
    value is String ? DateTime.tryParse(value)?.toLocal() : null;

class WalletTopup extends Equatable {
  const WalletTopup({
    required this.id,
    required this.amount,
    required this.provider,
    required this.status,
    this.createdAt,
    this.paidAt,
    this.cancelledAt,
    this.expiresAt,
    this.checkoutUrl,
  });

  final String id;
  final double amount;

  /// Xom qiymat (`payme|click|uzcard`) — tarixda server nima desa shu.
  final String provider;
  final WalletTopupStatus status;
  final DateTime? createdAt;
  final DateTime? paidAt;
  final DateTime? cancelledAt;
  final DateTime? expiresAt;

  /// Faqat yaratish javobida bor.
  final String? checkoutUrl;

  String get providerLabel => switch (provider) {
        'payme' => 'Payme',
        'click' => 'Click',
        'uzcard' => 'Uzcard',
        _ => provider,
      };

  factory WalletTopup.fromJson(Map<String, dynamic> json) {
    final id = (json['topupId'] ?? json['id'])?.toString() ?? '';
    return WalletTopup(
      id: id,
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      provider: (json['provider'] as String?) ?? '',
      status: _statusFromWire(json['status'] as String?),
      createdAt: _date(json['createdAt']),
      paidAt: _date(json['paidAt']),
      cancelledAt: _date(json['cancelledAt']),
      expiresAt: _date(json['expiresAt']),
      checkoutUrl: json['checkoutUrl'] as String?,
    );
  }

  WalletTopup copyWith({WalletTopupStatus? status, DateTime? paidAt}) =>
      WalletTopup(
        id: id,
        amount: amount,
        provider: provider,
        status: status ?? this.status,
        createdAt: createdAt,
        paidAt: paidAt ?? this.paidAt,
        cancelledAt: cancelledAt,
        expiresAt: expiresAt,
        checkoutUrl: checkoutUrl,
      );

  @override
  List<Object?> get props => [
        id,
        amount,
        provider,
        status,
        createdAt,
        paidAt,
        cancelledAt,
        expiresAt,
        checkoutUrl,
      ];
}

/// `GET /settings/public` — haydovchi ilovasiga kerakli qismi.
class PublicSettings extends Equatable {
  const PublicSettings({
    this.supportPhone,
    this.walletTopupEnabled = false,
    this.walletTopupMin = 10000,
    this.walletTopupMax = 2000000,
    this.walletTopupPresets = const [50000, 100000, 200000],
    this.vendorSettlementMode = 'cash',
  });

  final String? supportPhone;
  final bool walletTopupEnabled;
  final double walletTopupMin;
  final double walletTopupMax;
  final List<double> walletTopupPresets;

  /// AMALDAGI rejim: `cash` | `wallet`.
  final String vendorSettlementMode;

  bool get isVendorWalletMode => vendorSettlementMode == 'wallet';

  static const defaults = PublicSettings();

  factory PublicSettings.fromJson(Map<String, dynamic> json) {
    final rawPresets = json['walletTopupPresets'];
    final phone = (json['supportPhone'] as String?)?.trim();
    return PublicSettings(
      supportPhone: (phone == null || phone.isEmpty) ? null : phone,
      walletTopupEnabled: (json['walletTopupEnabled'] as bool?) ?? false,
      walletTopupMin: (json['walletTopupMin'] as num?)?.toDouble() ??
          defaults.walletTopupMin,
      walletTopupMax: (json['walletTopupMax'] as num?)?.toDouble() ??
          defaults.walletTopupMax,
      walletTopupPresets: rawPresets is List
          ? rawPresets.whereType<num>().map((e) => e.toDouble()).toList()
          : defaults.walletTopupPresets,
      vendorSettlementMode:
          (json['vendorSettlementMode'] as String?) ?? 'cash',
    );
  }

  @override
  List<Object?> get props => [
        supportPhone,
        walletTopupEnabled,
        walletTopupMin,
        walletTopupMax,
        walletTopupPresets,
        vendorSettlementMode,
      ];
}
