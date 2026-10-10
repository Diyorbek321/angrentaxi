// Qabul qilingan buyurtma navigatsiya ekranini OCHIQ qoldirishi kerak.
//
// ⚠️ XATO: taklif ekrani `pendingOffer == null` ni ko'rganda o'zini
// `Navigator.pop()` bilan yopardi. Qabul qilishda esa u
// `pushReplacementNamed('/driver/navigation')` chaqiradi va o'tish
// animatsiyasi davomida hali tirik bo'ladi — qayta chizilib, `pop()`
// chaqirardi va bu ENG USTDAGI ekranni, ya'ni yangi ochilgan navigatsiyani
// yopardi. Haydovchi bosh ekranga qaytib, buyurtmani kichik kartochkada
// ko'rardi.
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
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

Map<String, dynamic> _orderJson(String status) => {
      'id': 'order-1',
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Bobur 10', 'lat': 41.0167, 'lng': 70.1436},
      'dropoff': {'address': 'Markaz', 'lat': 41.02, 'lng': 70.15},
      'status': status,
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-10T10:00:00.000Z',
    };

void main() {
  late _MockApiClient api;
  late DriverProvider driver;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    api = _MockApiClient();
    AppHaptics.enabled = false;
    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());
    driver = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: _FakeLocationService(),
      localStorage: LocalStorage(prefs),
    );
    when(() => api.patch(ApiEndpoints.acceptOrder('order-1'))).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.acceptOrder('order-1')),
        statusCode: 200,
        data: {'success': true, 'data': _orderJson('accepted')},
      ),
    );
  });

  tearDown(() async => sl.reset());

  testWidgets('qabul qilingach navigatsiya ekrani ochiq qoladi', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: driver,
        child: MaterialApp(
          routes: {
            '/': (_) => const Scaffold(body: Text('HOME')),
            '/driver/offer': (_) => const OrderOfferScreen(),
            '/driver/navigation': (_) => const Scaffold(body: Text('NAVIGATION')),
          },
        ),
      ),
    );

    driver.debugSetPendingOfferForTest(Order.fromJson(_orderJson('pending')));
    tester.state<NavigatorState>(find.byType(Navigator)).pushNamed('/driver/offer');
    await tester.pumpAndSettle();
    expect(find.byType(OrderOfferScreen), findsOneWidget);

    await tester.tap(find.byType(ElevatedButton).first);
    await tester.pumpAndSettle();

    expect(find.text('NAVIGATION'), findsOneWidget);
    expect(find.text('HOME'), findsNothing);
    expect(find.byType(OrderOfferScreen), findsNothing);
  });
}
