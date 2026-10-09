// Ovqat/market mijozi kuryerni xaritada jonli ko'radi.
//
// Kuryer safari mijoz nomida yaratiladi, ya'ni mijoz `order:<safarId>`
// xonasiga kira oladi va kuryerning `driver:location` paketlarini oladi.
// Bu testlar qulflaydi:
//   1. `delivery` maydoni to'g'ri o'qiladi (backend: delivery-tracking.ts).
//   2. Kontroller faqat O'Z safarining paketini qabul qiladi — yo'lovchi
//      bir vaqtda taksi ham kutayotgan bo'lsa, mashinalar aralashmaydi.
//   3. Yopilganda xonadan chiqadi va faqat O'Z tinglovchisini o'chiradi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/state/courier_tracking_controller.dart';
import 'package:angren_taxi/shared/models/courier_tracking.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Haqiqiy socket o'rniga: yuborilganini yozib oladi, kelganini qo'lda
/// uzatadi. Bitta event'ga bir nechta tinglovchi bo'lishi mumkin — xuddi
/// socket.io'dagidek.
class FakeSocketService extends SocketService {
  /// `"join:order ride-1"` ko'rinishida — record ichidagi Map chuqur
  /// solishtirilmaydi.
  final emitted = <String>[];
  final handlers = <String, List<void Function(dynamic)>>{};

  @override
  bool get isConnected => true;

  @override
  void emit(String event, dynamic data) =>
      emitted.add('$event ${(data as Map)['orderId']}');

  @override
  void on(String event, void Function(dynamic) handler) =>
      (handlers[event] ??= []).add(handler);

  @override
  void off(String event, [void Function(dynamic)? handler]) {
    if (handler == null) {
      handlers.remove(event);
    } else {
      handlers[event]?.remove(handler);
    }
  }

  void deliver(String event, dynamic data) {
    for (final h in List.of(handlers[event] ?? const <void Function(dynamic)>[])) {
      h(data);
    }
  }
}

const _delivery = {
  'orderId': 'ride-1',
  'status': 'accepted',
  'driverName': 'Bobur Aliyev',
  'driverPhone': '+998901234567',
  'carModel': 'Cobalt',
  'carNumber': '01 A 777 BB',
  'pickup': {'address': 'Osh Markazi', 'lat': 41.01, 'lng': 70.14},
  'dropoff': {'address': 'Uy', 'lat': 41.02, 'lng': 70.15},
};

Map<String, dynamic> _deliveryWith(Map<String, dynamic> overrides) =>
    {..._delivery, ...overrides};

Map<String, dynamic> _foodOrder({Object? delivery = _delivery, String status = 'ready'}) => {
      'id': 'food-1',
      'restaurantId': 'rest-1',
      'status': status,
      'items': <dynamic>[],
      'deliveryAddress': 'Uy',
      'totalPrice': 75000,
      'createdAt': '2026-10-09T10:00:00.000Z',
      'delivery': delivery,
    };

void main() {
  group('CourierTracking.fromJson', () {
    test('kuryer, mashina va ikki nuqtani o\'qiydi', () {
      final t = CourierTracking.fromJson(_delivery);
      expect(t.orderId, 'ride-1');
      expect(t.status, OrderStatus.driverAssigned);
      expect(t.driverName, 'Bobur Aliyev');
      expect(t.carLabel, 'Cobalt · 01 A 777 BB');
      expect(t.pickup, const LatLng(41.01, 70.14));
      expect(t.dropoff, const LatLng(41.02, 70.15));
      expect(t.hasCourier, isTrue);
    });

    test('kuryer hali topilmagan', () {
      final t = CourierTracking.fromJson(_deliveryWith(const {
        'status': 'searching',
        'driverName': null,
        'driverPhone': null,
        'carModel': null,
        'carNumber': null,
      }));
      expect(t.hasCourier, isFalse);
      expect(t.carLabel, isEmpty);
    });

    test('koordinatasiz nuqta null — xaritaga (0,0) tushmaydi', () {
      final t = CourierTracking.fromJson(_deliveryWith(const {'pickup': null}));
      expect(t.pickup, isNull);
    });

    test('FoodOrder `delivery` ni o\'qiydi, yo\'q bo\'lsa null', () {
      expect(FoodOrder.fromJson(_foodOrder()).delivery?.orderId, 'ride-1');
      expect(FoodOrder.fromJson(_foodOrder(delivery: null)).delivery, isNull);
    });

    test('kuzatuv faqat kuryer yo\'lda bo\'lganda ochiladi', () {
      expect(FoodOrder.fromJson(_foodOrder()).isTrackable, isTrue);
      expect(FoodOrder.fromJson(_foodOrder(delivery: null)).isTrackable, isFalse);
      expect(FoodOrder.fromJson(_foodOrder(status: 'delivered')).isTrackable, isFalse);
    });
  });

  group('CourierTrackingController', () {
    late FakeSocketService socket;
    late MockApiClient api;
    late CourierTrackingController controller;
    late Map<String, dynamic> serverOrder;

    setUp(() {
      serverOrder = _foodOrder();
      socket = FakeSocketService();
      api = MockApiClient();
      when(() => api.get(any())).thenAnswer(
        (_) async => Response<dynamic>(
          requestOptions: RequestOptions(path: '/food/orders/food-1'),
          data: {'success': true, 'data': serverOrder},
          statusCode: 200,
        ),
      );
      controller = CourierTrackingController(
        apiClient: api,
        socketService: socket,
        refreshPath: '/food/orders/food-1',
        initial: CourierTracking.fromJson(_delivery),
        refreshInterval: null,
      )..start();
    });

    test('kuryer safari xonasiga kiradi', () {
      expect(socket.emitted, contains('join:order ride-1'));
    });

    test('o\'z safarining joylashuvini qabul qiladi', () {
      socket.deliver('driver:location', {'lat': 41.015, 'lng': 70.145, 'orderId': 'ride-1'});
      expect(controller.courierLocation.value, const LatLng(41.015, 70.145));
    });

    test('boshqa buyurtmaning joylashuvini e\'tiborsiz qoldiradi', () {
      socket.deliver('driver:location', {'lat': 1.0, 'lng': 2.0, 'orderId': 'taxi-9'});
      expect(controller.courierLocation.value, isNull);
    });

    test('yopilganda xonadan chiqadi va boshqalarning tinglovchisiga tegmaydi', () {
      void taxiHandler(dynamic _) {}
      socket.on('driver:location', taxiHandler);

      controller.dispose();

      expect(socket.emitted, contains('leave:order ride-1'));
      expect(socket.handlers['driver:location'], [taxiHandler]);
    });

    test('qayta kuryer yuborilsa yangi safar xonasiga o\'tadi', () async {
      serverOrder = _foodOrder(delivery: {..._delivery, 'orderId': 'ride-2'});
      socket.deliver('driver:location', {'lat': 41.015, 'lng': 70.145, 'orderId': 'ride-1'});

      await controller.refresh();

      expect(controller.tracking.orderId, 'ride-2');
      expect(socket.emitted, contains('leave:order ride-1'));
      expect(socket.emitted, contains('join:order ride-2'));
      // Eski kuryerning mashinasi yangi kuryer o'rnida qolib ketmasin.
      expect(controller.courierLocation.value, isNull);
    });

    test('buyurtma yetkazilgach tugagan deb belgilanadi', () async {
      serverOrder = _foodOrder(status: 'delivered');
      await controller.refresh();
      expect(controller.isFinished, isTrue);
    });
  });
}
