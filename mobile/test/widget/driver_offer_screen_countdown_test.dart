// Taklif ekrani (2026-10-31 zanjir auditi):
//   · qabulda tarmoq xatosi — hisoblagich QAYTA yuradi va muddatda yopiladi
//     (ilgari "7 s" da abadiy qotib qolardi);
//   · ilova ekranda — ovoz signali ham chiqadi;
//   · ekran ochiq turganda yangi taklif kelsa, hisoblagich unga bog'lanadi
//     va eski taklif taymeri YANGISINI rad etmaydi.
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/platform/driver_overlay.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/order_offer_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _FakeLocationService extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => Position(
        latitude: 41.0167,
        longitude: 70.1436,
        timestamp: DateTime(2026, 10, 10, 10),
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );
}

Map<String, dynamic> _orderJson(String status, {String id = 'order-1'}) => {
      'id': id,
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Bobur 10', 'lat': 41.0167, 'lng': 70.1436},
      'dropoff': {'address': 'Markaz', 'lat': 41.02, 'lng': 70.15},
      'status': status,
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-10T10:00:00.000Z',
    };

class _CountingOverlay extends DriverOverlay {
  int sounds = 0;

  @override
  Future<void> playOfferSound() async => sounds++;
}

void main() {
  late _MockApiClient api;
  late DriverProvider driver;
  late DateTime now;
  late _CountingOverlay overlay;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    api = _MockApiClient();
    AppHaptics.enabled = false;
    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());
    now = DateTime(2026, 10, 31, 10);
    overlay = _CountingOverlay();
    driver = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: _FakeLocationService(),
      localStorage: LocalStorage(prefs),
      clock: () => now,
    );
    when(() => api.patch(any())).thenAnswer((inv) async => Response<dynamic>(
          requestOptions: RequestOptions(path: inv.positionalArguments[0] as String),
          statusCode: 200,
          data: {'success': true, 'data': null},
        ));
  });

  tearDown(() async => sl.reset());

  Future<void> openOffer(WidgetTester tester, String id) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: driver,
        child: MaterialApp(
          routes: {
            '/': (_) => const Scaffold(body: Text('HOME')),
            '/driver/offer': (_) => OrderOfferScreen(overlay: overlay),
            '/driver/navigation': (_) => const Scaffold(body: Text('NAVIGATION')),
          },
        ),
      ),
    );
    driver.debugSetPendingOfferForTest(Order.fromJson(_orderJson('searching', id: id)));
    tester.state<NavigatorState>(find.byType(Navigator)).pushNamed('/driver/offer');
    await tester.pumpAndSettle();
  }

  /// Soat va taymerlarni birga suradi.
  Future<void> advance(WidgetTester tester, Duration by) async {
    const step = Duration(milliseconds: 250);
    for (var t = Duration.zero; t < by; t += step) {
      now = now.add(step);
      await tester.pump(step);
    }
  }

  testWidgets('ilova ekranda — taklif ovoz bilan keladi', (tester) async {
    await openOffer(tester, 'order-1');

    expect(overlay.sounds, 1);
  });

  testWidgets('qabulda tarmoq xatosi — hisoblagich davom etadi va muddatda yopiladi', (tester) async {
    when(() => api.patch(ApiEndpoints.acceptOrder('order-1'))).thenThrow(DioException(
      requestOptions: RequestOptions(path: ApiEndpoints.acceptOrder('order-1')),
      type: DioExceptionType.connectionError,
    ));
    await openOffer(tester, 'order-1');
    await advance(tester, const Duration(seconds: 3));

    await tester.tap(find.byType(ElevatedButton).first);
    await tester.pump();
    await advance(tester, const Duration(seconds: 2));

    // Hisoblagich qotmagan: 15 − 5 = 10.
    expect(find.text('10'), findsOneWidget);

    await advance(tester, const Duration(seconds: 11));
    await tester.pumpAndSettle();

    expect(find.byType(OrderOfferScreen), findsNothing);
    expect(find.text('HOME'), findsOneWidget);
    verify(() => api.patch(ApiEndpoints.declineOrder('order-1'))).called(1);
  });

  testWidgets('ekran ochiq turganda yangi taklif — eski taymer uni rad etmaydi', (tester) async {
    await openOffer(tester, 'order-1');
    await advance(tester, const Duration(seconds: 10));

    // order-1 server tomonda tugadi va darhol order-2 keldi.
    driver.debugSetPendingOfferForTest(Order.fromJson(_orderJson('searching', id: 'order-2')));
    await tester.pump();
    await tester.pump();
    // Hisoblagich YANGI taklifga bog'landi — to'liq 15 s.
    expect(find.text('15'), findsOneWidget);
    // Eski taklif tugashi kerak bo'lgan payt (15 s) — o'tdi.
    await advance(tester, const Duration(seconds: 7));

    verifyNever(() => api.patch(ApiEndpoints.declineOrder('order-2')));
    expect(driver.pendingOffer?.id, 'order-2');
    expect(find.text('8'), findsOneWidget);
    expect(find.byType(OrderOfferScreen), findsOneWidget);
    expect(overlay.sounds, 2);
  });
}
