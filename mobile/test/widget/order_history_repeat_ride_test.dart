// Widget test for the "Safarni takrorlash" (repeat this ride) action added
// to OrderHistoryScreen (mobile/lib/features/passenger/screens/order_history_screen.dart).
//
// Mocks `ApiClient` (dio) directly with mocktail, same pattern as
// test/widget/checkout_payment_test.dart — no real network call is made.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/order_history_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, Map<String, dynamic> data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // OrderHistoryScreen renders dates through Formatters, which needs the 'uz'
  // locale data loaded first — same setUpAll the other date-rendering widget
  // tests use (see notifications_screen_test.dart).
  setUpAll(() async {
    await initializeDateFormatting('uz', null);
  });

  late MockApiClient apiClient;
  late OrderProvider orderProvider;

  const completedOrderJson = {
    'id': 'order-completed-1',
    'passengerId': 'passenger-1',
    'pickup': {
      'address': 'Angren, Bobur ko\'chasi, 10',
      'lat': 41.0167,
      'lng': 70.1436,
    },
    'dropoff': {
      'address': 'Angren, Mustaqillik maydoni',
      'lat': 41.0200,
      'lng': 70.1500,
    },
    'status': 'completed',
    'estimatedPrice': 25000.0,
    'finalPrice': 25000.0,
    'createdAt': '2026-07-10T10:00:00.000Z',
  };

  const cancelledOrderJson = {
    'id': 'order-cancelled-1',
    'passengerId': 'passenger-1',
    'pickup': {
      'address': 'Angren, Beruniy ko\'chasi, 5',
      'lat': 41.0100,
      'lng': 70.1400,
    },
    'dropoff': {
      'address': 'Angren, Amir Temur ko\'chasi, 1',
      'lat': 41.0250,
      'lng': 70.1550,
    },
    'status': 'cancelled',
    'estimatedPrice': 18000.0,
    'createdAt': '2026-07-09T10:00:00.000Z',
  };

  setUp(() {
    apiClient = MockApiClient();
    orderProvider = OrderProvider(
      apiClient: apiClient,
      socketService: SocketService(),
    );

    when(() => apiClient.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.orderHistory, {
        'orders': [completedOrderJson, cancelledOrderJson],
        'total': 2,
        'page': 1,
        'limit': 20,
      }),
    );
  });

  Future<void> pumpOrderHistory(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<OrderProvider>.value(
        value: orderProvider,
        child: MaterialApp(
          home: const OrderHistoryScreen(),
          routes: {
            '/passenger/tariff': (_) =>
                const Scaffold(body: Text('Tariff Select Screen')),
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'shows "Safarni takrorlash" only for completed orders, not cancelled',
    (tester) async {
      await pumpOrderHistory(tester);

      expect(find.text('Safarni takrorlash'), findsOneWidget);
    },
  );

  testWidgets(
    'tapping "Safarni takrorlash" sets pendingPickup/pendingDropoff and navigates to tariff screen',
    (tester) async {
      await pumpOrderHistory(tester);

      expect(orderProvider.pendingPickup, isNull);
      expect(orderProvider.pendingDropoff, isNull);

      await tester.tap(find.text('Safarni takrorlash'));
      await tester.pumpAndSettle();

      expect(orderProvider.pendingPickup?.address, "Angren, Bobur ko'chasi, 10");
      expect(
        orderProvider.pendingDropoff?.address,
        'Angren, Mustaqillik maydoni',
      );

      expect(find.text('Tariff Select Screen'), findsOneWidget);
    },
  );
}
