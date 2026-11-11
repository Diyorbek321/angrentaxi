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

  /// [driver] — haydovchi ekranlari band hodisalarini ham tinglaydi
  /// (server ularni faqat qatnov egasiga yuboradi).
  void subscribeIntercity([SocketService? socket, bool driver = false]) {
    _socket = socket ??
        (sl.isRegistered<SocketService>() ? sl<SocketService>() : null);
    for (final event in _events(driver)) {
      _socket?.on(event, _handle);
    }
    _driver = driver;
  }

  void unsubscribeIntercity() {
    for (final event in _events(_driver)) {
      _socket?.off(event, _handle);
    }
    _socket = null;
  }

  bool _driver = false;

  static List<String> _events(bool driver) => [
        SocketEvents.intercityTripUpdated,
        SocketEvents.intercityTripCancelled,
        if (driver) ...[
          SocketEvents.intercityBookingCreated,
          SocketEvents.intercityBookingCancelled,
        ],
      ];
}

/// So'rovlar doskasi hodisalari. Haydovchi: yangi / narx oshirildi / yopildi;
/// yo'lovchi: haydovchi topildi yoki muddat tugadi. Socket yo'q bo'lsa jim.
mixin IntercityRequestRealtime<T extends StatefulWidget> on State<T> {
  SocketService? _requestSocket;
  bool _requestDriver = false;

  /// [requestId] — payload'dagi `requestId` yoki `id`; `null` — tanilmadi.
  void onRequestEvent(String? requestId);

  void _handleRequest(dynamic payload) {
    if (!mounted) return;
    final id = payload is Map ? (payload['requestId'] ?? payload['id'])?.toString() : null;
    onRequestEvent(id);
  }

  void subscribeRequests({SocketService? socket, bool driver = false}) {
    _requestSocket = socket ?? (sl.isRegistered<SocketService>() ? sl<SocketService>() : null);
    _requestDriver = driver;
    for (final event in _requestEvents(driver)) {
      _requestSocket?.on(event, _handleRequest);
    }
  }

  void unsubscribeRequests() {
    for (final event in _requestEvents(_requestDriver)) {
      _requestSocket?.off(event, _handleRequest);
    }
    _requestSocket = null;
  }

  static List<String> _requestEvents(bool driver) => driver
      ? const [
          SocketEvents.intercityRequestCreated,
          SocketEvents.intercityRequestUpdated,
          SocketEvents.intercityRequestClosed,
        ]
      : const [SocketEvents.intercityRequestResolved];
}
