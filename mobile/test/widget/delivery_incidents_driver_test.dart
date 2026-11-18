// Kuryer safar ekrani — yetkazish hodisalari (docs/INCIDENT-POLICY.md §2):
//   * "Manzilga yetib keldim" → PATCH /orders/:id/dropoff-arrived (xato matni
//     serverdan, masalan "juda uzoqda");
//   * manzilda kutish hisoblagichi va naqd ovqatda kutish haqi naqdga qo'shilishi;
//   * "Yetkazib bo'lmadi" faqat bepul kutish tugagach, sabab tanlanadi;
//   * qaytarish yo'li: banner, manzil olish nuqtasiga almashadi, yakunlash yo'q;
//   * `order:returned` — safar yopiladi.
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/trip_screen.dart';
import 'package:angren_taxi/shared/widgets/ag_slide_action.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

class _FakeLocationService extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => Position(
        latitude: 41.0167,
        longitude: 70.1436,
        timestamp: DateTime(2026, 7, 13, 10),
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );
}

class _NoRouteService implements RouteService {
  @override
  Future<RouteResult?> getRoute(LatLng from, LatLng to, {List<LatLng> waypoints = const []}) async => null;
}

class _SilentTts implements TtsEngine {
  @override
  Future<List<String>> languages() async => const [];
  @override
  Future<void> setLanguage(String language) async {}
  @override
  Future<void> setSpeechRate(double rate) async {}
  @override
  Future<void> speak(String text) async {}
  @override
  Future<void> stop() async {}
}

const String _orderId = 'order-1';

Map<String, dynamic> _orderJson({
  String serviceType = 'food',
  String status = 'in_progress',
  DateTime? dropoffArrivedAt,
  DateTime? deliveryFailedAt,
  String? reason,
  int collectCash = 0,
}) =>
    {
      'id': _orderId,
      'passengerId': 'passenger-1',
      'passenger': {'firstName': 'Aziz', 'lastName': 'Karimov', 'phone': '+998900000000'},
      'pickup': {'address': 'Rayhon restorani', 'lat': 41.0167, 'lng': 70.1436},
      'dropoff': {'address': 'Mustaqillik 5', 'lat': 41.0200, 'lng': 70.1500},
      'status': status,
      'estimatedPrice': 12000.0,
      'createdAt': '2026-07-13T10:00:00.000Z',
      'serviceType': serviceType,
      'waitingPricePerMinute': 500,
      'details': {
        'foodOrderId': 'food-1',
        'vendorName': 'Rayhon',
        'itemsCount': 2,
        'collectCash': collectCash,
      },
      if (dropoffArrivedAt != null) 'dropoffArrivedAt': dropoffArrivedAt.toUtc().toIso8601String(),
      if (deliveryFailedAt != null) 'deliveryFailedAt': deliveryFailedAt.toUtc().toIso8601String(),
      if (reason != null) 'deliveryFailureReason': reason,
    };

