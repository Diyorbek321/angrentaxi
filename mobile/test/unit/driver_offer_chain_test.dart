// "Buyurtma → haydovchi" zanjiri auditi (2026-10-31), haydovchi tomoni:
//   · sovuq startda (yopiq ilova, push bosildi) taklif tiklanmasdi;
//   · hisoblagich mahalliy edi — kech ochilgan ekran ortiqcha vaqt ko'rsatardi;
//   · server muddat tugaganini aytmasdi (`order:offer_expired`);
//   · eski tiklash javobi yangi socket taklifini o'chirib yuborardi;
//   · "Qabul" ikki marta bosilsa ikkinchi 409 muvaffaqiyatni buzardi;
//   · rad etish paytida kelgan yangi taklif ham o'chib ketardi.
import 'dart:async';

import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _SilentLocationService extends LocationService {
  @override
  Stream<Position> getPositionStream({
    int distanceFilter = 10,
    BackgroundNotice? background,
  }) =>
      const Stream<Position>.empty();
}

Map<String, dynamic> _offerJson(String id, {int? timeoutSeconds, String status = 'searching'}) => {
      'id': id,
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Bobur 10', 'lat': 41.0167, 'lng': 70.1436},
      'dropoff': {'address': 'Markaz', 'lat': 41.02, 'lng': 70.15},
      'status': status,
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-31T10:00:00.000Z',
      if (timeoutSeconds != null) 'timeoutSeconds': timeoutSeconds,
    };

