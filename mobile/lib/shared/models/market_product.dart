import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

class MarketProduct extends Equatable {
  const MarketProduct({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.price,
    required this.stock,
    required this.unit,
    required this.status,
    required this.emoji,
    required this.hue,
    this.imageKey,
    this.finalPrice,
    this.discount,
    this.storeId,
    this.storeName,
  });

  final String id;
  final String? categoryId;
  final String name;
  final double price;
  final int stock;
  final String unit;
  final String status;
  final String emoji;
  final int hue;
  final String? imageKey;

  /// Do'kon aksiyasidan keyingi narx (spec §4). Eski serverda `null`.
  final double? finalPrice;
  final PromotionBadge? discount;

  /// Mahsulot do'koni. Savat bitta do'konga bog'langan — bosh sahifa
  /// lentasidan qo'shilganda shunga qarab "boshqa do'kon" so'raladi.
  /// `storeName` faqat lenta javobida (`store: {id, name}`) keladi.
  final String? storeId;
  final String? storeName;

  DiscountedPrice get _pricing =>
      DiscountedPrice(price: price, finalPrice: finalPrice, discount: discount);

  /// Mijoz to'laydigan narx — savatga shu tushadi.
  double get effectivePrice => _pricing.effective;
  bool get hasDiscount => _pricing.hasDiscount;

  String? get imageUrl => catalogImageUrl(imageKey);

  bool get isAvailable => status == 'active' && stock > 0;

  /// Derived from [hue] so a product's card color matches the seller
  /// dashboard's gradient swatch for the same product (see product.entity.ts).
  Color get color => HSLColor.fromAHSL(1, hue.toDouble(), 0.55, 0.48).toColor();

  IconData get icon => _iconForEmoji(emoji);

  factory MarketProduct.fromJson(Map<String, dynamic> json) {
    return MarketProduct(
      id: json['id'] as String,
      categoryId: json['categoryId'] as String?,
      name: json['name'] as String,
      price: (json['price'] as num).toDouble(),
      stock: (json['stock'] as num).toInt(),
      unit: (json['unit'] as String?) ?? 'dona',
      status: (json['status'] as String?) ?? 'active',
      emoji: (json['emoji'] as String?) ?? '📦',
      hue: (json['hue'] as num?)?.toInt() ?? 45,
      imageKey: json['imageKey'] as String?,
      finalPrice: (json['finalPrice'] as num?)?.toDouble(),
      discount: PromotionBadge.tryParse(json['discount']),
      storeId: (json['storeId'] as String?) ??
          (json['store'] is Map ? (json['store'] as Map)['id'] as String? : null),
      storeName: json['store'] is Map ? (json['store'] as Map)['name'] as String? : null,
    );
  }

  @override
  List<Object?> get props =>
      [id, categoryId, name, price, stock, unit, status, emoji, hue, imageKey, finalPrice, discount, storeId, storeName];
}

/// Best-effort emoji → Material icon mapping so existing icon-based product
/// cards render sensibly for real backend data (which stores an emoji, not
/// an IconData). Falls back to a generic shopping bag.
IconData _iconForEmoji(String emoji) {
  const map = <String, IconData>{
    '🌾': Icons.grass_rounded,
    '🫗': Icons.water_drop_rounded,
    '🧂': Icons.grain_rounded,
    '🍵': Icons.emoji_food_beverage_rounded,
    '💧': Icons.water_drop_rounded,
    '🥔': Icons.local_florist_rounded,
    '🥚': Icons.egg_rounded,
    '🧼': Icons.soap_rounded,
    '🥕': Icons.local_florist_rounded,
    '🥤': Icons.local_drink_rounded,
    '🧴': Icons.clean_hands_rounded,
    '🍚': Icons.rice_bowl_rounded,
  };
  return map[emoji] ?? Icons.shopping_bag_rounded;
}
