import 'dart:async';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

/// Yangi socket yaratadi — testlarda soxta socket berish uchun.
typedef SocketFactory = io.Socket Function(
  String url,
  Map<dynamic, dynamic> options,
);

io.Socket _defaultSocketFactory(String url, Map<dynamic, dynamic> options) =>
    io.io(url, options);

class SocketService {
  SocketService({
    SocketFactory? socketFactory,
    Duration Function(int attempt)? kickRetryDelay,
    DateTime Function()? clock,
  })  : _socketFactory = socketFactory ?? _defaultSocketFactory,
        _kickRetryDelay = kickRetryDelay ?? _defaultKickRetryDelay,
        _clock = clock ?? DateTime.now;

  /// Server ketma-ket shuncha marta uzib qo'ysa (token yangilangandan keyin
  /// ham), qayta urinish to'xtaydi — masalan bloklangan akkaunt.
  static const int maxKickRetries = 5;

  /// Shundan uzoq ulanib turgan socket "barqaror" hisoblanadi va keyingi
  /// uzilish hisobni noldan boshlaydi.
  static const Duration _stableConnection = Duration(seconds: 30);

  static Duration _defaultKickRetryDelay(int attempt) =>
      Duration(seconds: (1 << attempt).clamp(1, 30));

  final SocketFactory _socketFactory;
  final Duration Function(int attempt) _kickRetryDelay;
  final DateTime Function() _clock;

  io.Socket? _socket;

  // Demo mode: no real socket. Handlers are stored locally and invoked by the
  // DemoEngine via [simulateIncoming].
  final Map<String, void Function(dynamic)> _demoHandlers = {};
  bool _demoConnected = false;

  /// Ilova ro'yxatdan o'tkazgan barcha tinglovchilar. Socket qayta
  /// yaratilganda (server uzib qo'ygandan keyin) ular yangi socketga qayta
  /// ulanadi; [connect] dan OLDIN berilgan tinglovchilar ham yo'qolmaydi.
  final Map<String, List<void Function(dynamic)>> _handlers = {};

  /// Qayta ulanganda chaqiriladi (birinchi ulanishda emas).
  ///
  /// NEGA KERAK: socket uzilib turgan paytda yuborilgan event'lar
  /// (`order:in_progress`, `order:completed`) server tomonda saqlanmaydi —
  /// ular shunchaki yo'qoladi. Telefon ekrani o'chganda yoki hotspot bir
  /// zum uzilganda shunday bo'ladi va yo'lovchi ekrani "Haydovchi keldi"
  /// holatida qotib qolardi. Tinglovchi holatni REST orqali qayta oladi.
  final List<VoidCallback> _reconnectListeners = [];
  bool _hasConnectedBefore = false;

  // Token manbalari (DI'da [configureAuth] orqali beriladi).
  String? Function()? _readToken;
  Future<bool> Function()? _refreshTokens;
  String? _initialToken;

  // Server uzib qo'ygandan keyin tiklash holati.
  bool _wantConnected = false;
  bool _recovering = false;
  int _kickCount = 0;
  DateTime? _connectedAt;

  /// [readToken] — har handshake'da eng so'nggi access token (REST token
  /// yangilasa socket ham uni oladi). [refreshTokens] — server socketni
  /// rad etganda (eskirgan token) sessiyani yangilaydi.
  void configureAuth({
    required String? Function() readToken,
    required Future<bool> Function() refreshTokens,
  }) {
    _readToken = readToken;
    _refreshTokens = refreshTokens;
  }

  void addReconnectListener(VoidCallback listener) {
    if (!_reconnectListeners.contains(listener)) {
      _reconnectListeners.add(listener);
    }
  }

  void removeReconnectListener(VoidCallback listener) =>
      _reconnectListeners.remove(listener);

  /// `true` — sessiya bor (socket kerak), lekin hozir ulanmagan.
  /// Ekrandagi "qayta ulanmoqda" belgisi shunga qaraydi
  /// (`shared/widgets/connection_banner.dart`).
  ValueListenable<bool> get offline => _offline;
  final ValueNotifier<bool> _offline = ValueNotifier(false);

  bool get isConnected =>
      AppConfig.demoMode ? _demoConnected : (_socket?.connected ?? false);

  void connect(String token) {
    if (AppConfig.demoMode) {
      _demoConnected = true;
      debugPrint('[Socket] demo mode — virtual connection');
      return;
    }
    _initialToken = token;
    _wantConnected = true;
    if (isConnected) return;
    _kickCount = 0;
    _openSocket();
  }

