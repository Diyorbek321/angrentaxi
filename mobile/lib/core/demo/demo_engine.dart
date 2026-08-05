import 'dart:async';

import 'package:angren_taxi/core/demo/demo_data.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:flutter/foundation.dart';

/// Drives offline demo mode: answers REST calls with canned data and scripts
/// the realtime trip lifecycle by pushing socket events to the (demo)
/// [SocketService]. No network is used; the APK runs fully standalone.
class DemoEngine {
  DemoEngine._();
  static final DemoEngine instance = DemoEngine._();

  final List<Timer> _timers = [];
  String _phone = '+998900000000';
  Map<String, dynamic>? _passengerOrder;
  Map<String, dynamic>? _driverOrder;
  int _orderSeq = 0;

  SocketService get _socket => sl<SocketService>();

  /// Routes a REST call to canned data. Returns the full response body the app
  /// expects (`{ "data": ... }`). Side effects (timelines) are started here.
  Map<String, dynamic> handle(String method, String path, dynamic data) {
    final body = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    debugPrint('[Demo] $method $path');

    // ---- Auth ----
    if (path.endsWith('/auth/send-otp')) {
      _phone = (body['phone'] as String?) ?? _phone;
      return _ok({'message': 'OTP yuborildi', 'code': '123456'});
    }
    if (path.endsWith('/auth/verify-otp')) {
      _phone = (body['phone'] as String?) ?? _phone;
      final isDriver = path.contains('driver'); // never true; role inferred below
      return _ok({
        'accessToken': 'demo-token',
        'refreshToken': 'demo-refresh',
        'user': isDriver ? DemoData.driverUser(_phone) : DemoData.passengerUser(_phone),
      });
    }
    if (path.endsWith('/auth/logout')) {
      _reset();
      return _ok({});
    }

    // ---- User ----
    if (path.endsWith('/users/profile') && method == 'GET') {
      return _ok(DemoData.passengerUser(_phone));
    }
    if (path.endsWith('/users/profile')) {
      return _ok(DemoData.passengerUser(_phone));
    }

    // ---- Tariffs ----
    if (path.endsWith('/tariffs')) {
      return _okList(DemoData.tariffs());
    }

    // ---- Passenger orders ----
    if (path.endsWith('/orders/estimate')) {
      const distanceKm = 4.2;
      final baseFare = (body['baseFare'] as num?)?.toDouble() ?? 8000;
      final perKm = (body['perKmRate'] as num?)?.toDouble() ?? 2500;
      final price = (baseFare + perKm * distanceKm).clamp(8000, 200000);
      return _ok({'estimatedPrice': price, 'distanceKm': distanceKm, 'durationMin': 14});
    }
    if (path.endsWith('/orders') && method == 'POST') {
      final order = _buildPassengerOrder(body);
      _passengerOrder = order;
      _startPassengerTrip();
      return _ok(order);
    }
    if (path.contains('/orders/') && path.endsWith('/cancel')) {
      _cancelTimers();
      _passengerOrder = null;
      return _ok({'cancelled': true});
    }
    if (path.endsWith('/orders/history')) {
      // ?status=active → none active at start (clean home screen)
      return _okList(DemoData.orderHistory());
    }

    // ---- Ratings / promo ----
    if (path.endsWith('/ratings')) {
      return _ok({'submitted': true});
    }
    if (path.endsWith('/promo-codes/validate')) {
      final code = (body['code'] as String?)?.toUpperCase() ?? '';
      final valid = code == 'ANGREN' || code == 'DEMO';
      return _ok({
        'valid': valid,
        'discount': valid ? 3000 : 0,
        'discountType': 'fixed',
        'message': valid ? 'Promokod qabul qilindi' : 'Promokod topilmadi',
      });
    }

    // ---- Driver ----
    if (path.endsWith('/drivers/profile')) {
      return _ok(DemoData.driver());
    }
    if (path.endsWith('/drivers/online')) {
      _startDriverOffer();
      return _ok({'online': true});
    }
    if (path.endsWith('/drivers/offline')) {
      _cancelTimers();
      return _ok({'online': false});
    }
    if (path.endsWith('/drivers/active-order')) {
      return {'data': _driverOrder};
    }
    if (path.endsWith('/drivers/earnings')) {
      return _ok({'today': 184000, 'week': 1240000, 'trips': 12});
    }
    if (path.endsWith('/drivers/orders/history')) {
      return _okList(DemoData.orderHistory());
    }
    if (path.contains('/drivers/orders/') && path.endsWith('/accept')) {
      _driverOrder = _updateDriverStatus('driver_assigned');
      return _ok(_driverOrder!);
    }
    if (path.contains('/drivers/orders/') && path.endsWith('/decline')) {
      return _ok({'declined': true});
    }
    if (path.contains('/drivers/orders/') && path.endsWith('/arrived')) {
      _driverOrder = _updateDriverStatus('driver_arrived');
      return _ok(_driverOrder!);
    }
    if (path.contains('/drivers/orders/') && path.endsWith('/start')) {
      _driverOrder = _updateDriverStatus('in_progress');
      return _ok(_driverOrder!);
    }
    if (path.contains('/drivers/orders/') && path.endsWith('/complete')) {
      final completed = _updateDriverStatus('completed');
      completed['actualPrice'] = completed['estimatedPrice'];
      _driverOrder = null;
      return _ok(completed);
    }
    if (path.contains('/drivers/orders/') && path.endsWith('/location')) {
      return _ok({});
    }

    // ---- Notifications ----
    if (path.endsWith('/notifications/register-token')) {
      return _ok({'registered': true});
    }

    // Fallback: empty success
    return _ok({});
  }

