// Widget test for demand-surge pricing display on the tariff-select screen.
// The backend already computes and returns `surgeMultiplier` on every
// tariff (GET /tariffs, e.g. "surgeMultiplier":1) — this asserts the
// horizontal tariff card (_TariffCardH) surfaces it to the passenger with a
// small "xN" badge + "Talab yuqori" label when surgeMultiplier > 1.0, and
// shows nothing extra (today's normal look) when it's 1.0.
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

/// Avoids any real OSRM network call under `flutter test` — the tariff
/// screen falls back to a straight-line route/distance when this returns
/// null, which is all the test needs.
class FakeRouteService extends RouteService {
  @override
  Future<RouteResult?> getRoute(
    LatLng from,
    LatLng to, {
    List<LatLng> waypoints = const [],
  }) async =>
      null;
}

Response<dynamic> _jsonResponse(String path, dynamic data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue(<String, dynamic>{});
  });

  late MockApiClient apiClient;
  late OrderProvider orderProvider;

  const surgedTariffJson = {
    'id': 'tariff-surge',
    'name': 'Standard',
    'basePrice': 3000,
    'pricePerKm': 1500,
    'minPrice': 5000,
    'surgeMultiplier': 1.5,
    'isActive': true,
  };

  const normalTariffJson = {
    'id': 'tariff-normal',
    'name': 'Comfort',
    'basePrice': 5000,
    'pricePerKm': 2000,
    'minPrice': 8000,
    'surgeMultiplier': 1,
    'isActive': true,
  };

  setUp(() {
    apiClient = MockApiClient();
    orderProvider = OrderProvider(apiClient: apiClient, socketService: SocketService());

    sl.registerLazySingleton<RouteService>(() => FakeRouteService());

    when(() => apiClient.get('${ApiEndpoints.tariffs}?serviceType=taxi'))
        .thenAnswer((_) async => _jsonResponse(
              ApiEndpoints.tariffs,
              [surgedTariffJson, normalTariffJson],
            ));
    when(() => apiClient.post(ApiEndpoints.estimatePrice, data: any(named: 'data')))
        .thenAnswer((_) async => _jsonResponse(ApiEndpoints.estimatePrice, {'price': 6500}));

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

  testWidgets(
    'shows a surge badge + "Talab yuqori" for a tariff with surgeMultiplier > 1, '
    'and nothing extra for one at 1.0',
    (tester) async {
      await pumpTariffScreen(tester);

      // Surged tariff: "x1.5" badge + warning label appear.
      expect(find.text('x1.5'), findsOneWidget);
      expect(find.text('Talab yuqori'), findsOneWidget);
    },
  );

  testWidgets(
    'a tariff list with only surgeMultiplier == 1.0 shows no surge badge at all',
    (tester) async {
      when(() => apiClient.get('${ApiEndpoints.tariffs}?serviceType=taxi'))
          .thenAnswer((_) async => _jsonResponse(
                ApiEndpoints.tariffs,
                [normalTariffJson],
              ));

      await pumpTariffScreen(tester);

      expect(find.textContaining('x1'), findsNothing);
      expect(find.text('Talab yuqori'), findsNothing);
    },
  );
}
