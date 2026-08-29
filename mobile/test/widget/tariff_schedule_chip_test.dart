// Tarif ekranidagi rejalashtirish chipi va uning CTA ga ta'siri.
//
// "Hozir" chipi tanlagichni ochadi; vaqt tanlangach chip o'sha vaqtni
// ko'rsatadi, CTA "Buyurtma" dan "Rejalashtirish" ga aylanadi va narx
// qotirilgani haqidagi banner paydo bo'ladi.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/tariff_select_screen.dart';
import 'package:angren_taxi/features/passenger/widgets/schedule_ride_sheet.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

/// `flutter test` ostida haqiqiy OSRM chaqiruvidan qochadi.
class FakeRouteService extends RouteService {
  @override
  Future<RouteResult?> getRoute(
    LatLng from,
    LatLng to, {
    List<LatLng> waypoints = const [],
  }) async =>
      null;
}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

void main() {
  setUpAll(() async {
    registerFallbackValue(<String, dynamic>{});
    await initializeDateFormatting('uz', null);
  });

  late MockApiClient apiClient;
  late OrderProvider orderProvider;

  const tariffJson = {
    'id': 'tariff-1',
    'name': 'Standard',
    'basePrice': 3000,
    'pricePerKm': 1500,
    'minPrice': 5000,
    'surgeMultiplier': 1,
    'isActive': true,
  };

  setUp(() {
    apiClient = MockApiClient();
    orderProvider =
        OrderProvider(apiClient: apiClient, socketService: SocketService());

    sl.registerLazySingleton<RouteService>(() => FakeRouteService());

    when(() => apiClient.get('${ApiEndpoints.tariffs}?serviceType=taxi'))
        .thenAnswer((_) async =>
            _jsonResponse(ApiEndpoints.tariffs, [tariffJson]));
    when(() => apiClient.post(ApiEndpoints.estimatePrice, data: any(named: 'data')))
        .thenAnswer((_) async =>
            _jsonResponse(ApiEndpoints.estimatePrice, {'price': 18000}));

    orderProvider.setPendingPickup(
      const OrderLocation(address: 'Pickup', lat: 40.75, lng: 72.34),
    );
    orderProvider.setPendingDropoff(
      const OrderLocation(address: 'Dropoff', lat: 40.76, lng: 72.35),
    );
  });

  tearDown(() {
    if (sl.isRegistered<RouteService>()) {
      sl.unregister<RouteService>();
    }
  });

  Future<void> pumpTariffScreen(WidgetTester tester) async {
    // ⚠️ TELEFON O'LCHAMI MAJBURIY. `flutter test` ning standart oynasi
    // 800x600 — bu 720dp dan keng, ya'ni `AdaptiveMapPanel` pastdagi sheet
    // emas, CHAP YON PANEL bo'lib chiziladi va uchinchi chip panel
    // ko'rinish maydonidan tashqarida qolib, bosilmaydi (`find.text` uni
    // baribir topadi — shuning uchun bu jimgina o'tib ketadigan tuzoq).
    tester.view.physicalSize = const Size(412 * 3, 915 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ChangeNotifierProvider<OrderProvider>.value(
        value: orderProvider,
        child: MaterialApp(
          home: TariffSelectScreen(
            paymentService: PaymentService(apiClient: apiClient),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('boshlang\'ich holatda chip "Hozir", CTA "Buyurtma"', (tester) async {
    await pumpTariffScreen(tester);

    expect(find.text('Hozir'), findsOneWidget);
    expect(find.text('Buyurtma'), findsOneWidget);
    expect(find.text('Rejalashtirish'), findsNothing);
  });

  testWidgets('chip bosilganda rejalashtirish tanlagichi ochiladi', (tester) async {
    await pumpTariffScreen(tester);

    await tester.tap(find.text('Hozir'));
    await tester.pumpAndSettle();

    expect(find.byType(ScheduleRideSheet), findsOneWidget);
    expect(find.text('Safarni rejalashtirish'), findsOneWidget);
  });

  testWidgets('vaqt tanlangach chip, CTA va banner o\'zgaradi', (tester) async {
    await pumpTariffScreen(tester);

    final when = DateTime.now().add(const Duration(hours: 3));
    orderProvider.setScheduledAt(when);
    await tester.pumpAndSettle();

    // Chip endi tanlangan vaqtni ko'rsatadi.
    expect(find.text(Formatters.formatScheduleLabel(when)), findsOneWidget);
    expect(find.text('Hozir'), findsNothing);

    // CTA matni o'zgaradi — foydalanuvchi nima bo'lishini oldindan biladi.
    expect(find.text('Rejalashtirish'), findsOneWidget);
    expect(find.text('Buyurtma'), findsNothing);

    // Narx qoidasi ochiq aytiladi.
    expect(
      find.textContaining("Narx hozir qotiriladi"),
      findsOneWidget,
    );
  });

  testWidgets('"hozir" ga qaytarilganda CTA ham qaytadi', (tester) async {
    await pumpTariffScreen(tester);

    orderProvider.setScheduledAt(DateTime.now().add(const Duration(hours: 3)));
    await tester.pumpAndSettle();
    expect(find.text('Rejalashtirish'), findsOneWidget);

    orderProvider.setScheduledAt(null);
    await tester.pumpAndSettle();

    expect(find.text('Buyurtma'), findsOneWidget);
    expect(find.text('Hozir'), findsOneWidget);
    expect(find.textContaining('Narx hozir qotiriladi'), findsNothing);
  });

  testWidgets('rejalashtirilmagan holatda banner ko\'rinmaydi', (tester) async {
    await pumpTariffScreen(tester);

    expect(find.textContaining('Narx hozir qotiriladi'), findsNothing);
  });

  testWidgets('uchala chip ham ko\'rinadi va bosiladi', (tester) async {
    // Uchinchi chip qo'shilgach qator toshib ketmasligi kerak — shuning
    // uchun qator gorizontal skrollga o'ralgan.
    await pumpTariffScreen(tester);

    expect(tester.takeException(), isNull);
    for (final label in ['Naqd', 'Karta', 'Hozir']) {
      expect(find.text(label), findsOneWidget);
      expect(
        find.text(label).hitTestable(),
        findsOneWidget,
        reason: '"$label" chipi bosilmaydi — qator kesilib qolgan',
      );
    }
  });
}
