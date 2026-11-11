import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

/// Rasmsiz taomlar uchun dekorativ platsholder palitrasi.
/// Ma'no tashimaydi — faqat vizual xilma-xillik uchun.
const _dishPalette = <Color>[
  kError,
  kWarning,
  kMintDeep,
  kInfo,
  kAccentViolet,
  kWarningDeep,
];

class Dish extends Equatable {
  const Dish({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.description,
    required this.price,
    required this.prepMinutes,
    required this.isAvailable,
    required this.tags,
    this.imageKey,
    this.finalPrice,
    this.discount,
  });

  final String id;
  final String? categoryId;
  final String name;
  final String? description;
  final double price;
  final int prepMinutes;
  final bool isAvailable;
  final List<String> tags;
  final String? imageKey;

  /// Restoran aksiyasidan keyingi narx (spec §4). Eski serverda `null`.
  final double? finalPrice;

  /// Qo'llangan aksiya belgisi. Eski serverda `null`.
  final PromotionBadge? discount;

  DiscountedPrice get _pricing =>
      DiscountedPrice(price: price, finalPrice: finalPrice, discount: discount);

  /// Mijoz to'laydigan narx — savatga shu tushadi.
  double get effectivePrice => _pricing.effective;
  bool get hasDiscount => _pricing.hasDiscount;

  String? get imageUrl => catalogImageUrl(imageKey);

  // Fallback while the photo loads or when a dish has none — a stable color
  // from the shared palette keeps cards visually distinct.
  Color get color => _dishPalette[name.hashCode.abs() % _dishPalette.length];
  IconData get icon => Icons.restaurant_rounded;

  factory Dish.fromJson(Map<String, dynamic> json) {
    return Dish(
      id: json['id'] as String,
      categoryId: json['categoryId'] as String?,
      name: json['name'] as String,
      description: json['description'] as String?,
      price: (json['price'] as num).toDouble(),
      prepMinutes: (json['prepMinutes'] as num?)?.toInt() ?? 10,
      isAvailable: (json['isAvailable'] as bool?) ?? true,
      tags: ((json['tags'] as List<dynamic>?) ?? []).map((e) => e as String).toList(),
      imageKey: json['imageKey'] as String?,
      finalPrice: (json['finalPrice'] as num?)?.toDouble(),
      discount: PromotionBadge.tryParse(json['discount']),
    );
  }

  @override
  List<Object?> get props => [id, categoryId, name, description, price, prepMinutes, isAvailable, tags, imageKey, finalPrice, discount];
}