  String? _currentToken() => _readToken?.call() ?? _initialToken;

  void _openSocket() {
    _socket?.dispose();

    final options = io.OptionBuilder()
        .setTransports(['websocket'])
        .enableForceNew()
        .disableAutoConnect()
        .enableReconnection()
        // ⚠️ CHEKSIZ. Avval 5 urinish (~10 soniya) edi: ekran o'chib
        // tarmoq uxlab qolsa, socket butunlay "o'lardi" va ilova qayta
        // ishga tushirilmaguncha hech qanday event kelmasdi.
        .setReconnectionAttempts(double.infinity)
        .setReconnectionDelay(2000)
        .setReconnectionDelayMax(10000)
        .build();
    // Token har handshake'da (shu jumladan avtomatik qayta ulanishda) qayta
    // o'qiladi. Ilgari u bir marta qotirilardi: 7 kunlik access token
    // eskirgach server socketni uzar va ilova qayta ishga tushmaguncha
    // haydovchiga buyurtma kelmasdi.
    options['auth'] = (dynamic callback) {
      // ignore: avoid_dynamic_calls
      callback({'token': _currentToken()});
    };

    final socket = _socketFactory('${AppConfig.wsUrl}/ws', options);
    _socket = socket;

    socket.on('connect', (_) => _onConnected());
    socket.on('disconnect', _onDisconnected);
    socket.on('connect_error', (data) {
      debugPrint('[Socket] Connect error: $data');
      // Birinchi ulanish ham bo'lmadi — `disconnect` hodisasi kelmaydi.
      _offline.value = _wantConnected;
    });
    socket.on('error', (data) {
      debugPrint('[Socket] Error: $data');
    });
    for (final entry in _handlers.entries) {
      for (final handler in entry.value) {
        socket.on(entry.key, handler);
      }
    }

    socket.connect();
  }

  void _onConnected() {
    debugPrint('[Socket] Connected');
    _offline.value = false;
    _connectedAt = _clock();
    if (_hasConnectedBefore) {
      for (final listener in List.of(_reconnectListeners)) {
        listener();
      }
    }
    _hasConnectedBefore = true;
  }

  void _onDisconnected(dynamic reason) {
    debugPrint('[Socket] Disconnected: $reason');
    _offline.value = _wantConnected;
    final connectedAt = _connectedAt;
    _connectedAt = null;
    // Faqat server uzganda kutubxona socketni butunlay yo'q qiladi
    // (`ondisconnect` → `destroy`) va o'zi qayta ulanmaydi. Tarmoq
    // uzilishlarida (`transport close`, `ping timeout`) kutubxona o'zi
    // qayta ulanadi — bu yerda hech narsa qilinmaydi.
    if (reason != 'io server disconnect' || !_wantConnected) return;

    final wasStable = connectedAt != null &&
        _clock().difference(connectedAt) >= _stableConnection;
    if (wasStable) _kickCount = 0;
    unawaited(_recoverFromServerKick());
  }

