import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:equatable/equatable.dart';

class FoodRestaurant extends Equatable {
  const FoodRestaurant({
    required this.id,
    required this.name,
    required this.address,
    required this.isOpen,
    this.imageKey,
    this.activePromotion,
  });

  final String id;
  final String name;
  final String? address;
  final bool isOpen;
  final String? imageKey;

  /// Eng katta faol aksiya (`GET /food/restaurants`). Eski serverda `null`.
  final PromotionBadge? activePromotion;

  String? get imageUrl => catalogImageUrl(imageKey);

  factory FoodRestaurant.fromJson(Map<String, dynamic> json) {
    return FoodRestaurant(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String?,
      isOpen: (json['status'] as String?) != 'closed',
      imageKey: json['imageKey'] as String?,
      activePromotion: PromotionBadge.tryParse(json['activePromotion']),
    );
  }

  @override
  List<Object?> get props => [id, name, address, isOpen, imageKey, activePromotion];
}
