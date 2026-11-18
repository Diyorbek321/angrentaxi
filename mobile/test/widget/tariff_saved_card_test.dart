// Tarif ekranidagi "Karta" chipi va saqlangan kartalar (spec saqlangan-kartalar v2).
//
// Asosiy qoida: buyurtma serverga `paymentMethod: card` bo'lib FAQAT asosiy
// karta bog'langan bo'lsa ketadi — shunda server safar oxirida o'zi yechadi.
// Funksiya o'chiq bo'lsa eski xulq o'zgarmaydi (`paymentMethod` yuborilmaydi).
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/payments/saved_cards_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/tariff_select_screen.dart';
import 'package:angren_taxi/features/payments/state/saved_cards_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

class _MockDio extends Mock implements Dio {}

class FakeRouteService implements RouteService {
  @override
  Future<RouteResult?> getRoute(LatLng from, LatLng to, {List<LatLng> waypoints = const []}) async => null;
}

Response<dynamic> _json(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

void main() {
  setUpAll(() async {
    registerFallbackValue(<String, dynamic>{});
    await initializeDateFormatting('uz', null);
  });

  late MockApiClient api;
  late OrderProvider orderProvider;
  late SavedCardsProvider cardsProvider;

  const tariffJson = {
    'id': 'tariff-1',
    'name': 'Standard',
    'basePrice': 3000,
    'pricePerKm': 1500,
    'minPrice': 5000,
    'surgeMultiplier': 1,
    'isActive': true,
  };

  final orderJson = {
    'id': 'order-1',
    'passengerId': 'p-1',
    'pickup': {'address': 'Pickup', 'lat': 40.75, 'lng': 72.34},
    'dropoff': {'address': 'Dropoff', 'lat': 40.76, 'lng': 72.35},
    'status': 'searching',
    'estimatedPrice': 18000.0,
    'createdAt': '2026-11-11T10:00:00.000Z',
  };

  void stubCards({required bool enabled, List<Map<String, dynamic>> cards = const []}) {
    when(() => api.get(ApiEndpoints.savedCardsAvailability)).thenAnswer((_) async => _json(
          ApiEndpoints.savedCardsAvailability,
          enabled
              ? {'enabled': true, 'merchantId': 'mid', 'apiUrl': 'https://checkout.test.paycom.uz/api'}
              : {'enabled': false},
        ));
    when(() => api.get(ApiEndpoints.savedCards)).thenAnswer((_) async => _json(ApiEndpoints.savedCards, cards));
  }

  setUp(() {
    api = MockApiClient();
    orderProvider = OrderProvider(apiClient: api, socketService: SocketService());
    cardsProvider = SavedCardsProvider(service: SavedCardsService(apiClient: api, paymeDio: _MockDio()));
    sl.registerLazySingleton<RouteService>(() => FakeRouteService());

    when(() => api.get('${ApiEndpoints.tariffs}?serviceType=taxi'))
        .thenAnswer((_) async => _json(ApiEndpoints.tariffs, [tariffJson]));
    when(() => api.post(ApiEndpoints.estimatePrice, data: any(named: 'data')))
        .thenAnswer((_) async => _json(ApiEndpoints.estimatePrice, {'price': 18000}));
    when(() => api.post(ApiEndpoints.createOrder, data: any(named: 'data'), headers: any(named: 'headers')))
        .thenAnswer((_) async => _json(ApiEndpoints.createOrder, orderJson));

    orderProvider
      ..setPendingPickup(const OrderLocation(address: 'Pickup', lat: 40.75, lng: 72.34))
      ..setPendingDropoff(const OrderLocation(address: 'Dropoff', lat: 40.76, lng: 72.35));
  });

  tearDown(() {
    if (sl.isRegistered<RouteService>()) sl.unregister<RouteService>();
  });

  Future<void> pump(WidgetTester tester) async {
    tester.view.physicalSize = const Size(412 * 3, 915 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<OrderProvider>.value(value: orderProvider),
          ChangeNotifierProvider<SavedCardsProvider>.value(value: cardsProvider),
        ],
        child: MaterialApp(
          routes: {'/passenger/home': (_) => const Scaffold(body: Text('HOME'))},
          home: TariffSelectScreen(paymentService: PaymentService(apiClient: api)),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Map<String, dynamic> sentOrderBody() => verify(() => api.post(
        ApiEndpoints.createOrder,
        data: captureAny(named: 'data'),
        headers: any(named: 'headers'),
      )).captured.single as Map<String, dynamic>;

  testWidgets('saved default card: chip shows it, order goes as card, no checkout page', (tester) async {
    stubCards(enabled: true, cards: [
      {'id': 'c1', 'maskedPan': '8600 **** **** 6311', 'cardBrand': 'uzcard', 'isDefault': true},
    ]);
    await pump(tester);

    expect(find.text('Karta •• 6311'), findsOneWidget);
    await tester.tap(find.text('Karta •• 6311'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Buyurtma'));
    await tester.pumpAndSettle();

    expect(sentOrderBody()['paymentMethod'], 'card');
    verifyNever(() => api.post(any(that: startsWith(ApiEndpoints.paymentsInitiate)), data: any(named: 'data')));
  });

  testWidgets('feature disabled: card chip keeps the old flow and sends no paymentMethod', (tester) async {
    stubCards(enabled: false);
    when(() => api.post(any(that: startsWith(ApiEndpoints.paymentsInitiate)), data: any(named: 'data')))
        .thenThrow(Exception('not completed'));
    await pump(tester);

    await tester.tap(find.text('Karta'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Buyurtma'));
    await tester.pumpAndSettle();

    expect(sentOrderBody().containsKey('paymentMethod'), isFalse);
  });

  testWidgets('cash never sends card, even with a saved card', (tester) async {
    stubCards(enabled: true, cards: [
      {'id': 'c1', 'maskedPan': '8600 **** **** 6311', 'cardBrand': 'uzcard', 'isDefault': true},
    ]);
    await pump(tester);

    await tester.tap(find.text('Buyurtma'));
    await tester.pumpAndSettle();

    expect(sentOrderBody().containsKey('paymentMethod'), isFalse);
  });

  testWidgets('enabled but no card: tapping the card chip opens card binding', (tester) async {
    stubCards(enabled: true);
    await pump(tester);

    await tester.tap(find.text('Karta'));
    await tester.pumpAndSettle();

    expect(find.text('Karta raqami'), findsOneWidget);
  });
}