  Future<void> _recoverFromServerKick() async {
    if (_recovering) return;
    if (_kickCount >= maxKickRetries) {
      debugPrint('[Socket] server rejected the socket $_kickCount times — '
          'giving up until next login');
      return;
    }
    _recovering = true;
    try {
      final attempt = _kickCount++;
      await Future<void>.delayed(_kickRetryDelay(attempt));
      if (!_wantConnected) return;

      final refresh = _refreshTokens;
      final refreshed = refresh == null ? false : await refresh();
      if (!refreshed || !_wantConnected) {
        debugPrint('[Socket] token refresh failed — socket stays offline');
        return;
      }
      _openSocket();
    } catch (e) {
      debugPrint('[Socket] recovery failed: $e');
    } finally {
      _recovering = false;
    }
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

  /// Bir xil [handler] ikki marta berilsa, u bir marta ulanadi.
  void on(String event, void Function(dynamic) handler) {
    if (AppConfig.demoMode) {
      _demoHandlers[event] = handler;
      return;
    }
    final list = _handlers.putIfAbsent(event, () => []);
    if (list.contains(handler)) return;
    list.add(handler);
    _socket?.on(event, handler);
  }

  /// [handler] berilsa faqat O'SHA tinglovchi o'chiriladi. Busiz event'ning
  /// BARCHA tinglovchilari ketadi — bitta event'ni ikki ekran tinglasa
  /// (masalan `driver:location`: taksi va kuryer kuzatuvi), biri yopilganda
  /// ikkinchisini o'chirib yubormaslik uchun [handler] ni bering.
  void off(String event, [void Function(dynamic)? handler]) {
    if (AppConfig.demoMode) {
      if (handler == null || identical(_demoHandlers[event], handler)) {
        _demoHandlers.remove(event);
      }
      return;
    }
    if (handler == null) {
      _handlers.remove(event);
      _socket?.off(event);
    } else {
      _handlers[event]?.remove(handler);
      _socket?.off(event, handler);
    }
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
    _wantConnected = false;
    _initialToken = null;
    _offline.value = false;
    _socket?.dispose();
    _socket = null;
    _hasConnectedBefore = false;
    _connectedAt = null;
    _kickCount = 0;
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

  // Hamyon balansi o'zgardi (to'ldirish, qaytarim, qo'lda tuzatish, ...) —
  // `{ balance, delta, reason, topupId?|auditLogId?|shiftPassId?|vendorOrderId? }`
  // (docs/LEGAL-COMPLIANCE.md §17).
  static const String walletUpdated = 'wallet:updated';

  // Passenger receives — these must match the literal strings orders.service.ts
  // emits via realtimeGateway.emitToUser(passengerId, ...). The backend emits
  // one distinct event per transition rather than a single generic
  // 'order:status' event, so each lifecycle step gets its own constant here.
  static const String driverLocationUpdate = 'driver:location';
  static const String orderAccepted = 'order:accepted';
  static const String orderArrived = 'order:arrived';
  static const String orderInProgress = 'order:in_progress';
  static const String orderCompleted = 'order:completed';
  // Emitted by matching.service.ts's handleNoDriversFound — a distinct event
  // from 'order:cancelled' (and the only notification sent) when the order
  // auto-cancels after the matching retry window finds nobody nearby.
  static const String noDriversFound = 'no_drivers_found';

  // Rejalashtirilgan safar.
  //
  // `orderScheduled` — buyurtma qabul qilindi, lekin qidiruv HALI
  // boshlanmadi (orders-creation.service.ts). ATAYLAB `order:created` dan
  // farq qiladi: `order:created` ilovani kuzatuv rejimiga o'tkazadi,
  // rejalashtirilgan buyurtmada esa kuzatiladigan hech narsa yo'q.
  //
  // `scheduledReleased` — cron rejani jonli buyurtmaga aylantirdi va
  // haydovchi qidiruvi boshlandi (scheduled-orders.service.ts). Narx
  // O'ZGARMAYDI: u buyurtma berilganda qotirilgan.
  static const String orderScheduled = 'order:scheduled';
  static const String scheduledReleased = 'order:scheduled_released';

  // Market (passenger receives)
  static const String marketOrderStatus = 'market:order:status';

  // Food (passenger receives)
  static const String foodOrderStatus = 'food:order:status';

  // Shaharlararo (backend 6-qadam): o'rindiqlar/holat o'zgardi yoki
  // haydovchi qatnovni bekor qildi. Payload: {tripId, status, seatsTaken,
  // seatsTotal, wholeCarBooked, departureAt} va {tripId, reason}.
  static const String intercityTripUpdated = 'intercity:trip:updated';
  static const String intercityTripCancelled = 'intercity:trip:cancelled';
  // Faqat haydovchiga: o'z qatnoviga yangi band / band bekor qilindi.
  static const String intercityBookingCreated = 'intercity:booking:created';
  static const String intercityBookingCancelled = 'intercity:booking:cancelled';
  // So'rovlar doskasi (10-qadam). Haydovchilarga: yangi so'rov / narx
  // oshirildi (payload — so'rov ko'rinishi) / yopildi ({requestId, status}).
  // Yo'lovchiga: haydovchi topildi yoki muddat tugadi ({requestId, status,
  // tripId?, orderId?}).
  static const String intercityRequestCreated = 'intercity:request:created';
  static const String intercityRequestUpdated = 'intercity:request:updated';
  static const String intercityRequestClosed = 'intercity:request:closed';
  static const String intercityRequestResolved = 'intercity:request:resolved';

  // Support chat
  static const String supportMessageSend = 'support:message'; // client emit
  static const String supportMessageNew =
      'support:message:new'; // server -> client
  static const String supportThreadUpdated = 'support:thread:updated';
}
