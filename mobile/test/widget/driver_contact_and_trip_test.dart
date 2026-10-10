// Haydovchi: olib ketishgacha ham yo'lovchiga qo'ng'iroq qila oladi va
// taklifda safarning o'zi qancha ekanini ko'radi.
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/order_offer_screen.dart';
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/features/driver/widgets/passenger_contact_card.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _NoGpsLocation extends LocationService {
  @override
  Future<Never?> getCurrentPosition() async => null;
}

Map<String, dynamic> _json({
  Map<String, dynamic>? passenger,
  double? tripKm,
  int? tripMin,
  bool metered = false,
}) =>
    {
      'id': 'o-1',
      'passengerId': 'p-1',
      if (passenger != null) 'passenger': passenger,
      'pickup': {'address': 'Bobur 10', 'lat': 41.0, 'lng': 70.1},
      'dropoff': {'address': 'Bozor', 'lat': 41.02, 'lng': 70.15},
      'status': 'searching',
      'estimatedPrice': 18000,
      'createdAt': '2026-10-10T10:00:00.000Z',
      'isMetered': metered,
      if (tripKm != null) 'tripDistanceKm': tripKm,
      if (tripMin != null) 'tripDurationMin': tripMin,
    };

void main() {
  group('PassengerContactCard', () {
    Future<void> pump(WidgetTester tester, Order order) => tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: PassengerContactCard(
                order: order,
                wording: DriverServiceWording.of(order.serviceType),
              ),
            ),
          ),
        );

    testWidgets('ism va faol qo\'ng\'iroq tugmasi', (tester) async {
      await pump(
        tester,
        Order.fromJson(_json(passenger: {
          'firstName': 'Aziz',
          'lastName': 'Karimov',
          'phone': '+998901112233',
        })),
      );

      expect(find.textContaining('Aziz'), findsOneWidget);
      final button = tester.widget<IconButton>(find.byKey(PassengerContactCard.callButtonKey));
      expect(button.onPressed, isNotNull);
    });

    testWidgets('raqam yo\'q — tugma joyida, lekin o\'chiq', (tester) async {
      await pump(tester, Order.fromJson(_json()));

      final button = tester.widget<IconButton>(find.byKey(PassengerContactCard.callButtonKey));
      expect(button.onPressed, isNull);
    });
  });

  group('Taklif — safar uzunligi', () {
    late DriverProvider driver;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      AppHaptics.enabled = false;
      await sl.reset();
      sl.registerLazySingleton<LocationService>(() => _NoGpsLocation());
      driver = DriverProvider(
        apiClient: _MockApiClient(),
        socketService: SocketService(),
        locationService: _NoGpsLocation(),
        localStorage: LocalStorage(await SharedPreferences.getInstance()),
      );
    });

    tearDown(() async => sl.reset());

    Future<void> pumpOffer(WidgetTester tester, Map<String, dynamic> json) async {
      driver.debugSetPendingOfferForTest(Order.fromJson(json));
      await tester.pumpWidget(
        ChangeNotifierProvider<DriverProvider>.value(
          value: driver,
          child: const MaterialApp(home: OrderOfferScreen()),
        ),
      );
      await tester.pump();
    }

    testWidgets('masofa va vaqt ko\'rinadi', (tester) async {
      await pumpOffer(tester, _json(tripKm: 4.2, tripMin: 11));
      expect(find.textContaining('4.2 km'), findsOneWidget);
      expect(find.text('Safar'), findsOneWidget);
    });

    testWidgets('taksometrda (manzilsiz) qator chizilmaydi', (tester) async {
      await pumpOffer(tester, _json(tripKm: 0, metered: true));
      expect(find.text('Safar'), findsNothing);
    });
  });
}
