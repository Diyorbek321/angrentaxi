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
    );
  }

  @override
  List<Object?> get props => [id, categoryId, name, price, stock, unit, status, emoji, hue];
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
