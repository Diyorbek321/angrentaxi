// Buyurtma so'rovi javobsiz qolsa (timeout), server uni baribir yaratgan
// bo'lishi mumkin. Provider buni tiklaganda yo'lovchi xato ko'rgan tarif
// ekranida qolib ketmasligi, kuzatuv (bosh) ekraniga o'tishi kerak —
// aks holda qidiruv yashirin davom etardi.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/tariff_select_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

/// `flutter test` ostida haqiqiy OSRM chaqiruvidan qochadi.
class FakeRouteService implements RouteService {
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

  Map<String, dynamic> orderJson() => {
        'id': 'order-1',
        'passengerId': 'p-1',
        'pickup': {'address': 'Pickup', 'lat': 40.75, 'lng': 72.34},
        'dropoff': {'address': 'Dropoff', 'lat': 40.76, 'lng': 72.35},
        'status': 'searching',
        'estimatedPrice': 18000.0,
        'createdAt': '2026-10-31T10:00:00.000Z',
      };

  Future<void> pumpTariffScreen(WidgetTester tester) async {
    tester.view.physicalSize = const Size(412 * 3, 915 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ChangeNotifierProvider<OrderProvider>.value(
        value: orderProvider,
        child: MaterialApp(
          routes: {'/passenger/home': (_) => const Scaffold(body: Text('HOME'))},
          home: TariffSelectScreen(
            paymentService: PaymentService(apiClient: apiClient),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  void stubCreateTimeout() {
    when(() => apiClient.post(ApiEndpoints.createOrder,
        data: any(named: 'data'), headers: any(named: 'headers'))).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
        type: DioExceptionType.receiveTimeout,
      ),
    );
  }

  testWidgets('timeout, lekin server yaratgan — kuzatuv ekraniga o‘tadi', (tester) async {
    OrderProvider.uncertainOrderRecheckDelay = Duration.zero;
    stubCreateTimeout();
    when(() => apiClient.get(ApiEndpoints.orderHistory)).thenAnswer((_) async =>
        _jsonResponse(ApiEndpoints.orderHistory, {'orders': [orderJson()], 'total': 1}));
    await pumpTariffScreen(tester);

    await tester.tap(find.text('Buyurtma'));
    await tester.pumpAndSettle();

    expect(find.text('HOME'), findsOneWidget);
    expect(orderProvider.hasActiveOrder, isTrue);
  });

  testWidgets('timeout va server ham yaratmagan — ekranda qoladi', (tester) async {
    OrderProvider.uncertainOrderRecheckDelay = Duration.zero;
    stubCreateTimeout();
    when(() => apiClient.get(ApiEndpoints.orderHistory)).thenAnswer((_) async =>
        _jsonResponse(ApiEndpoints.orderHistory, {'orders': <dynamic>[], 'total': 0}));
    await pumpTariffScreen(tester);

    await tester.tap(find.text('Buyurtma'));
    await tester.pumpAndSettle();

    expect(find.text('HOME'), findsNothing);
    expect(find.byType(TariffSelectScreen), findsOneWidget);
  });
}
