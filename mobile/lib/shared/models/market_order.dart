import 'package:equatable/equatable.dart';

enum MarketOrderStatus { newOrder, packing, shipped, delivered, cancelled }

extension MarketOrderStatusExtension on MarketOrderStatus {
  String get label {
    switch (this) {
      case MarketOrderStatus.newOrder:
        return 'Qabul qilindi';
      case MarketOrderStatus.packing:
        return "Do'kon yig'moqda";
      case MarketOrderStatus.shipped:
        return 'Yo\'lda';
      case MarketOrderStatus.delivered:
        return 'Yetkazildi';
      case MarketOrderStatus.cancelled:
        return 'Bekor qilindi';
    }
  }

  bool get isActive =>
      this == MarketOrderStatus.newOrder ||
      this == MarketOrderStatus.packing ||
      this == MarketOrderStatus.shipped;
}

// Backend's MarketOrder.status wire values (market-order.entity.ts):
// new/packing/shipped/delivered/cancelled.
MarketOrderStatus marketOrderStatusFromString(String status) {
  switch (status) {
    case 'new':
      return MarketOrderStatus.newOrder;
    case 'packing':
      return MarketOrderStatus.packing;
    case 'shipped':
      return MarketOrderStatus.shipped;
    case 'delivered':
      return MarketOrderStatus.delivered;
    case 'cancelled':
      return MarketOrderStatus.cancelled;
    default:
      return MarketOrderStatus.newOrder;
  }
}

class MarketOrderItem extends Equatable {
  const MarketOrderItem({
    required this.productId,
    required this.name,
    required this.qty,
    required this.price,
    required this.packed,
  });

  final String productId;
  final String name;
  final int qty;
  final double price;
  final bool packed;

  factory MarketOrderItem.fromJson(Map<String, dynamic> json) {
    return MarketOrderItem(
      productId: json['productId'] as String,
      name: json['name'] as String,
      qty: (json['qty'] as num).toInt(),
      price: (json['price'] as num).toDouble(),
      packed: (json['packed'] as bool?) ?? false,
    );
  }

  @override
  List<Object?> get props => [productId, name, qty, price, packed];
}

class MarketOrder extends Equatable {
  const MarketOrder({
    required this.id,
    required this.storeId,
    required this.status,
    required this.items,
    required this.deliveryAddress,
    required this.totalPrice,
    required this.createdAt,
  });

  final String id;
  final String storeId;
  final MarketOrderStatus status;
  final List<MarketOrderItem> items;
  final String deliveryAddress;
  final double totalPrice;
  final DateTime createdAt;

  int get itemsCount => items.fold(0, (sum, i) => sum + i.qty);

  factory MarketOrder.fromJson(Map<String, dynamic> json) {
    return MarketOrder(
      id: json['id'] as String,
      storeId: json['storeId'] as String,
      status: marketOrderStatusFromString(json['status'] as String),
      items: ((json['items'] as List<dynamic>?) ?? [])
          .map((e) => MarketOrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      deliveryAddress: (json['deliveryAddress'] as String?) ?? '',
      totalPrice: (json['totalPrice'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  MarketOrder copyWith({MarketOrderStatus? status}) {
    return MarketOrder(
      id: id,
      storeId: storeId,
      status: status ?? this.status,
      items: items,
      deliveryAddress: deliveryAddress,
      totalPrice: totalPrice,
      createdAt: createdAt,
    );
  }

  @override
  List<Object?> get props => [id, storeId, status, items, deliveryAddress, totalPrice, createdAt];
}
