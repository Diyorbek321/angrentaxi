import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:angren_taxi/core/config/app_config.dart';

class SocketService {
  io.Socket? _socket;

  // Demo mode: no real socket. Handlers are stored locally and invoked by the
  // DemoEngine via [simulateIncoming].
  final Map<String, void Function(dynamic)> _demoHandlers = {};
  bool _demoConnected = false;

  bool get isConnected =>
      AppConfig.demoMode ? _demoConnected : (_socket?.connected ?? false);

  void connect(String token) {
    if (AppConfig.demoMode) {
      _demoConnected = true;
      debugPrint('[Socket] demo mode — virtual connection');
      return;
    }
    if (isConnected) return;

    _socket = io.io(
      '${AppConfig.wsUrl}/ws',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setExtraHeaders({'authorization': 'Bearer $token'})
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(2000)
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('[Socket] Connected');
    });

    _socket!.onDisconnect((_) {
      debugPrint('[Socket] Disconnected');
    });

    _socket!.onConnectError((data) {
      debugPrint('[Socket] Connect error: $data');
    });

    _socket!.onError((data) {
      debugPrint('[Socket] Error: $data');
    });

    _socket!.connect();
  }

  void emit(String event, dynamic data) {
    if (AppConfig.demoMode) {
      // Client emits are no-ops in demo; lifecycle is driven by DemoEngine.
      return;
    }
    if (!isConnected) {
      debugPrint('[Socket] Cannot emit "$event" — not connected');
      return;
    }
    _socket?.emit(event, data);
  }

  void on(String event, void Function(dynamic) handler) {
    if (AppConfig.demoMode) {
      _demoHandlers[event] = handler;
      return;
    }
    _socket?.on(event, handler);
  }

  void off(String event) {
    if (AppConfig.demoMode) {
      _demoHandlers.remove(event);
      return;
    }
    _socket?.off(event);
  }

  /// Demo only: push a server-style event to the registered handler.
  void simulateIncoming(String event, dynamic data) {
    _demoHandlers[event]?.call(data);
  }

  void disconnect() {
    if (AppConfig.demoMode) {
      _demoConnected = false;
      _demoHandlers.clear();
      return;
    }
    _socket?.disconnect();
    _socket = null;
  }

  void dispose() {
    disconnect();
  }
}

// Socket event name constants
class SocketEvents {
  SocketEvents._();

  // Driver emits
  static const String driverLocation = 'driver:location';
  static const String driverOnline = 'driver:online';
  static const String driverOffline = 'driver:offline';

  // Order room membership (client emits) — matches realtime.gateway.ts's
  // 'join:order'/'leave:order' handlers, which join/leave the
  // `order:${orderId}` socket room that trip tracking and trip chat events
  // are broadcast to.
  static const String joinOrder = 'join:order';
  static const String leaveOrder = 'leave:order';

  // Trip chat (passenger<->driver, in the order room)
  static const String tripMessage = 'trip:message'; // server -> client

  // Driver receives
  static const String newOrderOffer = 'new_order_offer';
  static const String orderCancelled = 'order:cancelled';

  // Passenger receives
  static const String driverLocationUpdate = 'driver:location';
  static const String orderStatusUpdate = 'order:status';
  static const String driverAssigned = 'driver:assigned';
  static const String driverArrived = 'driver:arrived';
  static const String tripStarted = 'trip:started';
  static const String tripCompleted = 'trip:completed';

  // Market (passenger receives)
  static const String marketOrderStatus = 'market:order:status';

  // Food (passenger receives)
  static const String foodOrderStatus = 'food:order:status';

  // Support chat
  static const String supportMessageSend = 'support:message'; // client emit
  static const String supportMessageNew =
      'support:message:new'; // server -> client
  static const String supportThreadUpdated = 'support:thread:updated';
}
