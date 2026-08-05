import 'package:angren_taxi/core/config/app_theme.dart';
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
  });

  final String id;
  final String? categoryId;
  final String name;
  final String? description;
  final double price;
  final int prepMinutes;
  final bool isAvailable;
  final List<String> tags;

  // No per-dish artwork from the backend yet — assign a stable color from
  // the shared palette so cards stay visually distinct without fake images.
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
    );
  }

  @override
  List<Object?> get props => [id, categoryId, name, description, price, prepMinutes, isAvailable, tags];
}