  // ---------- Passenger trip simulation ----------

  Map<String, dynamic> _buildPassengerOrder(Map<String, dynamic> body) {
    _orderSeq++;
    final pickup = body['pickup'] as Map?;
    final dropoff = body['dropoff'] as Map?;
    return {
      'id': 'demo-order-$_orderSeq',
      'passengerId': DemoData.passengerUserId,
      'pickup': {
        'address': pickup?['address'] ?? DemoData.pickupAddress,
        'lat': (pickup?['lat'] as num?)?.toDouble() ?? DemoData.pickupLat,
        'lng': (pickup?['lng'] as num?)?.toDouble() ?? DemoData.pickupLng,
      },
      'dropoff': {
        'address': dropoff?['address'] ?? DemoData.dropoffAddress,
        'lat': (dropoff?['lat'] as num?)?.toDouble() ?? DemoData.dropoffLat,
        'lng': (dropoff?['lng'] as num?)?.toDouble() ?? DemoData.dropoffLng,
      },
      'status': 'searching',
      'estimatedPrice': (body['estimatedPrice'] as num?)?.toDouble() ?? 18500,
      'createdAt': DateTime.now().toIso8601String(),
      'driver': null,
      'tariffId': body['tariffId'],
    };
  }

  void _startPassengerTrip() {
    final order = _passengerOrder;
    if (order == null) return;
    final pickup = order['pickup'] as Map<String, dynamic>;
    final dropoff = order['dropoff'] as Map<String, dynamic>;
    final pLat = pickup['lat'] as double;
    final pLng = pickup['lng'] as double;
    final dLat = dropoff['lat'] as double;
    final dLng = dropoff['lng'] as double;

    // Driver found + assigned.
    _schedule(2500, () {
      _socket.simulateIncoming(SocketEvents.orderAccepted, {'driver': DemoData.driver()});
    });

    // Driver drives toward the pickup point.
    _animate(
      fromLat: DemoData.driverStartLat,
      fromLng: DemoData.driverStartLng,
      toLat: pLat,
      toLng: pLng,
      startMs: 3000,
      steps: 8,
      stepMs: 700,
    );

    // Arrived at pickup.
    _schedule(9200, () {
      _socket.simulateIncoming(SocketEvents.orderArrived, {'message': 'Your driver has arrived'});
    });

    // Trip starts, drive to destination.
    _schedule(12000, () {
      _socket.simulateIncoming(SocketEvents.orderInProgress, {'message': 'Trip started'});
    });
    _animate(
      fromLat: pLat,
      fromLng: pLng,
      toLat: dLat,
      toLng: dLng,
      startMs: 12500,
      steps: 9,
      stepMs: 700,
    );

    // Completed → triggers rating screen.
    _schedule(19500, () {
      _socket.simulateIncoming(SocketEvents.orderCompleted, {
        'finalPrice': order['estimatedPrice'],
        'actualDistanceKm': 6.4,
        'actualDurationMin': 17,
      });
    });
  }

  void _animate({
    required double fromLat,
    required double fromLng,
    required double toLat,
    required double toLng,
    required int startMs,
    required int steps,
    required int stepMs,
  }) {
    for (var i = 1; i <= steps; i++) {
      final t = i / steps;
      final lat = fromLat + (toLat - fromLat) * t;
      final lng = fromLng + (toLng - fromLng) * t;
      _schedule(startMs + i * stepMs, () {
        _socket.simulateIncoming(SocketEvents.driverLocationUpdate, {'lat': lat, 'lng': lng});
      });
    }
  }

  // ---------- Driver-side simulation ----------

  void _startDriverOffer() {
    _schedule(3000, () {
      _orderSeq++;
      _driverOrder = {
        'id': 'demo-doffer-$_orderSeq',
        'passengerId': DemoData.passengerUserId,
        'pickup': {
          'address': DemoData.pickupAddress,
          'lat': DemoData.pickupLat,
          'lng': DemoData.pickupLng,
        },
        'dropoff': {
          'address': DemoData.dropoffAddress,
          'lat': DemoData.dropoffLat,
          'lng': DemoData.dropoffLng,
        },
        'status': 'searching',
        'estimatedPrice': 18500,
        'createdAt': DateTime.now().toIso8601String(),
        'driver': null,
        'tariffId': 'tariff-komfort',
        'distanceKm': 4.2,
        'durationMin': 14,
      };
      _socket.simulateIncoming(SocketEvents.newOrderOffer, _driverOrder);
    });
  }

  Map<String, dynamic> _updateDriverStatus(String status) {
    final order = Map<String, dynamic>.from(_driverOrder ?? {});
    order['status'] = status;
    order['driver'] = DemoData.driver();
    return order;
  }

  // ---------- helpers ----------

  Map<String, dynamic> _ok(Map<String, dynamic> data) => {'success': true, 'data': data};
  Map<String, dynamic> _okList(List<Map<String, dynamic>> data) =>
      {'success': true, 'data': data};

  void _schedule(int ms, void Function() action) {
    _timers.add(Timer(Duration(milliseconds: ms), action));
  }

  void _cancelTimers() {
    for (final t in _timers) {
      t.cancel();
    }
    _timers.clear();
  }

  void _reset() {
    _cancelTimers();
    _passengerOrder = null;
    _driverOrder = null;
  }
}
