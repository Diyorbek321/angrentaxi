// Widget tests for real favorites wired into PassengerHomeScreen's "Saqlangan
// joylar" row (mobile/lib/features/passenger/screens/home_screen.dart
// #_buildSavedPlaces), replacing the previously hardcoded Uy/Ish/Bozor/Qo'shish
// tiles.
//
// ApiClient is mocked with mocktail and LocationService is faked via GetIt
// (`sl`), same pattern as test/widget/sos_button_test.dart — including its
// bounded pump() loop instead of pumpAndSettle() (the map's tile layer keeps
// retrying real, failing network image loads under `flutter test`, which
// never fully settles) and the tester.takeException() drain for that
// harmless noise.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
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
/// plain `flutter test` — hands the home screen a fixed fix instead.
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

Response<dynamic> _jsonResponse(String path, dynamic data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

const Map<String, dynamic> _favoriteJson = {
  'id': 'fav-1',
  'userId': 'passenger-1',
  'label': 'Uy',
  'address': "Angren, Bobur ko'chasi, 10",
  'lat': 41.02,
  'lng': 70.15,
  'createdAt': '2026-07-13T10:00:00.000Z',
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late OrderProvider orderProvider;
  late AuthProvider authProvider;
  late FavoritesProvider favoritesProvider;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final localStorage = LocalStorage(prefs);

    apiClient = MockApiClient();
    orderProvider =
        OrderProvider(apiClient: apiClient, socketService: SocketService());
    favoritesProvider = FavoritesProvider(apiClient: apiClient);
    authProvider = AuthProvider(
      apiClient: apiClient,
      localStorage: localStorage,
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );

    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());

    // No active order -> PassengerHomeScreen renders the search view (where
    // the saved-places row lives) rather than the active-order tracking view.
    when(() => apiClient.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.orderHistory, {
        'orders': <dynamic>[],
        'total': 0,
        'page': 1,
        'limit': 20,
      }),
    );

    when(() => apiClient.get(ApiEndpoints.favoriteAddresses)).thenAnswer(
      (_) async =>
          _jsonResponse(ApiEndpoints.favoriteAddresses, [_favoriteJson]),
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
          home: const PassengerHomeScreen(),
          routes: {
            '/passenger/tariff': (_) =>
                const Scaffold(body: Text('Tariff Select Screen')),
          },
        ),
      ),
    );
    // Drains the postFrameCallback-triggered checkActiveOrder()/loadFavorites()
    // calls without waiting on flutter_map's tile-layer animations to fully
    // settle.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets(
    'shows real favorites as saved-place tiles with a trailing Qo\'shish tile, '
    'not the old hardcoded ones',
    (tester) async {
      await pumpHomeScreen(tester);

      expect(find.text('Uy'), findsOneWidget);
      expect(find.text("Qo'shish"), findsOneWidget);
      // The previously hardcoded tiles must be gone now that they're driven
      // by real data.
      expect(find.text('Bozor'), findsNothing);
      expect(find.text('Ish'), findsNothing);

      tester.takeException();
    },
  );

  testWidgets(
    'tapping a real favorite tile sets pickup+dropoff and navigates straight to tariff',
    (tester) async {
      await pumpHomeScreen(tester);

      expect(orderProvider.pendingPickup, isNull);
      expect(orderProvider.pendingDropoff, isNull);

      await tester.tap(find.text('Uy'));
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      expect(orderProvider.pendingPickup, isNotNull);
      expect(orderProvider.pendingPickup?.lat, 41.0167);
      expect(orderProvider.pendingPickup?.lng, 70.1436);

      expect(
        orderProvider.pendingDropoff?.address,
        "Angren, Bobur ko'chasi, 10",
      );
      expect(orderProvider.pendingDropoff?.lat, 41.02);
      expect(orderProvider.pendingDropoff?.lng, 70.15);

      // Went straight to tariff selection — destination_screen was skipped.
      expect(find.text('Tariff Select Screen'), findsOneWidget);

      tester.takeException();
    },
  );
}
