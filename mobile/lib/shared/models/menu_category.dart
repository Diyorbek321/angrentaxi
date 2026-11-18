import 'package:equatable/equatable.dart';

/// Menyu bo'limi (`GET /food/restaurants/:id` → `categories`).
/// `sortOrder` / `itemCount` spec v5 §5 da qo'shilgan — eski serverda
/// yo'q bo'lishi mumkin.
class MenuCategory extends Equatable {
  const MenuCategory({
    required this.id,
    required this.name,
    this.sortOrder = 0,
    this.itemCount,
  });

  final String id;
  final String name;
  final int sortOrder;
  final int? itemCount;

  factory MenuCategory.fromJson(Map<String, dynamic> json) {
    return MenuCategory(
      id: json['id'] as String,
      name: json['name'] as String,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      itemCount: (json['itemCount'] as num?)?.toInt(),
    );
  }

  @override
  List<Object?> get props => [id, name, sortOrder, itemCount];
}
