// Widget tests for the chat and SOS entry points added to TripScreen
// (mobile/lib/features/driver/screens/trip_screen.dart), the driver-side
// active-trip screen:
//
// - Tapping the chat button opens TripChatScreen for the active order with
//   the logged-in driver's own user id (from AuthProvider.currentUser).
// - Tapping the SOS button opens the same confirmation-sheet pattern used on
//   the passenger side (see test/widget/sos_button_test.dart), and choosing
//   "Dispetcherlarga xabar berish" calls SosService.reportSos with the
//   active order id and the driver's currently-tracked position.
//
// ApiClient is mocked with mocktail and injected into real DriverProvider /
// AuthProvider / SosService instances, same pattern as
// test/widget/sos_button_test.dart and test/widget/driver_kyc_upload_test.dart.
// LocationService is faked via GetIt (`sl`) so TripScreen's initState map
// centering doesn't touch the real geolocator platform channel.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/trip_screen.dart';
import 'package:angren_taxi/features/trip/screens/trip_chat_screen.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Avoids the real geolocator platform channel, which isn't available under
/// plain `flutter test` — hands TripScreen's map-centering fetch a fixed fix,
/// same pattern as test/widget/sos_button_test.dart.
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

const String _orderId = 'order-1';
const String _driverUserId = 'driver-user-1';

const Map<String, dynamic> _acceptedOrderJson = {
  'id': _orderId,
  'passengerId': 'passenger-1',
  'passenger': {'firstName': 'Aziz', 'lastName': 'Karimov', 'phone': '+998900000000'},
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
  'status': 'in_progress',
  'estimatedPrice': 20000.0,
  'createdAt': '2026-07-13T10:00:00.000Z',
};

