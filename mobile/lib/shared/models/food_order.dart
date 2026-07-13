import 'package:equatable/equatable.dart';

enum FoodOrderStatus { newOrder, preparing, ready, delivered, cancelled }

extension FoodOrderStatusExtension on FoodOrderStatus {
  String get label {
    switch (this) {
      case FoodOrderStatus.newOrder:
        return 'Qabul qilindi';
      case FoodOrderStatus.preparing:
        return 'Tayyorlanmoqda';
      case FoodOrderStatus.ready:
        return "Yo'lda";
      case FoodOrderStatus.delivered:
        return 'Yetkazildi';
      case FoodOrderStatus.cancelled:
        return 'Bekor qilindi';
    }
  }

  bool get isActive =>
      this == FoodOrderStatus.newOrder || this == FoodOrderStatus.preparing || this == FoodOrderStatus.ready;
}

// Backend's FoodOrder.status wire values (food-order.entity.ts):
// new/preparing/ready/delivered/cancelled.
FoodOrderStatus foodOrderStatusFromString(String status) {
  switch (status) {
    case 'new':
      return FoodOrderStatus.newOrder;
    case 'preparing':
      return FoodOrderStatus.preparing;
    case 'ready':
      return FoodOrderStatus.ready;
    case 'delivered':
      return FoodOrderStatus.delivered;
    case 'cancelled':
      return FoodOrderStatus.cancelled;
    default:
      return FoodOrderStatus.newOrder;
  }
}

class FoodOrderItem extends Equatable {
  const FoodOrderItem({
    required this.dishId,
    required this.name,
    required this.qty,
    required this.price,
  });

  final String dishId;
  final String name;
  final int qty;
  final double price;

  factory FoodOrderItem.fromJson(Map<String, dynamic> json) {
    return FoodOrderItem(
      dishId: json['dishId'] as String,
      name: json['name'] as String,
      qty: (json['qty'] as num).toInt(),
      price: (json['price'] as num).toDouble(),
    );
  }

  @override
  List<Object?> get props => [dishId, name, qty, price];
}

class FoodOrder extends Equatable {
  const FoodOrder({
    required this.id,
    required this.restaurantId,
    required this.status,
    required this.items,
    required this.deliveryAddress,
    required this.totalPrice,
    required this.createdAt,
  });

  final String id;
  final String restaurantId;
  final FoodOrderStatus status;
  final List<FoodOrderItem> items;
  final String deliveryAddress;
  final double totalPrice;
  final DateTime createdAt;

  int get itemsCount => items.fold(0, (sum, i) => sum + i.qty);

  factory FoodOrder.fromJson(Map<String, dynamic> json) {
    return FoodOrder(
      id: json['id'] as String,
      restaurantId: json['restaurantId'] as String,
      status: foodOrderStatusFromString(json['status'] as String),
      items: ((json['items'] as List<dynamic>?) ?? [])
          .map((e) => FoodOrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      deliveryAddress: (json['deliveryAddress'] as String?) ?? '',
      totalPrice: (json['totalPrice'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  FoodOrder copyWith({FoodOrderStatus? status}) {
    return FoodOrder(
      id: id,
      restaurantId: restaurantId,
      status: status ?? this.status,
      items: items,
      deliveryAddress: deliveryAddress,
      totalPrice: totalPrice,
      createdAt: createdAt,
    );
  }

  @override
  List<Object?> get props => [id, restaurantId, status, items, deliveryAddress, totalPrice, createdAt];
}
