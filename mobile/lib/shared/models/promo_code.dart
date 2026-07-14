import 'package:equatable/equatable.dart';

/// An active, currently-usable promo code, backed by
/// `GET /promo-codes/active`
/// (backend/src/modules/promo-codes/promo-codes.controller.ts), which
/// serializes `PromoCode` entities as-is (no DTO/mapping layer) — see
/// backend/src/database/entities/promo_code.entity.ts.
class PromoCode extends Equatable {
  const PromoCode({
    required this.id,
    required this.code,
    required this.discountPercent,
    required this.discountFixed,
    required this.maxUses,
    required this.usedCount,
    required this.minOrderAmount,
    required this.expiresAt,
    required this.isActive,
  });

  final String id;
  final String code;

  /// Percent discount (0-100), mutually exclusive with [discountFixed].
  final double? discountPercent;

  /// Fixed UZS discount amount, mutually exclusive with [discountPercent].
  final double? discountFixed;

  /// Null when the code has no usage cap.
  final int? maxUses;
  final int usedCount;

  /// Always a number (defaults to 0 on the backend), never null.
  final double minOrderAmount;

  /// Null when the code has no expiry.
  final DateTime? expiresAt;
  final bool isActive;

  factory PromoCode.fromJson(Map<String, dynamic> json) {
    return PromoCode(
      id: json['id'] as String,
      code: json['code'] as String,
      discountPercent: (json['discountPercent'] as num?)?.toDouble(),
      discountFixed: (json['discountFixed'] as num?)?.toDouble(),
      maxUses: (json['maxUses'] as num?)?.toInt(),
      usedCount: (json['usedCount'] as num?)?.toInt() ?? 0,
      minOrderAmount: (json['minOrderAmount'] as num?)?.toDouble() ?? 0,
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'] as String)
          : null,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'discountPercent': discountPercent,
        'discountFixed': discountFixed,
        'maxUses': maxUses,
        'usedCount': usedCount,
        'minOrderAmount': minOrderAmount,
        'expiresAt': expiresAt?.toIso8601String(),
        'isActive': isActive,
      };

  @override
  List<Object?> get props => [
        id,
        code,
        discountPercent,
        discountFixed,
        maxUses,
        usedCount,
        minOrderAmount,
        expiresAt,
        isActive,
      ];
}
