// "Tez foyda" oqimlari ekranda:
//   • checkout'da saqlangan manzil bir bosishda nuqta + podyezdni to'ldiradi;
//   • joriy nuqtani "Ish" deb saqlash POST /users/favorite-addresses ga ketadi;
//   • tugagan ovqat buyurtmasi "Yana buyurtma qilish" — joriy narx bilan savatga;
//   • savatda "Bepul yetkazishgacha yana ..." ko'rsatkichi.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/favorites_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/checkout_screen.dart';
import 'package:angren_taxi/features/superapp/screens/orders_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/date_symbol_data_local.dart';
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
const _marketOrder = {
  'id': 'order-1',
  'storeId': 'store-1',
  'status': 'new',
  'items': <dynamic>[],
  'deliveryAddress': 'Angren',
  'totalPrice': 27000,
  'createdAt': '2026-10-16T10:00:00.000Z',
};
const _home = {
  'id': 'fav-home',
  'label': 'Uy',
  'address': "Bobur ko'chasi 10",
  'lat': 41.02,
  'lng': 70.16,
  'addressDetails': {'entrance': '2', 'floor': '4'},
};

void main() {
  late _MockApiClient api;
  late SuperappProvider superapp;
  late MarketProvider market;
  late FoodProvider food;
  late FavoritesProvider favorites;

  setUpAll(() async {
    registerFallbackValue(<String, dynamic>{});
    await initializeDateFormatting('uz', null);
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    api = _MockApiClient();
    superapp = SuperappProvider(apiClient: api);
    market = MarketProvider(apiClient: api, socketService: SocketService());
    food = FoodProvider(apiClient: api, socketService: SocketService());
    favorites = FavoritesProvider(apiClient: api);
    when(() => api.get(ApiEndpoints.marketStores)).thenAnswer((_) async => _ok([_store]));
    when(() => api.get(ApiEndpoints.marketStore('store-1'))).thenAnswer(
      (_) async => _ok({'store': _store, 'categories': <dynamic>[], 'products': <dynamic>[]}),
    );
    when(() => api.post(ApiEndpoints.marketOrders, data: any(named: 'data')))
        .thenAnswer((_) async => _ok(_marketOrder));
    when(() => api.get(ApiEndpoints.favoriteAddresses)).thenAnswer((_) async => _ok([_home]));
  });

  Widget harness(Widget home) => MultiProvider(
        providers: [
          ChangeNotifierProvider<SuperappProvider>.value(value: superapp),
          ChangeNotifierProvider<MarketProvider>.value(value: market),
          ChangeNotifierProvider<FoodProvider>.value(value: food),
          ChangeNotifierProvider<FavoritesProvider>.value(value: favorites),
          ChangeNotifierProvider<OrderProvider>(
            create: (_) => OrderProvider(apiClient: api, socketService: SocketService()),
          ),
        ],
        child: MaterialApp(home: home),
      );

  Future<void> pumpCheckout(WidgetTester tester) async {
    tester.view.physicalSize = const Size(393 * 3, 852 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    superapp.setActiveContext('market', 'store-1');
    superapp.addToCart(const CartItem(
      id: 'p1', name: 'Non', price: 20000, qty: 1, icon: Icons.shopping_bag, color: Colors.blue,
    ));
    await market.loadStore();
    await tester.pumpWidget(harness(CheckoutScreen(
      paymentService: PaymentService(apiClient: api),
      locationService: _FakeLocation(),
    )));
    await tester.pumpAndSettle();
  }

  testWidgets('saqlangan "Uy" bosilsa nuqta va podyezd buyurtmaga ketadi', (tester) async {
    await pumpCheckout(tester);
    expect(find.byKey(const ValueKey('saved-address-fav-home')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('saved-address-fav-home')));
    await tester.pumpAndSettle();
    expect(find.text("Bobur ko'chasi 10"), findsOneWidget);

    await tester.tap(find.text('Buyurtmani tasdiqlash'));
    await tester.pumpAndSettle();
    final body = verify(() => api.post(ApiEndpoints.marketOrders, data: captureAny(named: 'data')))
        .captured
        .single as Map<String, dynamic>;
    expect(body['deliveryLat'], 41.02);
    expect(body['deliveryLng'], 70.16);
    expect(body['addressDetails'], {'entrance': '2', 'floor': '4'});
  });

  testWidgets('joriy nuqtani "Ish" deb saqlash — tafsilotlari bilan', (tester) async {
    when(() => api.post(ApiEndpoints.favoriteAddresses, data: any(named: 'data'))).thenAnswer(
      (_) async => _ok({'id': 'fav-work', 'label': 'Ish', 'address': 'x', 'lat': 41.0, 'lng': 70.14}),
    );
    await pumpCheckout(tester);
    await tester.enterText(find.byKey(const ValueKey('addr-entrance')), '7');
    await tester.tap(find.byKey(const ValueKey('saved-address-save')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('address-label-Ish')));
    await tester.pumpAndSettle();

    final body = verify(() => api.post(ApiEndpoints.favoriteAddresses, data: captureAny(named: 'data')))
        .captured
        .single as Map<String, dynamic>;
    expect(body['label'], 'Ish');
    expect(body['lat'], 41.0);
    expect(body['addressDetails'], {'entrance': '7'});
    // Saqlangandan keyin nuqta saqlangan — "Saqlash" chipi yo'qoladi.
    expect(find.byKey(const ValueKey('saved-address-save')), findsNothing);
    expect(find.byKey(const ValueKey('saved-address-fav-work')), findsOneWidget);
  });

  testWidgets('tugagan ovqat buyurtmasi joriy narx bilan savatga qayta solinadi', (tester) async {
    when(() => api.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _ok({'orders': <dynamic>[], 'total': 0, 'page': 1, 'limit': 20}),
    );
    when(() => api.get(ApiEndpoints.marketOrders)).thenAnswer((_) async => _ok(<dynamic>[]));
    when(() => api.get(ApiEndpoints.foodOrders)).thenAnswer((_) async => _ok([
          {
            'id': 'food-done-1',
            'restaurantId': 'rest-1',
            'status': 'delivered',
            'items': [
              {'dishId': 'd1', 'name': 'Somsa', 'qty': 2, 'price': 10000},
              {'dishId': 'd-gone', 'name': 'Eski taom', 'qty': 1, 'price': 9000},
            ],
            'deliveryAddress': 'Navoiy 12',
            'totalPrice': 36000,
            'createdAt': '2026-10-10T10:00:00.000Z',
          },
        ]));
    when(() => api.get(ApiEndpoints.foodRestaurant('rest-1'))).thenAnswer((_) async => _ok({
          'restaurant': {'id': 'rest-1', 'name': 'Mix Burger', 'status': 'open'},
          'categories': <dynamic>[],
          'dishes': [
            {'id': 'd1', 'name': 'Somsa', 'price': 12000, 'finalPrice': 11000},
          ],
        }));

    await tester.pumpWidget(harness(const OrdersScreen(embedded: true)));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('order-card-reorder-food-done-1')));
    await tester.pumpAndSettle();

    expect(find.byType(CartScreen), findsOneWidget);
    expect(superapp.activeKind, 'food');
    expect(superapp.activeEntityId, 'rest-1');
    expect(superapp.cart.single.id, 'd1');
    expect(superapp.cart.single.qty, 2);
    expect(superapp.cart.single.price, 11000, reason: 'eski 10 000 emas — joriy aksiya narxi');
    expect(find.textContaining('1 ta mahsulot hozir'), findsOneWidget);
  });

  testWidgets('savatda bepul yetkazishgacha qolgan summa va "Bepul" qatori', (tester) async {
    superapp.debugSetDeliveryPricingForTest(deliveryFee: 7000, freeDeliveryFrom: 50000);
    superapp.setActiveContext('market', 'store-1');
    superapp.addToCart(const CartItem(
      id: 'p1', name: 'Non', price: 20000, qty: 2, icon: Icons.shopping_bag, color: Colors.blue,
    ));
    await tester.pumpWidget(harness(const CartScreen()));
    await tester.pumpAndSettle();
    expect(find.text('Bepul yetkazishgacha yana ${Formatters.formatSom(10000)}'), findsOneWidget);

    superapp.increment('p1');
    await tester.pumpAndSettle();
    expect(find.text('Yetkazish bepul!'), findsOneWidget);
    expect(find.text('Bepul'), findsOneWidget);
  });
}
