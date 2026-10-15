// Checkout: promokod (spec v5 §2) va manzil tafsilotlari (§3).
//   • "Qo'llash" → POST /promo-codes/validate {code, amount, serviceType};
//   • chegirma qatori va kamaygan "Jami";
//   • 200 valid:false (PROMO_NOT_APPLICABLE) va HTTP 400 — ikkalasi ham aniq xato;
//   • buyurtma tanasida promoCode + addressDetails; bo'sh bo'lsa YUBORILMAYDI.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/checkout_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _FakeLocation extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => Position(
        latitude: 41.0,
        longitude: 70.14,
        timestamp: DateTime(2026, 10, 16),
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );
}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: ''),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

const _store = {'id': 'store-1', 'name': 'Bozor'};
const _order = {
  'id': 'order-1',
  'storeId': 'store-1',
  'status': 'new',
  'items': <dynamic>[],
  'deliveryAddress': 'Angren',
  'totalPrice': 27000,
  'payableTotal': 25000,
  'createdAt': '2026-10-16T10:00:00.000Z',
};

void main() {
  late _MockApiClient api;
  late SuperappProvider superapp;
  late MarketProvider market;

  setUpAll(() => registerFallbackValue(<String, dynamic>{}));

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    api = _MockApiClient();
    superapp = SuperappProvider(apiClient: api);
    market = MarketProvider(apiClient: api, socketService: SocketService());
    superapp.setActiveContext('market', 'store-1');
    superapp.addToCart(const CartItem(
      id: 'p1', name: 'Non', price: 20000, qty: 1, icon: Icons.shopping_bag, color: Colors.blue,
    ));
    when(() => api.get(ApiEndpoints.marketStores)).thenAnswer((_) async => _ok([_store]));
    when(() => api.get(ApiEndpoints.marketStore('store-1'))).thenAnswer(
      (_) async => _ok({'store': _store, 'categories': <dynamic>[], 'products': <dynamic>[]}),
    );
    when(() => api.post(ApiEndpoints.marketOrders, data: any(named: 'data')))
        .thenAnswer((_) async => _ok(_order));
    await market.loadStore();
  });

  Future<void> pump(WidgetTester tester) async {
    tester.view.physicalSize = const Size(393 * 3, 852 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<SuperappProvider>.value(value: superapp),
          ChangeNotifierProvider<MarketProvider>.value(value: market),
          ChangeNotifierProvider<FoodProvider>(
            create: (_) => FoodProvider(apiClient: api, socketService: SocketService()),
          ),
        ],
        child: MaterialApp(
          home: CheckoutScreen(
            paymentService: PaymentService(apiClient: api),
            locationService: _FakeLocation(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> enterPromo(WidgetTester tester, String code) async {
    await tester.ensureVisible(find.byKey(const ValueKey('promo-input')));
    await tester.enterText(find.byKey(const ValueKey('promo-input')), code);
    await tester.tap(find.text("Qo'llash"));
    await tester.pumpAndSettle();
  }

  testWidgets('promokod qo\'llanadi: chegirma qatori va Jami kamayadi, buyurtmaga ketadi',
      (tester) async {
    when(() => api.post(ApiEndpoints.validatePromo, data: any(named: 'data'))).thenAnswer(
      (_) async => _ok({
        'valid': true,
        'code': 'ANGREN',
        'discountType': 'fixed',
        'discountValue': 2000,
        'discountAmount': 2000,
      }),
    );
    await pump(tester);
    await enterPromo(tester, 'angren');

    final body = verify(() => api.post(ApiEndpoints.validatePromo, data: captureAny(named: 'data')))
        .captured
        .single as Map<String, dynamic>;
    expect(body['code'], 'ANGREN');
    expect(body['amount'], 20000);
    expect(body['serviceType'], 'market');

    expect(find.byKey(const ValueKey('promo-applied')), findsOneWidget);
    expect(find.byKey(const ValueKey('promo-discount-line')), findsOneWidget);
    // 20 000 + 7 000 yetkazish − 2 000.
    final total = tester.widget<Text>(find.byKey(const ValueKey('checkout-total')));
    expect(total.data, contains('25'));

    await tester.tap(find.text('Buyurtmani tasdiqlash'));
    await tester.pumpAndSettle();
    final orderBody = verify(() => api.post(ApiEndpoints.marketOrders, data: captureAny(named: 'data')))
        .captured
        .single as Map<String, dynamic>;
    expect(orderBody['promoCode'], 'ANGREN');
    expect(orderBody.containsKey('addressDetails'), isFalse);
  });

  testWidgets('valid:false PROMO_NOT_APPLICABLE va HTTP 400 — aniq xato, chegirma yo\'q',
      (tester) async {
    when(() => api.post(ApiEndpoints.validatePromo, data: any(named: 'data'))).thenAnswer(
      (_) async => _ok({'valid': false, 'code': 'PROMO_NOT_APPLICABLE', 'message': 'x'}),
    );
    await pump(tester);
    await enterPromo(tester, 'TAXI10');
    expect(find.text('Bu promokod ushbu xizmatga tegishli emas'), findsOneWidget);
    expect(find.byKey(const ValueKey('promo-discount-line')), findsNothing);

    when(() => api.post(ApiEndpoints.validatePromo, data: any(named: 'data'))).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ''),
        type: DioExceptionType.badResponse,
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: ''),
          statusCode: 400,
          data: {'success': false, 'message': 'Promo code has expired'},
        ),
      ),
    );
    await enterPromo(tester, 'OLD');
    expect(find.text('Promo code has expired'), findsOneWidget);
  });

  testWidgets('manzil tafsilotlari buyurtma tanasida addressDetails bo\'lib ketadi',
      (tester) async {
    await pump(tester);
    await tester.enterText(find.byKey(const ValueKey('addr-entrance')), '3');
    await tester.enterText(find.byKey(const ValueKey('addr-floor')), '5');
    await tester.enterText(find.byKey(const ValueKey('addr-apartment')), '41');
    await tester.ensureVisible(find.byKey(const ValueKey('addr-landmark')));
    await tester.enterText(find.byKey(const ValueKey('addr-landmark')), '  Maktab yonida ');
    await tester.pump();

    await tester.tap(find.text('Buyurtmani tasdiqlash'));
    await tester.pumpAndSettle();
    final orderBody = verify(() => api.post(ApiEndpoints.marketOrders, data: captureAny(named: 'data')))
        .captured
        .single as Map<String, dynamic>;
    expect(orderBody['addressDetails'], {
      'entrance': '3',
      'floor': '5',
      'apartment': '41',
      'landmark': 'Maktab yonida',
    });
    expect(orderBody.containsKey('promoCode'), isFalse);

    // Keyingi buyurtma uchun eslab qolinadi.
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('checkout.addressDetails'), contains('Maktab yonida'));
  });

  testWidgets('saqlangan tafsilotlar bilan oldindan to\'ldiriladi', (tester) async {
    SharedPreferences.setMockInitialValues({
      'checkout.addressDetails': '{"entrance":"7","intercom":"12K"}',
    });
    await pump(tester);
    expect(find.text("Oxirgi buyurtmadan to'ldirildi"), findsOneWidget);
    final entrance = tester.widget<TextField>(find.byKey(const ValueKey('addr-entrance')));
    expect(entrance.controller!.text, '7');
  });
}
