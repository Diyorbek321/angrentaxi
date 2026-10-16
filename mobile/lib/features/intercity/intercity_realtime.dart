import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:flutter/widgets.dart';

/// Qatnov o'zgarsa (joylar, holat, bekor qilish) ekranni yangilash.
///
/// Socket ulanmagan yoki ro'yxatdan o'tmagan bo'lsa (testlar, eski server)
/// hech narsa qilmaydi — ekranlarda pull-to-refresh baribir bor.
/// [onTripEvent] ga `tripId` beriladi; `null` — payload tanilmadi.
mixin IntercityRealtimeRefresh<T extends StatefulWidget> on State<T> {
  SocketService? _socket;

  void onTripEvent(String? tripId);

  void _handle(dynamic payload) {
    if (!mounted) return;
    final tripId = payload is Map ? payload['tripId']?.toString() : null;
    onTripEvent(tripId);
  }

  void subscribeIntercity([SocketService? socket]) {
    _socket = socket ??
        (sl.isRegistered<SocketService>() ? sl<SocketService>() : null);
    _socket?.on(SocketEvents.intercityTripUpdated, _handle);
    _socket?.on(SocketEvents.intercityTripCancelled, _handle);
  }

  void unsubscribeIntercity() {
    _socket?.off(SocketEvents.intercityTripUpdated, _handle);
    _socket?.off(SocketEvents.intercityTripCancelled, _handle);
    _socket = null;
  }
}
