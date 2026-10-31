import 'package:angren_taxi/shared/models/order.dart';
import 'package:equatable/equatable.dart';
import 'package:latlong2/latlong.dart';

/// Ovqat/market buyurtmasini olib kelayotgan kuryer safari — mijoz
/// ko'radigan qismi (backend: `delivery/delivery-tracking.ts`).
///
/// [orderId] — kuryer SAFARINING id'si. Mijoz `order:<orderId>` xonasiga
/// kiradi va kuryerning `driver:location` paketlarini oladi: safar mijoz
/// nomida yaratilgani uchun server uni xonaga kiritadi.
class CourierTracking extends Equatable {
  const CourierTracking({
    required this.orderId,
    required this.status,
    this.driverName,
    this.driverPhone,
    this.carModel,
    this.carNumber,
    this.pickup,
    this.dropoff,
  });

  final String orderId;
  final OrderStatus status;
  final String? driverName;
  final String? driverPhone;
  final String? carModel;
  final String? carNumber;

  /// Restoran yoki do'kon. `null` — server koordinata yubormadi.
  final LatLng? pickup;

  /// Mijozning manzili.
  final LatLng? dropoff;

  bool get hasCourier => driverName != null || driverPhone != null;

  /// "Cobalt · 01 A 777 BB" — bo'sh qismlar tashlab yuboriladi.
  String get carLabel => [carModel, carNumber]
      .whereType<String>()
      .where((s) => s.isNotEmpty)
      .join(' · ');

  /// Buzuq maydon butun buyurtmani yiqitmasligi uchun har biri zaxira
  /// bilan o'qiladi; `orderId` siz esa kuzatadigan narsa yo'q.
  static CourierTracking? tryParse(dynamic json) {
    if (json is! Map) return null;
    final orderId = json['orderId'];
    if (orderId is! String || orderId.isEmpty) return null;
    return CourierTracking.fromJson(Map<String, dynamic>.from(json));
  }

  factory CourierTracking.fromJson(Map<String, dynamic> json) {
    return CourierTracking(
      orderId: json['orderId'] as String,
      status: orderStatusFromString((json['status'] as String?) ?? ''),
      driverName: json['driverName'] as String?,
      driverPhone: json['driverPhone'] as String?,
      carModel: json['carModel'] as String?,
      carNumber: json['carNumber'] as String?,
      pickup: _point(json['pickup']),
      dropoff: _point(json['dropoff']),
    );
  }

  static LatLng? _point(dynamic value) {
    if (value is! Map) return null;
    final lat = value['lat'];
    final lng = value['lng'];
    if (lat is! num || lng is! num) return null;
    return LatLng(lat.toDouble(), lng.toDouble());
  }

  @override
  List<Object?> get props =>
      [orderId, status, driverName, driverPhone, carModel, carNumber, pickup, dropoff];
}
