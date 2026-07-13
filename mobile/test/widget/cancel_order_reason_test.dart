// Widget tests for the cancellation reason picker added to
// PassengerHomeScreen (mobile/lib/features/passenger/screens/home_screen.dart
// #_confirmCancel): tapping "Bekor qilish" on an active order now opens a
// reason-picker dialog (instead of a plain yes/no confirm), and confirming
// forwards the chosen reason to OrderProvider.cancelOrder(reason: ...).
//
// ApiClient is mocked with mocktail — no real network call is made, same
// pattern as test/widget/order_history_repeat_ride_test.dart. LocationService
// is faked via GetIt (`sl`) since PassengerHomeScreen resolves it directly
// rather than through constructor injection, avoiding the real geolocator
// platform channel (unavailable under `flutter test`).
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
/// plain `flutter test` — the active-order view doesn't need a real fix.
class _FakeLocationService extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => null;
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

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final localStorage = LocalStorage(prefs);

    apiClient = MockApiClient();
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

    // Also fired from initState (loadFavorites()) — unused by this test's
    // active-order view, but PassengerHomeScreen requires a FavoritesProvider
    // in the tree regardless of which view is showing.
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
        child: const MaterialApp(home: PassengerHomeScreen()),
      ),
    );
    // Drains the postFrameCallback-triggered checkActiveOrder() call without
    // waiting on flutter_map's tile-layer animations to fully settle.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets('tapping Bekor qilish opens a reason picker with all four options', (tester) async {
    await pumpHomeScreen(tester);

    expect(find.text('Bekor qilish'), findsOneWidget);
    await tester.tap(find.text('Bekor qilish'));
    await tester.pump();

    expect(find.text('Bekor qilish sababi'), findsOneWidget);
    expect(find.text('Juda uzoq kutdim'), findsOneWidget);
    expect(find.text("Fikrimni o'zgartirdim"), findsOneWidget);
    expect(find.text('Narx juda qimmat'), findsOneWidget);
    expect(find.text('Boshqa sabab'), findsOneWidget);
  });

  testWidgets('selecting a reason and confirming calls cancelOrder with that reason', (tester) async {
    when(() => apiClient.patch(any(), data: any(named: 'data'))).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.cancelOrder('order-1'), <String, dynamic>{}),
    );

    await pumpHomeScreen(tester);

    await tester.tap(find.text('Bekor qilish'));
    await tester.pump();

    await tester.tap(find.text('Narx juda qimmat'));
    await tester.pump();

    await tester.tap(find.text('Ha, bekor qilish'));
    // Cancelling swaps the active-order view back to the search view, which
    // mounts fresh flutter_animate widgets; drain their timers the same way
    // pumpHomeScreen does for the initial build, rather than a couple of bare
    // pump() calls, so no animation timer is still pending when the test ends.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    final captured = verify(
      () => apiClient.patch(
        ApiEndpoints.cancelOrder('order-1'),
        data: captureAny(named: 'data'),
      ),
    ).captured.single;

    expect(captured, {'reason': 'Narx juda qimmat'});
  });

  testWidgets('choosing "Boshqa sabab" reveals a text field and sends its trimmed text', (tester) async {
    when(() => apiClient.patch(any(), data: any(named: 'data'))).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.cancelOrder('order-1'), <String, dynamic>{}),
    );

    await pumpHomeScreen(tester);

    await tester.tap(find.text('Bekor qilish'));
    await tester.pump();

    await tester.tap(find.text('Boshqa sabab'));
    await tester.pump();

    expect(find.byType(TextField), findsOneWidget);
    await tester.enterText(find.byType(TextField), '  Haydovchi topilmadi  ');
    await tester.pump();

    await tester.tap(find.text('Ha, bekor qilish'));
    // See the settling comment in the previous test — the post-cancel search
    // view mounts new flutter_animate widgets that need time to finish.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    final captured = verify(
      () => apiClient.patch(
        ApiEndpoints.cancelOrder('order-1'),
        data: captureAny(named: 'data'),
      ),
    ).captured.single;

    expect(captured, {'reason': 'Haydovchi topilmadi'});
  });
}
