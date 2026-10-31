import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:equatable/equatable.dart';

class MarketStore extends Equatable {
  const MarketStore({
    required this.id,
    required this.name,
    required this.address,
    required this.deliveryMode,
    required this.workingHoursStart,
    required this.workingHoursEnd,
    this.imageKey,
    this.activePromotion,
  });

  final String id;
  final String name;
  final String? address;
  final String deliveryMode;
  final String workingHoursStart;
  final String workingHoursEnd;
  final String? imageKey;

  /// Do'konning eng kuchli faol aksiyasi (ro'yxat kartochkasidagi belgi).
  final PromotionBadge? activePromotion;

  String? get imageUrl => catalogImageUrl(imageKey);

  factory MarketStore.fromJson(Map<String, dynamic> json) {
    return MarketStore(
      id: json['id'] as String,
      name: json['name'] as String,
      address: json['address'] as String?,
      deliveryMode: (json['deliveryMode'] as String?) ?? 'platform',
      workingHoursStart: (json['workingHoursStart'] as String?) ?? '08:00',
      workingHoursEnd: (json['workingHoursEnd'] as String?) ?? '22:00',
      imageKey: json['imageKey'] as String?,
      activePromotion: PromotionBadge.tryParse(json['activePromotion']),
    );
  }

  @override
  List<Object?> get props =>
      [id, name, address, deliveryMode, workingHoursStart, workingHoursEnd, imageKey, activePromotion];
}