Response<dynamic> _jsonResponse(String path, Map<String, dynamic> data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late DriverProvider driverProvider;
  late AuthProvider authProvider;
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

    // Log the driver in locally so AuthProvider.currentUser is populated
    // without a network round-trip — TripScreen reads the driver's own user
    // id from here for the chat screen.
    await localStorage.saveToken('test-token');
    await localStorage.saveUser({
      'id': _driverUserId,
      'phone': '+998901112233',
      'firstName': 'Sardor',
      'lastName': 'Toshev',
      'role': 'driver',
    });
    await authProvider.initialize();

    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());
    // TripChatScreen builds its own TripChatProvider from the service
    // locator when opened without an injected one (mirrors how it's opened
    // from PassengerHomeScreen._openChat), so both are needed here too.
    sl.registerLazySingleton<ApiClient>(() => apiClient);
    sl.registerLazySingleton<SocketService>(() => SocketService());

    // PATCH /orders/:id/accept — used here purely to seed
    // DriverProvider.activeOrder with a realistic in-progress order.
    when(() => apiClient.patch(ApiEndpoints.acceptOrder(_orderId)))
        .thenAnswer((_) async => _jsonResponse(
              ApiEndpoints.acceptOrder(_orderId),
              _acceptedOrderJson,
            ));
    await driverProvider.acceptOrder(_orderId);
  });

  tearDown(() async {
    await sl.reset();
  });

  Future<void> pumpTripScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driverProvider),
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ],
        child: MaterialApp(
          home: TripScreen(sosService: sosService),
        ),
      ),
    );
    // Drains the initState-triggered map-centering location fetch without
    // waiting on flutter_map's tile-layer animations to fully settle.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets(
    'tapping the chat button opens TripChatScreen for the active order with the driver\'s own user id',
    (tester) async {
      when(() => apiClient.get(ApiEndpoints.tripMessages(_orderId)))
          .thenAnswer((_) async => _jsonResponse(
                ApiEndpoints.tripMessages(_orderId),
                {'data': <dynamic>[]},
              ));

      await pumpTripScreen(tester);

      expect(find.byIcon(Icons.chat_bubble_outline_rounded), findsOneWidget);
      await tester.tap(find.byIcon(Icons.chat_bubble_outline_rounded));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final chatScreenFinder = find.byType(TripChatScreen);
      expect(chatScreenFinder, findsOneWidget);
      final chatScreen = tester.widget<TripChatScreen>(chatScreenFinder);
      expect(chatScreen.orderId, _orderId);
      expect(chatScreen.currentUserId, _driverUserId);

      // Drain any FlutterErrors reported by the map's tile layer while
      // fetching real (test-stubbed-to-400) OSM tiles, same caveat as
      // test/widget/sos_button_test.dart.
      tester.takeException();
    },
  );

  testWidgets('tapping the SOS button opens the confirmation sheet', (tester) async {
    await pumpTripScreen(tester);

    expect(find.byIcon(Icons.sos_rounded), findsOneWidget);
    await tester.tap(find.byIcon(Icons.sos_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Favqulodda yordam'), findsOneWidget);
    expect(find.text('Favqulodda chaqiruv (102/103)'), findsOneWidget);
    expect(find.text('Dispetcherlarga xabar berish'), findsOneWidget);

    // Drain any FlutterErrors reported by the map's tile layer while
    // fetching real (test-stubbed-to-400) OSM tiles, same caveat as
    // test/widget/sos_button_test.dart.
    tester.takeException();
  });

  testWidgets(
    'tapping Dispetcherlarga xabar berish calls SosService.reportSos with the active order id and the tracked position',
    (tester) async {
      when(() => apiClient.post(
            ApiEndpoints.reportSos(_orderId),
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.reportSos(_orderId), {
          'id': 'sos-1',
          'orderId': _orderId,
          'reportedByUserId': _driverUserId,
          'reportedByRole': 'driver',
          'lat': 41.0167,
          'lng': 70.1436,
          'status': 'active',
          'createdAt': '2026-07-13T10:00:00.000Z',
          'resolvedAt': null,
        }),
      );

      await pumpTripScreen(tester);

      await tester.tap(find.byIcon(Icons.sos_rounded));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Dispetcherlarga xabar berish'));
      await tester.pumpAndSettle();

      final captured = verify(() => apiClient.post(
            ApiEndpoints.reportSos(_orderId),
            data: captureAny(named: 'data'),
          )).captured.single as Map<String, dynamic>;
      // DriverProvider.lastKnownPosition is only populated once the location
      // stream (started by goOnline) emits, which this test never triggers —
      // TripScreen falls back to the position its own map centered on, i.e.
      // the fake LocationService's fixed fix.
      expect(captured['lat'], 41.0167);
      expect(captured['lng'], 70.1436);

      expect(find.text('Dispetcherlarga xabar yuborildi'), findsOneWidget);

      // Drain any FlutterErrors reported by the map's tile layer while
      // fetching real (test-stubbed-to-400) OSM tiles, same caveat as
      // test/widget/sos_button_test.dart.
      tester.takeException();
    },
  );

  testWidgets(
    'DriverProvider.lastKnownPosition, once tracked, is used over the map-centering fallback',
    (tester) async {
      when(() => apiClient.post(
            ApiEndpoints.reportSos(_orderId),
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.reportSos(_orderId), {
          'id': 'sos-2',
          'orderId': _orderId,
          'reportedByUserId': _driverUserId,
          'reportedByRole': 'driver',
          'lat': 41.05,
          'lng': 70.2,
          'status': 'active',
          'createdAt': '2026-07-13T10:00:00.000Z',
          'resolvedAt': null,
        }),
      );

      await pumpTripScreen(tester);

      // Simulate the driver-location stream having already emitted a fix
      // (normally populated by DriverProvider._emitLocation while online).
      driverProvider.debugSetLastKnownPositionForTest(
        Position(
          latitude: 41.05,
          longitude: 70.2,
          timestamp: DateTime(2026, 7, 13, 10, 5),
          accuracy: 5,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        ),
      );

      await tester.tap(find.byIcon(Icons.sos_rounded));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Dispetcherlarga xabar berish'));
      await tester.pumpAndSettle();

      final captured = verify(() => apiClient.post(
            ApiEndpoints.reportSos(_orderId),
            data: captureAny(named: 'data'),
          )).captured.single as Map<String, dynamic>;
      expect(captured['lat'], 41.05);
      expect(captured['lng'], 70.2);

      tester.takeException();
    },
  );
}
