import 'package:equatable/equatable.dart';
import 'package:angren_taxi/shared/models/driver.dart';

enum OrderStatus {
  pending,
  searching,
  driverAssigned,
  driverEnRoute,
  driverArrived,
  inProgress,
  completed,
  cancelled,
}

extension OrderStatusExtension on OrderStatus {
  String get label {
    switch (this) {
      case OrderStatus.pending:
        return 'Kutilmoqda';
      case OrderStatus.searching:
        return 'Haydovchi izlanmoqda';
      case OrderStatus.driverAssigned:
        return 'Haydovchi tayinlandi';
      case OrderStatus.driverEnRoute:
        return 'Haydovchi kelmoqda';
      case OrderStatus.driverArrived:
        return 'Haydovchi yetib keldi';
      case OrderStatus.inProgress:
        return 'Sayohat davom etmoqda';
      case OrderStatus.completed:
        return 'Yakunlandi';
      case OrderStatus.cancelled:
        return 'Bekor qilindi';
    }
  }
}

OrderStatus orderStatusFromString(String status) {
  switch (status) {
    case 'pending':
      return OrderStatus.pending;
    case 'searching':
      return OrderStatus.searching;
    case 'driver_assigned':
      return OrderStatus.driverAssigned;
    case 'driver_en_route':
      return OrderStatus.driverEnRoute;
    case 'driver_arrived':
      return OrderStatus.driverArrived;
    case 'in_progress':
      return OrderStatus.inProgress;
    case 'completed':
      return OrderStatus.completed;
    case 'cancelled':
      return OrderStatus.cancelled;
    default:
      return OrderStatus.pending;
  }
}

class OrderLocation extends Equatable {
  const OrderLocation({
    required this.address,
    required this.lat,
    required this.lng,
  });

  final String address;
  final double lat;
  final double lng;

  factory OrderLocation.fromJson(Map<String, dynamic> json) {
    return OrderLocation(
      address: json['address'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
    'address': address,
    'lat': lat,
    'lng': lng,
  };

  @override
  List<Object?> get props => [address, lat, lng];
}

class Order extends Equatable {
  const Order({
    required this.id,
    required this.passengerId,
    required this.pickup,
    required this.dropoff,
    required this.status,
    required this.estimatedPrice,
    required this.createdAt,
    this.driver,
    this.actualPrice,
    this.tariffId,
    this.completedAt,
    this.cancelReason,
    this.distanceKm,
    this.durationMin,
  });

  final String id;
  final String passengerId;
  final OrderLocation pickup;
  final OrderLocation dropoff;
  final OrderStatus status;
  final double estimatedPrice;
  final DateTime createdAt;
  final Driver? driver;
  final double? actualPrice;
  final String? tariffId;
  final DateTime? completedAt;
  final String? cancelReason;
  final double? distanceKm;
  final int? durationMin;

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] as String,
      passengerId: json['passengerId'] as String,
      pickup: OrderLocation.fromJson(
        json['pickup'] as Map<String, dynamic>,
      ),
      dropoff: OrderLocation.fromJson(
        json['dropoff'] as Map<String, dynamic>,
      ),
      status: orderStatusFromString(json['status'] as String),
      estimatedPrice: (json['estimatedPrice'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      driver:
          json['driver'] != null
              ? Driver.fromJson(json['driver'] as Map<String, dynamic>)
              : null,
      actualPrice:
          json['actualPrice'] != null
              ? (json['actualPrice'] as num).toDouble()
              : null,
      tariffId: json['tariffId'] as String?,
      completedAt:
          json['completedAt'] != null
              ? DateTime.parse(json['completedAt'] as String)
              : null,
      cancelReason: json['cancelReason'] as String?,
      distanceKm:
          json['distanceKm'] != null
              ? (json['distanceKm'] as num).toDouble()
              : null,
      durationMin: json['durationMin'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'passengerId': passengerId,
    'pickup': pickup.toJson(),
    'dropoff': dropoff.toJson(),
    'status': status.name,
    'estimatedPrice': estimatedPrice,
    'createdAt': createdAt.toIso8601String(),
    'driver': driver?.toJson(),
    'actualPrice': actualPrice,
    'tariffId': tariffId,
    'completedAt': completedAt?.toIso8601String(),
    'cancelReason': cancelReason,
    'distanceKm': distanceKm,
    'durationMin': durationMin,
  };

  bool get isActive =>
      status == OrderStatus.searching ||
      status == OrderStatus.driverAssigned ||
      status == OrderStatus.driverEnRoute ||
      status == OrderStatus.driverArrived ||
      status == OrderStatus.inProgress;

  Order copyWith({
    String? id,
    String? passengerId,
    OrderLocation? pickup,
    OrderLocation? dropoff,
    OrderStatus? status,
    double? estimatedPrice,
    DateTime? createdAt,
    Driver? driver,
    double? actualPrice,
    String? tariffId,
    DateTime? completedAt,
    String? cancelReason,
    double? distanceKm,
    int? durationMin,
  }) {
    return Order(
      id: id ?? this.id,
      passengerId: passengerId ?? this.passengerId,
      pickup: pickup ?? this.pickup,
      dropoff: dropoff ?? this.dropoff,
      status: status ?? this.status,
      estimatedPrice: estimatedPrice ?? this.estimatedPrice,
      createdAt: createdAt ?? this.createdAt,
      driver: driver ?? this.driver,
      actualPrice: actualPrice ?? this.actualPrice,
      tariffId: tariffId ?? this.tariffId,
      completedAt: completedAt ?? this.completedAt,
      cancelReason: cancelReason ?? this.cancelReason,
      distanceKm: distanceKm ?? this.distanceKm,
      durationMin: durationMin ?? this.durationMin,
    );
  }

  @override
  List<Object?> get props => [
    id,
    passengerId,
    pickup,
    dropoff,
    status,
    estimatedPrice,
    createdAt,
    driver,
    actualPrice,
    tariffId,
    completedAt,
    cancelReason,
    distanceKm,
    durationMin,
  ];
}