Response<dynamic> _ok(String path, Object? data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

DioException _network(String path) => DioException(
      requestOptions: RequestOptions(path: path),
      type: DioExceptionType.connectionError,
    );

void main() {
  late _MockApiClient api;
  late DriverProvider driver;
  late DateTime now;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    api = _MockApiClient();
    now = DateTime(2026, 10, 31, 10);
    driver = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: LocalStorage(prefs),
      clock: () => now,
    );
  });

  group('muddat taklif KELGAN paytdan hisoblanadi', () {
    test('to‘liq taklif — 15 s', () {
      driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));

      expect(driver.offerTimeLeft, const Duration(seconds: 15));
    });

    test('tiklangan taklif — server bergan qolgan soniyalar', () {
      driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1', timeoutSeconds: 6)));

      expect(driver.offerTimeLeft, const Duration(seconds: 6));
    });

    test('vaqt o‘tadi — ekran qachon qurilishidan qat’i nazar', () {
      driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));
      now = now.add(const Duration(seconds: 10));

      expect(driver.offerTimeLeft, const Duration(seconds: 5));
      now = now.add(const Duration(seconds: 30));
      expect(driver.offerTimeLeft, Duration.zero);
    });
  });

  group('order:offer_expired', () {
    test('joriy taklif yopiladi', () {
      driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));

      driver.applyOfferExpired({'orderId': 'o-1'});

      expect(driver.pendingOffer, isNull);
      expect(driver.offerTimeLeft, Duration.zero);
    });

    test('boshqa (eski) taklif uchun kelgan — yangi taklifga tegilmaydi', () {
      driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-2')));

      driver.applyOfferExpired({'orderId': 'o-1'});

      expect(driver.pendingOffer?.id, 'o-2');
    });
  });

  test('tiklash javobi kelguncha socket yangi taklif keltirsa — u o‘chmaydi', () async {
    final gate = Completer<Response<dynamic>>();
    when(() => api.get(ApiEndpoints.currentOffer)).thenAnswer((_) => gate.future);

    final resync = driver.resyncPendingOffer();
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('fresh')));
    gate.complete(_ok(ApiEndpoints.currentOffer, null));
    await resync;

    expect(driver.pendingOffer?.id, 'fresh');
  });

  test('tiklash javobi kelguncha taklif QABUL qilinsa — eski javob uni qayta ochmaydi', () async {
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));
    final gate = Completer<Response<dynamic>>();
    when(() => api.get(ApiEndpoints.currentOffer)).thenAnswer((_) => gate.future);
    when(() => api.patch(ApiEndpoints.acceptOrder('o-1'))).thenAnswer(
        (_) async => _ok(ApiEndpoints.acceptOrder('o-1'), _offerJson('o-1', status: 'accepted')));

    final resync = driver.resyncPendingOffer();
    await driver.acceptOrder('o-1');
    gate.complete(_ok(ApiEndpoints.currentOffer, _offerJson('o-1', timeoutSeconds: 5)));
    await resync;

    expect(driver.pendingOffer, isNull);
  });

  test('tiklash javobi kelguncha socket bekor qilsa — taklif qaytmaydi', () async {
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));
    final gate = Completer<Response<dynamic>>();
    when(() => api.get(ApiEndpoints.currentOffer)).thenAnswer((_) => gate.future);

    final resync = driver.resyncPendingOffer();
    driver.applyOrderCancelled({'orderId': 'o-1'});
    gate.complete(_ok(ApiEndpoints.currentOffer, _offerJson('o-1', timeoutSeconds: 5)));
    await resync;

    expect(driver.pendingOffer, isNull);
  });

  test('offer_expired: orderId satr bo‘lmasa — yiqilmaydi', () {
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));

    driver.applyOfferExpired({'orderId': 42});

    expect(driver.pendingOffer?.id, 'o-1');
  });

  group('qabul qilish', () {
    test('ikki marta tez bosish — bitta so‘rov', () async {
      driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));
      final gate = Completer<Response<dynamic>>();
      when(() => api.patch(ApiEndpoints.acceptOrder('o-1'))).thenAnswer((_) => gate.future);

      final first = driver.acceptOrder('o-1');
      final second = driver.acceptOrder('o-1');
      gate.complete(_ok(ApiEndpoints.acceptOrder('o-1'), _offerJson('o-1', status: 'accepted')));
      await Future.wait([first, second]);

      verify(() => api.patch(ApiEndpoints.acceptOrder('o-1'))).called(1);
      expect(driver.state, DriverProviderState.success);
    });

    test('tarmoq xatosi — taklif va uning muddati saqlanadi (qayta urinish mumkin)', () async {
      driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));
      when(() => api.patch(ApiEndpoints.acceptOrder('o-1')))
          .thenThrow(_network(ApiEndpoints.acceptOrder('o-1')));
      now = now.add(const Duration(seconds: 4));

      await driver.acceptOrder('o-1');

      expect(driver.pendingOffer?.id, 'o-1');
      expect(driver.offerTimeLeft, const Duration(seconds: 11));
    });
  });

  test('rad etish paytida YANGI taklif kelsa — u qoladi', () async {
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));
    final gate = Completer<Response<dynamic>>();
    when(() => api.patch(ApiEndpoints.declineOrder('o-1'))).thenAnswer((_) => gate.future);

    final decline = driver.declineOrder('o-1');
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-2')));
    gate.complete(_ok(ApiEndpoints.declineOrder('o-1'), null));
    await decline;

    expect(driver.pendingOffer?.id, 'o-2');
  });

  test('rad etish xato bersa ham karta yopiladi', () async {
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('o-1')));
    when(() => api.patch(ApiEndpoints.declineOrder('o-1')))
        .thenThrow(_network(ApiEndpoints.declineOrder('o-1')));

    await driver.declineOrder('o-1');

    expect(driver.pendingOffer, isNull);
  });

  group('sovuq start (yopiq ilovada push bosildi)', () {
    Future<DriverProvider> coldStart({required bool online}) async {
      SharedPreferences.setMockInitialValues({'driver_mode': online});
      final prefs = await SharedPreferences.getInstance();
      when(() => api.get(any())).thenAnswer((inv) async =>
          _ok(inv.positionalArguments[0] as String, null));
      when(() => api.get(ApiEndpoints.currentOffer)).thenAnswer(
          (_) async => _ok(ApiEndpoints.currentOffer, _offerJson('pushed', timeoutSeconds: 9)));
      final cold = DriverProvider(
        apiClient: api,
        socketService: SocketService(),
        locationService: _SilentLocationService(),
        localStorage: LocalStorage(prefs),
        clock: () => now,
      );
      await cold.initialize();
      await pumpEventQueue();
      return cold;
    }

    test('onlayn haydovchi — joriy taklif serverdan tiklanadi', () async {
      final cold = await coldStart(online: true);

      expect(cold.pendingOffer?.id, 'pushed');
      expect(cold.offerTimeLeft, const Duration(seconds: 9));
    });

    test('oflayn haydovchi — taklif so‘ralmaydi', () async {
      await coldStart(online: false);

      verifyNever(() => api.get(ApiEndpoints.currentOffer));
    });
  });
}
