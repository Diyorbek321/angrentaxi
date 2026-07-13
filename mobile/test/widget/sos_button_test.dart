// Widget tests for the SOS button added to PassengerHomeScreen's
// active-order view (mobile/lib/features/passenger/screens/home_screen.dart
// #_buildSosButton / #_showSosSheet): tapping the red circular button opens
// a confirmation sheet with an emergency-call option and a
// "Dispetcherlarga xabar berish" option that reports the SOS to the backend
// via SosService.reportSos.
//
// ApiClient is mocked with mocktail and injected into a real SosService,
// same pattern as test/widget/checkout_payment_test.dart. LocationService is
// faked via GetIt (`sl`), same pattern as
// test/widget/cancel_order_reason_test.dart.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/favorites_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/home_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Avoids the real geolocator platform channel, which isn't available under
/// plain `flutter test` — hands the SOS report a fixed fix instead.
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

const Map<String, dynamic> _activeOrderJson = {
  'id': 'order-1',
  'passengerId': 'passenger-1',
  'pickup': {
    'address': "Angren, Bobur ko'chasi, 10",
    'lat': 41.0167,
    'lng': 70.1436,
  },
  'dropoff': {
    'address': 'Angren, Mustaqillik maydoni',
    'lat': 41.0200,
    'lng': 70.1500,
  },
  'status': 'accepted',
  'estimatedPrice': 20000.0,
  'createdAt': '2026-07-13T10:00:00.000Z',
};

Response<dynamic> _jsonResponse(String path, dynamic data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late OrderProvider orderProvider;
  late AuthProvider authProvider;
  late FavoritesProvider favoritesProvider;
  late SosService sosService;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final localStorage = LocalStorage(prefs);

    apiClient = MockApiClient();
    sosService = SosService(apiClient: apiClient);
    orderProvider = OrderProvider(apiClient: apiClient, socketService: SocketService());
    favoritesProvider = FavoritesProvider(apiClient: apiClient);
    authProvider = AuthProvider(
      apiClient: apiClient,
      localStorage: localStorage,
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );

    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());

    // checkActiveOrder() is fired automatically from PassengerHomeScreen's
    // initState and picks up the one active order in the first history page.
    when(() => apiClient.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.orderHistory, {
        'orders': [_activeOrderJson],
        'total': 1,
        'page': 1,
        'limit': 20,
      }),
    );

    // Also fired from initState (loadFavorites()) — unused by this file's
    // active-order/SOS tests, but PassengerHomeScreen requires a
    // FavoritesProvider in the tree regardless of which view is showing.
    when(() => apiClient.get(ApiEndpoints.favoriteAddresses)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.favoriteAddresses, <dynamic>[]),
    );
  });

  tearDown(() async {
    await sl.reset();
  });

  Future<void> pumpHomeScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<OrderProvider>.value(value: orderProvider),
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
          ChangeNotifierProvider<FavoritesProvider>.value(
            value: favoritesProvider,
          ),
        ],
        child: MaterialApp(
          home: PassengerHomeScreen(sosService: sosService),
        ),
      ),
    );
    // Drains the postFrameCallback-triggered checkActiveOrder() call without
    // waiting on flutter_map's tile-layer animations to fully settle.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets('tapping the SOS button opens the confirmation sheet', (tester) async {
    await pumpHomeScreen(tester);

    expect(find.byIcon(Icons.sos_rounded), findsOneWidget);
    await tester.tap(find.byIcon(Icons.sos_rounded));
    // Bounded pumps rather than pumpAndSettle(): the map's tile layer keeps
    // retrying real (failing) network image loads in this test environment,
    // which never fully "settles".
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    expect(find.text('Favqulodda yordam'), findsOneWidget);
    expect(find.text('Favqulodda chaqiruv (102/103)'), findsOneWidget);
    expect(find.text('Dispetcherlarga xabar berish'), findsOneWidget);

    // Drain any FlutterErrors reported by the map's tile layer while
    // fetching real (test-stubbed-to-400) OSM tiles — unrelated noise, see
    // the other tests in this file for the same pattern.
    tester.takeException();
  });

  testWidgets(
    'tapping Dispetcherlarga xabar berish calls SosService.reportSos with the active order id and shows a confirmation',
    (tester) async {
      when(() => apiClient.post(
            ApiEndpoints.reportSos('order-1'),
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.reportSos('order-1'), {
          'id': 'sos-1',
          'orderId': 'order-1',
          'reportedByUserId': 'passenger-1',
          'reportedByRole': 'passenger',
          'lat': 41.0167,
          'lng': 70.1436,
          'status': 'active',
          'createdAt': '2026-07-13T10:00:00.000Z',
          'resolvedAt': null,
        }),
      );

      await pumpHomeScreen(tester);

      await tester.tap(find.byIcon(Icons.sos_rounded));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Dispetcherlarga xabar berish'));
      await tester.pumpAndSettle();

      final captured = verify(() => apiClient.post(
            ApiEndpoints.reportSos('order-1'),
            data: captureAny(named: 'data'),
          )).captured.single as Map<String, dynamic>;
      expect(captured['lat'], 41.0167);
      expect(captured['lng'], 70.1436);

      expect(find.text('Dispetcherlarga xabar yuborildi'), findsOneWidget);
    },
  );

  testWidgets(
    'a failed dispatcher alert shows the server error message',
    (tester) async {
      when(() => apiClient.post(
            ApiEndpoints.reportSos('order-1'),
            data: any(named: 'data'),
          )).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: ApiEndpoints.reportSos('order-1')),
          type: DioExceptionType.badResponse,
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: ApiEndpoints.reportSos('order-1')),
            statusCode: 403,
            data: {'success': false, 'message': 'Not a party to this order'},
          ),
        ),
      );

      await pumpHomeScreen(tester);

      await tester.tap(find.byIcon(Icons.sos_rounded));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Dispetcherlarga xabar berish'));
      // Bounded pumps rather than pumpAndSettle(): the map's tile layer keeps
      // retrying real (failing) network image loads in this test
      // environment, which never fully "settles".
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      expect(find.text('Not a party to this order'), findsOneWidget);

      // Drain any FlutterErrors reported by the map's tile layer while
      // fetching real (test-stubbed-to-400) OSM tiles. Those are unrelated
      // to this test's SOS flow — flutter_test fails the test if any
      // FlutterError is left un-taken by the time it ends, regardless of
      // whether the test's own assertions passed, so this prevents that
      // known, harmless noise from being reported as a test failure. See
      // https://github.com/fleaflet/flutter_map network-tile testing caveat.
      tester.takeException();
    },
  );
}