Response<dynamic> _ok(String path, Map<String, dynamic> data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

DioException _badRequest(String path, String message) => DioException(
      requestOptions: RequestOptions(path: path),
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: path),
        statusCode: 400,
        data: {'success': false, 'message': message},
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late DriverProvider driverProvider;
  late AuthProvider authProvider;

  setUpAll(() => registerFallbackValue(RequestOptions(path: '')));

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final localStorage = LocalStorage(await SharedPreferences.getInstance());
    apiClient = MockApiClient();
    AppHaptics.enabled = false;
    driverProvider = DriverProvider(
      apiClient: apiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: localStorage,
    );
    authProvider = AuthProvider(
      apiClient: apiClient,
      localStorage: localStorage,
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );
    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());
    sl.registerLazySingleton<ApiClient>(() => apiClient);
    sl.registerLazySingleton<SocketService>(() => SocketService());
    sl.registerLazySingleton<RouteService>(() => _NoRouteService());
    sl.registerLazySingleton<VoiceGuide>(() => VoiceGuide(engine: _SilentTts()));
  });

  tearDown(() async {
    AppHaptics.enabled = true;
    await sl.reset();
  });

  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 10}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> pumpTrip(WidgetTester tester, Map<String, dynamic> json) async {
    when(() => apiClient.patch(ApiEndpoints.acceptOrder(_orderId)))
        .thenAnswer((_) async => _ok(ApiEndpoints.acceptOrder(_orderId), json));
    await driverProvider.acceptOrder(_orderId);
    await tester.binding.setSurfaceSize(const Size(420, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driverProvider),
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ],
        child: MaterialApp(
          routes: {'/driver/home': (_) => const Scaffold(body: Text('HOME'))},
          home: TripScreen(sosService: SosService(apiClient: apiClient)),
        ),
      ),
    );
    await pumpUntilQuiet(tester);
    tester.takeException();
  }

  Future<void> tapKey(WidgetTester tester, String key) async {
    final finder = find.byKey(ValueKey(key));
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await pumpUntilQuiet(tester);
  }

  group('Manzilga yetib keldim', () {
    testWidgets('bosilsa PATCH ketadi va bepul kutish boshlanadi', (tester) async {
      when(() => apiClient.patch(ApiEndpoints.dropoffArrived(_orderId), data: any(named: 'data')))
          .thenAnswer((_) async => _ok(
                ApiEndpoints.dropoffArrived(_orderId),
                _orderJson(dropoffArrivedAt: DateTime.now()),
              ));
      await pumpTrip(tester, _orderJson());

      expect(find.text('Manzilga yetib keldim'), findsOneWidget);
      expect(find.byKey(const ValueKey('delivery_failed_button')), findsNothing);

      await tapKey(tester, 'dropoff_arrived_button');

      verify(() => apiClient.patch(ApiEndpoints.dropoffArrived(_orderId), data: any(named: 'data')))
          .called(1);
      expect(find.textContaining('Bepul kutish:'), findsOneWidget);
      expect(find.text('Bepul kutish tugagach ochiladi'), findsOneWidget);
    });

    testWidgets('server rad etsa (uzoqda) — server matni ko\'rsatiladi', (tester) async {
      when(() => apiClient.patch(ApiEndpoints.dropoffArrived(_orderId), data: any(named: 'data')))
          .thenThrow(_badRequest(ApiEndpoints.dropoffArrived(_orderId), 'Manzilga 500 m dan yaqin keling'));
      await pumpTrip(tester, _orderJson());

      await tapKey(tester, 'dropoff_arrived_button');

      expect(find.text('Manzilga 500 m dan yaqin keling'), findsOneWidget);
      expect(find.text('Manzilga yetib keldim'), findsOneWidget);
    });

    testWidgets('taksida bu blok umuman yo\'q', (tester) async {
      final json = _orderJson(serviceType: 'taxi')..remove('details');
      await pumpTrip(tester, json);
      expect(find.text('Manzilga yetib keldim'), findsNothing);
    });
  });

  group('Yetkazib bo\'lmadi', () {
    testWidgets('bepul kutish tugamaguncha tugma o\'chiq', (tester) async {
      await pumpTrip(
        tester,
        _orderJson(dropoffArrivedAt: DateTime.now().subtract(const Duration(minutes: 1))),
      );
      final button = tester.widget<ButtonStyleButton>(find.descendant(
        of: find.byKey(const ValueKey('delivery_failed_button')),
        matching: find.byWidgetPredicate((w) => w is ButtonStyleButton),
      ));
      expect(button.onPressed, isNull);
    });

    testWidgets('kutish tugagach sabab tanlanadi va qaytarish boshlanadi', (tester) async {
      when(() => apiClient.patch(ApiEndpoints.deliveryFailed(_orderId), data: any(named: 'data')))
          .thenAnswer((_) async => _ok(
                ApiEndpoints.deliveryFailed(_orderId),
                _orderJson(
                  dropoffArrivedAt: DateTime.now().subtract(const Duration(minutes: 6)),
                  deliveryFailedAt: DateTime.now(),
                  reason: 'customer_absent',
                ),
              ));
      await pumpTrip(
        tester,
        _orderJson(dropoffArrivedAt: DateTime.now().subtract(const Duration(minutes: 6))),
      );
      expect(find.byType(AgSlideAction), findsOneWidget);

      await tapKey(tester, 'delivery_failed_button');
      expect(find.text('Nima bo\'ldi?'), findsOneWidget);
      expect(find.text('Mijoz rad etdi'), findsOneWidget);
      expect(find.text("Bog'lanib bo'lmadi"), findsOneWidget);
      await tapKey(tester, 'fail_reason_customer_absent');

      verify(() => apiClient.patch(
            ApiEndpoints.deliveryFailed(_orderId),
            data: {'reason': 'customer_absent'},
          )).called(1);
      expect(driverProvider.activeOrder!.isReturning, isTrue);
      // Qaytarish yo'li: banner, manzil — restoran, yakunlash yo'q.
      expect(find.text('Tovarni qaytaring'), findsOneWidget);
      expect(find.text('Qaytarish manzili'), findsOneWidget);
      expect(find.text('Rayhon restorani'), findsOneWidget);
      expect(find.byType(AgSlideAction), findsNothing);
    });
  });

  testWidgets('naqd ovqat: kutish haqi naqdga qo\'shilishi ko\'rsatiladi', (tester) async {
    await pumpTrip(
      tester,
      _orderJson(
        collectCash: 50000,
        dropoffArrivedAt: DateTime.now().subtract(const Duration(minutes: 7)),
      ),
    );
    expect(find.byKey(const ValueKey('dropoff_wait_cash_note')), findsOneWidget);
    expect(find.textContaining('Pullik kutish:'), findsOneWidget);
  });

  testWidgets('order:returned — "Qaytarish tasdiqlandi" va bosh ekranga', (tester) async {
    await pumpTrip(
      tester,
      _orderJson(
        dropoffArrivedAt: DateTime.now().subtract(const Duration(minutes: 6)),
        deliveryFailedAt: DateTime.now(),
        reason: 'customer_refused',
      ),
    );
    expect(find.text('Tovarni qaytaring'), findsOneWidget);

    driverProvider.applyOrderReturned({'orderId': _orderId, 'finalPrice': 18000});
    await pumpUntilQuiet(tester);

    expect(driverProvider.activeOrder, isNull);
    expect(find.text('Qaytarish tasdiqlandi!'), findsOneWidget);
    await tester.tap(find.text('Davom etish'));
    await pumpUntilQuiet(tester);
    expect(find.text('HOME'), findsOneWidget);
  });

  testWidgets('boshqa safarning order:returned hodisasi e\'tiborsiz', (tester) async {
    await pumpTrip(tester, _orderJson(deliveryFailedAt: DateTime.now()));
    driverProvider.applyOrderReturned({'orderId': 'other', 'finalPrice': 1});
    await pumpUntilQuiet(tester);
    expect(driverProvider.activeOrder, isNotNull);
  });
}
