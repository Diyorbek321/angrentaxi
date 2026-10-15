import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:equatable/equatable.dart';

// ============================================================================
// RESTORAN / DO'KON CHEGIRMALARI (aksiyalar) — docs/specs/food-market-ux-v5.md §4.
//
// Chegirmani VENDOR beradi. Ilova faqat ko'rsatadi: narxni server
// `finalPrice` bilan hisoblaydi, ilova uni o'zi chiqarib olmaydi.
// Eski server bu maydonlarni bermaydi — har bir tahlil `null` ga qaytadi
// va ekran chegirmasiz ko'rinishga tushadi.
// ============================================================================

enum DiscountType { percent, fixed }

DiscountType? _discountTypeOf(Object? value) => switch (value) {
      'percent' => DiscountType.percent,
      'fixed' => DiscountType.fixed,
      _ => null,
    };

double? _num(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

/// Taom/restoran ustidagi qisqa chegirma belgisi:
/// `{ title, discountType, discountValue }`.
class PromotionBadge extends Equatable {
  const PromotionBadge({
    required this.title,
    required this.discountType,
    required this.discountValue,
    this.minOrderAmount,
  });

  final String title;

  /// Aksiya faqat shu summadan oshgan buyurtmaga qo'llanadi — vitrina
  /// narxiga (`finalPrice`) TUSHMAYDI (spec v5 §6), shart sifatida
  /// ko'rsatiladi.
  final double? minOrderAmount;
  final DiscountType discountType;
  final double discountValue;

  static PromotionBadge? tryParse(Object? json) {
    if (json is! Map) return null;
    final type = _discountTypeOf(json['discountType']);
    final value = _num(json['discountValue']);
    if (type == null || value == null || value <= 0) return null;
    return PromotionBadge(
      title: (json['title'] as String?)?.trim() ?? '',
      discountType: type,
      discountValue: value,
      minOrderAmount: (_num(json['minOrderAmount']) ?? 0) > 0 ? _num(json['minOrderAmount']) : null,
    );
  }

  /// "−20%" yoki "−5 000 so'm".
  String get shortLabel => discountType == DiscountType.percent
      ? '−${discountValue.round()}%'
      : '−${Formatters.formatSom(discountValue)}';

  @override
  List<Object?> get props => [title, discountType, discountValue, minOrderAmount];
}

/// Bosh ekrandagi "Chegirmalar" lentasining bitta kartasi
/// (`GET /promotions/active?serviceType=food|market`).
class ActivePromotion extends Equatable {
  const ActivePromotion({
    required this.id,
    required this.title,
    required this.badge,
    required this.vendorType,
    required this.vendorId,
    this.description,
    this.vendorName,
    this.vendorImageKey,
    this.endsAt,
  });

  final String id;
  final String title;
  final String? description;
  final PromotionBadge badge;

  /// `restaurant` yoki `store`.
  final String vendorType;
  final String vendorId;
  final String? vendorName;
  final String? vendorImageKey;
  final DateTime? endsAt;

  String? get vendorImageUrl => catalogImageUrl(vendorImageKey);
  bool get isRestaurant => vendorType == 'restaurant';

  static ActivePromotion? tryParse(Object? json) {
    if (json is! Map) return null;
    final badge = PromotionBadge.tryParse(json);
    final id = json['id'];
    final vendorId = json['vendorId'];
    if (badge == null || id is! String || vendorId is! String) return null;
    final endsAt = json['endsAt'];
    return ActivePromotion(
      id: id,
      title: badge.title,
      description: (json['description'] as String?)?.trim(),
      badge: badge,
      vendorType: (json['vendorType'] as String?) ?? 'restaurant',
      vendorId: vendorId,
      vendorName: json['vendorName'] as String?,
      vendorImageKey: json['vendorImageKey'] as String?,
      endsAt: endsAt is String ? DateTime.tryParse(endsAt) : null,
    );
  }

  /// Ro'yxatdan o'qib bo'lmaydigan elementlarni tashlab yuboradi va
  /// eng katta chegirmani birinchi qo'yadi (server ham shunday beradi —
  /// bu faqat himoya).
  static List<ActivePromotion> parseList(Object? json) {
    if (json is! List) return const [];
    final list = json
        .map(ActivePromotion.tryParse)
        .whereType<ActivePromotion>()
        .toList();
    return List.unmodifiable(list);
  }

  @override
  List<Object?> get props => [id, title, description, badge, vendorType, vendorId, vendorName, vendorImageKey, endsAt];
}

/// Narx + ixtiyoriy chegirma: `price` (asl), `finalPrice`, `discount`.
/// Taom va market mahsuloti uchun umumiy tahlil.
class DiscountedPrice {
  const DiscountedPrice({required this.price, this.finalPrice, this.discount});

  final double price;
  final double? finalPrice;
  final PromotionBadge? discount;

  /// Mijoz to'laydigan narx.
  double get effective {
    final f = finalPrice;
    if (f == null || f <= 0 || f >= price) return price;
    return f;
  }

  bool get hasDiscount => effective < price;

  static DiscountedPrice fromJson(Map<String, dynamic> json) {
    return DiscountedPrice(
      price: _num(json['price']) ?? 0,
      finalPrice: _num(json['finalPrice']),
      discount: PromotionBadge.tryParse(json['discount']),
    );
  }
}
