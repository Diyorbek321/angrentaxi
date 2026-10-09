import 'dart:async';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/shared/models/courier_tracking.dart';
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

/// Ovqat/market buyurtmasining kuryerini jonli kuzatish.
///
/// Ikki manba:
///   * SOCKET — kuryer safari xonasidagi `driver:location` paketlari.
///     Xarita markeri [courierLocation] orqali yangilanadi (butun ekran
///     qayta qurilmaydi — taksi kuzatuvidagidek).
///   * REST — [refreshPath] (`/food/orders/:id` yoki `/market/orders/:id`)
///     davriy so'raladi: kuryer tayinlandi, mashina ma'lumoti, buyurtma
///     yetkazildi. Bular uchun alohida socket event'lari bor, lekin
///     ekran o'chib turganda ular yo'qoladi — davriy tekshiruv ishonchliroq.
class CourierTrackingController extends ChangeNotifier {
  CourierTrackingController({
    required ApiClient apiClient,
    required SocketService socketService,
    required this.refreshPath,
    required CourierTracking initial,
    this.refreshInterval = const Duration(seconds: 10),
  })  : _apiClient = apiClient,
        _socketService = socketService,
        _tracking = initial;

  final ApiClient _apiClient;
  final SocketService _socketService;

  /// Mijozning ovqat/market buyurtmasi manzili — u `delivery` ni qaytaradi.
  final String refreshPath;

  /// `null` — davriy tekshiruv yo'q (testlar uchun).
  final Duration? refreshInterval;

  CourierTracking _tracking;
  CourierTracking get tracking => _tracking;

  /// Ovqat/market buyurtmasining server holati (`delivered`, `cancelled`, ...).
  String? _orderStatus;

  /// Buyurtma yetkazildi yoki bekor qilindi — kuzatadigan narsa qolmadi.
  bool get isFinished => isDelivered || isCancelled;
  bool get isDelivered => _orderStatus == 'delivered';
  bool get isCancelled => _orderStatus == 'cancelled';

  /// Kuryerning oxirgi ma'lum joyi. `null` — hali birorta paket kelmadi.
  final ValueNotifier<LatLng?> courierLocation = ValueNotifier<LatLng?>(null);

  Timer? _timer;
  bool _started = false;
  bool _disposed = false;

  void start() {
    if (_started) return;
    _started = true;
    _socketService.on(SocketEvents.driverLocationUpdate, _onLocation);
    _socketService.addReconnectListener(_onReconnect);
    _join(_tracking.orderId);
    final interval = refreshInterval;
    if (interval != null) {
      _timer = Timer.periodic(interval, (_) => refresh());
    }
  }

  void _join(String rideId) =>
      _socketService.emit(SocketEvents.joinOrder, {'orderId': rideId});

  void _leave(String rideId) =>
      _socketService.emit(SocketEvents.leaveOrder, {'orderId': rideId});

  /// Qayta ulanishda server xona a'zoligini unutadi.
  void _onReconnect() {
    _join(_tracking.orderId);
    refresh();
  }

  void _onLocation(dynamic data) {
    if (data is! Map) return;
    // Faqat SHU kuryer safarining paketi: yo'lovchi bir vaqtda taksi ham
    // kutayotgan bo'lishi mumkin va u ham shu event nomida keladi.
    if (data['orderId'] != _tracking.orderId) return;
    final lat = data['lat'];
    final lng = data['lng'];
    if (lat is! num || lng is! num) return;
    courierLocation.value = LatLng(lat.toDouble(), lng.toDouble());
  }

  Future<void> refresh() async {
    try {
      final response = await _apiClient.get(refreshPath);
      if (_disposed) return;
      final body = response.data;
      final data = body is Map ? body['data'] : null;
      if (data is! Map) return;

      final status = data['status'];
      if (status is String) _orderStatus = status;

      final next = CourierTracking.tryParse(data['delivery']);
      if (next != null && next.orderId != _tracking.orderId) {
        // Restoran/do'kon qayta kuryer chaqirdi — yangi safar xonasiga
        // o'tamiz va eski kuryerning mashinasini xaritadan olib tashlaymiz.
        _leave(_tracking.orderId);
        _join(next.orderId);
        courierLocation.value = null;
      }
      if (next != null) _tracking = next;
      notifyListeners();
    } catch (e) {
      // Tarmoq xatosi kuzatuvni to'xtatmaydi — keyingi tikda qayta urinadi,
      // socket paketlari esa baribir kelaveradi.
      debugPrint('[CourierTracking] refresh error: $e');
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    _socketService.removeReconnectListener(_onReconnect);
    _socketService.off(SocketEvents.driverLocationUpdate, _onLocation);
    if (_started) _leave(_tracking.orderId);
    courierLocation.dispose();
    super.dispose();
  }
}
