// Haydovchi socketi: tinglovchilar har safardan keyin ko'payib ketmasligi
// va uzilishdan keyin FAOL safar holati serverdan qayta olinishi.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class _MockApiClient extends Mock implements ApiClient {}

class _FakeSocket extends Fake implements io.Socket {
  final Map<String, List<dynamic Function(dynamic)>> handlers = {};

  @override
  bool connected = false;

  @override
  void on(String event, dynamic Function(dynamic) handler) =>
      handlers.putIfAbsent(event, () => []).add(handler);

  @override
  void off(String event, [dynamic Function(dynamic)? handler]) {
    if (handler == null) {
      handlers.remove(event);
    } else {
      handlers[event]?.remove(handler);
    }
  }

  @override
  io.Socket connect() => this;

  @override
  void dispose() {}

  void fire(String event, [dynamic data]) {
    for (final h
        in handlers[event]?.toList() ?? const <dynamic Function(dynamic)>[]) {
      h(data);
    }
  }
}

Map<String, dynamic> _orderJson(String id, String status) => {
      'id': id,
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Bobur 10', 'lat': 41.0167, 'lng': 70.1436},
      'dropoff': {'address': 'Markaz', 'lat': 41.02, 'lng': 70.15},
      'status': status,
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-27T10:00:00.000Z',
    };

Response<dynamic> _ok(String path, Object? data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

void main() {
  late _MockApiClient api;
  late _FakeSocket socket;
  late SocketService socketService;
  late DriverProvider driver;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    api = _MockApiClient();
    socket = _FakeSocket();
    socketService = SocketService(socketFactory: (_, __) => socket)
      ..connect('token');
    driver = DriverProvider(
      apiClient: api,
      socketService: socketService,
      locationService: LocationService(),
      localStorage: LocalStorage(prefs),
    );
  });

  group('initialize qayta chaqirilganda', () {
    setUp(() {
      when(() => api.get(any())).thenThrow(
        DioException(requestOptions: RequestOptions(path: '/x')),
      );
    });

    test('socket tinglovchilari bir martadan qoladi', () async {
      await driver.initialize();
      await driver.initialize();
      await driver.initialize();

      expect(socket.handlers[SocketEvents.newOrderOffer], hasLength(1));
      expect(socket.handlers[SocketEvents.walletUpdated], hasLength(1));
      expect(socket.handlers[SocketEvents.orderCancelled], hasLength(1));
    });

    test('yangi taklif bitta event uchun bir marta ishlanadi', () async {
      await driver.initialize();
      await driver.initialize();
      var notifications = 0;
      driver.addListener(() => notifications++);

      socket.fire(SocketEvents.newOrderOffer, _orderJson('o-1', 'searching'));

      expect(driver.pendingOffer?.id, 'o-1');
      expect(notifications, 1);
    });
  });

  group('resyncActiveTrip', () {
    test("yo'lovchi uzilish paytida bekor qilgan safar yopiladi", () async {
      driver.debugSetActiveOrderForTest(
        Order.fromJson(_orderJson('trip-1', 'in_progress')),
      );
      when(() => api.get(ApiEndpoints.orderById('trip-1'))).thenAnswer(
        (_) async => _ok(
          ApiEndpoints.orderById('trip-1'),
          _orderJson('trip-1', 'cancelled'),
        ),
      );

      await driver.resyncActiveTrip();

      expect(driver.activeOrder?.status, OrderStatus.cancelled);
    });

    test("faol safar yo'q — so'rov yuborilmaydi", () async {
      await driver.resyncActiveTrip();
      verifyNever(() => api.get(any()));
    });

    test("so'rov xato bersa — safar o'zgarmaydi", () async {
      driver.debugSetActiveOrderForTest(
        Order.fromJson(_orderJson('trip-1', 'arrived')),
      );
      when(() => api.get(ApiEndpoints.orderById('trip-1'))).thenThrow(
        DioException(requestOptions: RequestOptions(path: '/orders/trip-1')),
      );

      await driver.resyncActiveTrip();

      expect(driver.activeOrder?.status, OrderStatus.driverArrived);
    });

    test('socket qayta ulanganda safar holati tiklanadi', () async {
      when(() => api.get(any())).thenThrow(
        DioException(requestOptions: RequestOptions(path: '/x')),
      );
      await driver.initialize();
      driver.debugSetActiveOrderForTest(
        Order.fromJson(_orderJson('trip-1', 'in_progress')),
      );
      when(() => api.get(ApiEndpoints.orderById('trip-1'))).thenAnswer(
        (_) async => _ok(
          ApiEndpoints.orderById('trip-1'),
          _orderJson('trip-1', 'cancelled'),
        ),
      );

      socket
        ..fire('connect')
        ..fire('connect'); // ikkinchisi — qayta ulanish
      await Future<void>.delayed(Duration.zero);

      expect(driver.activeOrder?.status, OrderStatus.cancelled);
    });
  });
}
