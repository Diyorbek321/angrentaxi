// Widget tests for the real Payme/Click/Uzcard checkout wiring added to
// CheckoutScreen (mobile/lib/features/superapp/screens/checkout_screen.dart).
//
// These tests mock `ApiClient` (dio) directly with mocktail — no real
// network call is made — and inject a fake `openPaymentCheckout` callback so
// the test never has to construct a real `webview_flutter` platform view
// (which isn't available under plain `flutter test`).
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/checkout_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Avoids pulling in the real geolocator platform channel (unavailable
/// under `flutter test`) — the checkout flow just needs *some* coordinates
/// to hand the courier.
class FakeLocationService extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => Position(
        latitude: 40.7500,
        longitude: 72.3400,
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

Response<dynamic> _jsonResponse(String path, Map<String, dynamic> data, {int statusCode = 200}) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: statusCode,
  );
}

Response<dynamic> _jsonListResponse(String path, List<dynamic> data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

DioException _badRequest(String path, String message) {
  return DioException(
    requestOptions: RequestOptions(path: path),
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      statusCode: 400,
      data: {'success': false, 'message': message},
    ),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue(<String, dynamic>{});
  });

  late MockApiClient apiClient;
  late SuperappProvider superapp;
  late MarketProvider market;
  late FoodProvider food;

  const storeJson = {
    'id': 'store-1',
    'name': "Angren bozor",
    'address': 'Markaziy ko\'cha',
    'deliveryMode': 'platform',
    'workingHoursStart': '08:00',
    'workingHoursEnd': '22:00',
  };

  const marketOrderJson = {
    'id': 'order-1',
    'storeId': 'store-1',
    'status': 'new',
    'items': <dynamic>[],
    'deliveryAddress': "Navoiy ko'chasi, 12",
    'totalPrice': 27000.0,
    'createdAt': '2026-07-13T10:00:00.000Z',
  };

  setUp(() {
    apiClient = MockApiClient();
    superapp = SuperappProvider();
    market = MarketProvider(apiClient: apiClient, socketService: SocketService());
    food = FoodProvider(apiClient: apiClient, socketService: SocketService());

    superapp.setActiveContext('market', 'store-1');
    superapp.addToCart(const CartItem(
      id: 'p1',
      name: 'Non',
      price: 20000,
      qty: 1,
      icon: Icons.shopping_bag,
      color: Colors.blue,
    ));

    // Stub loadStore()'s two GETs so MarketProvider.createOrder() (which
    // requires a loaded store) succeeds.
    when(() => apiClient.get('/market/stores'))
        .thenAnswer((_) async => _jsonListResponse('/market/stores', [storeJson]));
    when(() => apiClient.get('/market/stores/store-1'))
        .thenAnswer((_) async => _jsonResponse('/market/stores/store-1', {
              'store': storeJson,
              'categories': <dynamic>[],
              'products': <dynamic>[],
            }));

    when(() => apiClient.post('/market/orders', data: any(named: 'data')))
        .thenAnswer((_) async => _jsonResponse('/market/orders', marketOrderJson));
  });

  Future<void> pumpCheckout(
    WidgetTester tester, {
    PaymentService? paymentService,
    OpenPaymentCheckout? openPaymentCheckout,
  }) async {
    await market.loadStore();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<SuperappProvider>.value(value: superapp),
          ChangeNotifierProvider<MarketProvider>.value(value: market),
          ChangeNotifierProvider<FoodProvider>.value(value: food),
        ],
        child: MaterialApp(
          home: CheckoutScreen(
            paymentService: paymentService ?? PaymentService(apiClient: apiClient),
            locationService: FakeLocationService(),
            openPaymentCheckout: openPaymentCheckout,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> selectCardPayment(WidgetTester tester) async {
    expect(find.text('Naqd pul'), findsOneWidget);
    await tester.tap(find.text("To'lov usuli"));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Karta (Payme / Click)'));
    await tester.pumpAndSettle();
    expect(find.text('Karta (Payme / Click)'), findsOneWidget);
  }

  testWidgets(
    'selecting Karta and confirming calls POST /payments/initiate with the order id',
    (tester) async {
      when(() => apiClient.post(
            any(that: contains('/payments/initiate')),
            data: any(named: 'data'),
          )).thenAnswer((_) async => _jsonResponse(
            '/payments/initiate',
            {'url': 'https://checkout.payme.uz/abc123', 'id': 'txn-1', 'provider': 'payme'},
          ));

      String? openedUrl;
      await pumpCheckout(
        tester,
        openPaymentCheckout: (context, result) async {
          openedUrl = result.url;
          return true;
        },
      );

      await selectCardPayment(tester);

      await tester.tap(find.text('Buyurtmani tasdiqlash'));
      await tester.pumpAndSettle();

      final captured = verify(() => apiClient.post(
            captureAny(that: contains('/payments/initiate')),
            data: captureAny(named: 'data'),
          )).captured;
      expect(captured[0], '/payments/initiate?provider=payme');
      final body = captured[1] as Map<String, dynamic>;
      expect(body['orderId'], 'order-1');
      expect(body['method'], 'card');

      expect(openedUrl, 'https://checkout.payme.uz/abc123');
    },
  );

  testWidgets(
    'a successful /payments/initiate response opens the checkout webview with the returned URL',
    (tester) async {
      when(() => apiClient.post(
            any(that: contains('/payments/initiate')),
            data: any(named: 'data'),
          )).thenAnswer((_) async => _jsonResponse(
            '/payments/initiate',
            {'url': 'https://checkout.click.uz/xyz789', 'id': 'txn-2', 'provider': 'click'},
          ));

      var opened = false;
      PaymentInitiateResult? openedResult;
      await pumpCheckout(
        tester,
        openPaymentCheckout: (context, result) async {
          opened = true;
          openedResult = result;
          return true;
        },
      );

      await selectCardPayment(tester);
      await tester.tap(find.text('Buyurtmani tasdiqlash'));
      await tester.pumpAndSettle();

      expect(opened, isTrue);
      expect(openedResult?.url, 'https://checkout.click.uz/xyz789');
      expect(openedResult?.provider, 'click');

      // Order flow completes and the passenger is taken off checkout.
      expect(find.text('Rasmiylashtirish'), findsNothing);
    },
  );

  testWidgets(
    'a failed /payments/initiate response shows a clear error and keeps the passenger on checkout',
    (tester) async {
      when(() => apiClient.post(
            any(that: contains('/payments/initiate')),
            data: any(named: 'data'),
          )).thenThrow(_badRequest(
        '/payments/initiate',
        'Order must be completed before payment',
      ));

      var openedCalled = false;
      await pumpCheckout(
        tester,
        openPaymentCheckout: (context, result) async {
          openedCalled = true;
          return true;
        },
      );

      await selectCardPayment(tester);
      await tester.tap(find.text('Buyurtmani tasdiqlash'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Order must be completed before payment'),
        findsOneWidget,
      );
      expect(openedCalled, isFalse);
      // Never made it to the webview step, and the passenger stays on
      // checkout to retry or switch to cash — cart is untouched.
      expect(find.text('Rasmiylashtirish'), findsOneWidget);
      expect(superapp.isCartEmpty, isFalse);
    },
  );

  testWidgets(
    'choosing cash (default) never calls /payments/initiate',
    (tester) async {
      await pumpCheckout(tester);

      await tester.tap(find.text('Buyurtmani tasdiqlash'));
      await tester.pumpAndSettle();

      verifyNever(() => apiClient.post(
            any(that: contains('/payments/initiate')),
            data: any(named: 'data'),
          ));
    },
  );
}
