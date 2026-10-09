import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/courier_tracking.dart';
import 'package:angren_taxi/shared/models/order.dart' show OrderStatus;
import 'package:equatable/equatable.dart';

enum MarketOrderStatus { newOrder, packing, shipped, delivered, cancelled }

extension MarketOrderStatusExtension on MarketOrderStatus {
  String get label {
    switch (this) {
      case MarketOrderStatus.newOrder:
        return AppL10n.current.shDeliveryAccepted;
      case MarketOrderStatus.packing:
        return AppL10n.current.shMarketPacking;
      case MarketOrderStatus.shipped:
        return AppL10n.current.shDeliveryOnTheWay;
      case MarketOrderStatus.delivered:
        return AppL10n.current.shDeliveryDelivered;
      case MarketOrderStatus.cancelled:
        return AppL10n.current.shStatusCancelled;
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
    this.delivery,
  });

  final String id;
  final String storeId;
  final MarketOrderStatus status;
  final List<MarketOrderItem> items;
  final String deliveryAddress;
  final double totalPrice;
  final DateTime createdAt;

  /// Kuryer safari — do'kon/restoran kuryer chaqirgandan keyin paydo
  /// bo'ladi. `null` — hali chaqirilmagan.
  final CourierTracking? delivery;

  /// Mijoz kuryerni xaritada kuzata oladimi: buyurtma hali yo'lda va unga
  /// kuryer safari bog'langan (bekor qilingan safar — qayta qidirilmoqda,
  /// kuzatadigan mashina yo'q).
  bool get isTrackable =>
      status.isActive &&
      delivery != null &&
      delivery!.status != OrderStatus.cancelled;

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
      delivery: CourierTracking.tryParse(json['delivery']),
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
      delivery: delivery,
    );
  }

  @override
  List<Object?> get props => [id, storeId, status, items, deliveryAddress, totalPrice, createdAt, delivery];
}
