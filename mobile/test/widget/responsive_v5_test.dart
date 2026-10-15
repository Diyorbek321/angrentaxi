// Responsive audit (2026-10-16): yo'lovchi ekranlari 360×640 (kichik),
// 393×852 (oddiy) va 900×1200 (planshet) da, matn 1.3x gacha kattalashganda
// TOSHMASLIGI kerak. Har bir ekran "RenderFlex overflowed" yoki boshqa
// layout xatosiz qurilishi tekshiriladi (flutter_test bunday xatoni testni
// yiqituvchi istisno sifatida yozadi).
//
// Shu yerda yana:
//   • restoran menyusi 360dp da 2 ustunli to'r, alohida kategoriya bo'limlari
//     va yopishqoq chiplar (chip bosilsa bo'limga aylanadi);
//   • "qora chaqnash" regressiyasi — sahifa o'tishining HECH BIR kadrida
//     ikkala sahifa birdaniga shaffof bo'lmaydi.
import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/notifications/notifications_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/checkout_screen.dart';
import 'package:angren_taxi/features/superapp/screens/food_list_screen.dart';
import 'package:angren_taxi/features/superapp/screens/home_tab.dart';
import 'package:angren_taxi/features/superapp/screens/market_screen.dart';
import 'package:angren_taxi/features/superapp/screens/order_status_screen.dart';
import 'package:angren_taxi/features/superapp/screens/orders_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/screens/vendor_order_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _NoLocation extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => null;
}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: ''),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

const _sizes = <String, Size>{
  'small 360x640': Size(360, 640),
  'normal 393x852': Size(393, 852),
  'tablet 900x1200': Size(900, 1200),
};

Map<String, dynamic> _restaurant(String id) => {
      'id': id,
      'name': 'Osh Markazi juda uzun nomli restoran $id',
      'address': "Angren, Navoiy ko'chasi 12, 3-mavze, mo'ljal: bozor",
      'status': 'open',
      'activePromotion': {'title': 'Kuzgi chegirma — barcha osh', 'discountType': 'percent', 'discountValue': 20},
    };

Map<String, dynamic> _detail() => {
      'restaurant': _restaurant('rest-1'),
      'promotions': [
        {'title': 'Palov kuni', 'discountType': 'percent', 'discountValue': 15, 'minOrderAmount': 100000},
      ],
      'categories': [
        {'id': 'c1', 'name': 'Milliy taomlar', 'sortOrder': 1, 'itemCount': 6},
        {'id': 'c2', 'name': 'Salatlar', 'sortOrder': 2, 'itemCount': 6},
        {'id': 'c3', 'name': 'Ichimliklar', 'sortOrder': 3, 'itemCount': 6},
      ],
      'dishes': [
        for (var c = 1; c <= 3; c++)
          for (var i = 0; i < 6; i++)
            {
              'id': 'd$c-$i',
              'categoryId': 'c$c',
              'name': 'Taom $c-$i juda uzun nom bilan ikki qatorga',
              'price': 32000,
              if (i.isEven) 'finalPrice': 25600,
              if (i.isEven) 'discount': {'title': 'Kuz', 'discountType': 'percent', 'discountValue': 20},
            },
      ],
    };

const _deals = [
  {
    'id': 'p1',
    'title': '−30% barcha palovga, faqat bugun',
    'description': 'Restoran sovg\'asi',
    'discountType': 'percent',
    'discountValue': 30,
    'vendorType': 'restaurant',
    'vendorId': 'rest-1',
    'vendorName': 'Osh Markazi',
    'endsAt': '2026-10-30T00:00:00.000Z',
  },
];

Map<String, dynamic> _foodOrder(String status) => {
      'id': 'o1-abcdef',
      'restaurantId': 'rest-1',
      'status': status,
      'items': [
        {'dishId': 'd', 'name': 'Osh juda uzun nom bilan', 'qty': 2, 'price': 25600},
      ],
      'deliveryAddress': "Angren, Navoiy ko'chasi 12, 3-mavze",
      'totalPrice': 58200,
      'payableTotal': 55000,
      'promoCode': 'ANGREN',
      'promoDiscount': 3200,
      'promotionDiscount': 12800,
      'canCancel': status == 'new',
      'createdAt': '2026-10-16T10:00:00.000Z',
      'addressDetails': {
        'entrance': '2',
        'floor': '4',
        'apartment': '41',
        'intercom': '41K',
        'landmark': 'Maktab yonida, yashil darvoza',
        'courierNote': 'Kelganda qo\'ng\'iroq qiling, bola uxlayapti',
      },
    };

void main() {
  late _MockApiClient api;
  late FoodProvider food;
  late MarketProvider market;
  late SuperappProvider superapp;
  late OrderProvider orders;
  late NotificationsProvider notifications;

  setUpAll(() async {
    registerFallbackValue(<String, dynamic>{});
    await initializeDateFormatting('uz');
  });

  setUp(() {
    api = _MockApiClient();
    when(() => api.get(any(), params: any(named: 'params'))).thenAnswer((_) async => _ok(<dynamic>[]));
    when(() => api.get(any())).thenAnswer((_) async => _ok(<dynamic>[]));
    when(() => api.get(ApiEndpoints.foodRestaurants))
        .thenAnswer((_) async => _ok([_restaurant('rest-1'), _restaurant('rest-2')]));
    when(() => api.get(ApiEndpoints.foodRestaurant('rest-1'))).thenAnswer((_) async => _ok(_detail()));
    when(() => api.get(ApiEndpoints.activePromotions, params: any(named: 'params')))
        .thenAnswer((_) async => _ok(_deals));
    when(() => api.get(ApiEndpoints.orderHistory)).thenAnswer((_) async => _ok({'orders': <dynamic>[]}));
    when(() => api.get(ApiEndpoints.foodOrders)).thenAnswer((_) async => _ok([_foodOrder('new')]));
    when(() => api.get(ApiEndpoints.marketStores))
        .thenAnswer((_) async => _ok([{'id': 's1', 'name': 'Angren Market'}]));
    when(() => api.get(ApiEndpoints.marketStore('s1'))).thenAnswer((_) async => _ok({
          'store': {'id': 's1', 'name': 'Angren Market'},
          'categories': [
            {'id': 'mc1', 'name': 'Sut mahsulotlari', 'emoji': '🥛'},
          ],
          'products': [
            for (var i = 0; i < 6; i++)
              {
                'id': 'p$i',
                'categoryId': 'mc1',
                'name': 'Sut 3.2% juda uzun nomli mahsulot $i',
                'price': 14000,
                'stock': 5,
                if (i.isOdd) 'finalPrice': 11900,
                if (i.isOdd) 'discount': {'title': 'Aksiya', 'discountType': 'percent', 'discountValue': 15},
              },
          ],
        }));
    final socket = SocketService();
    food = FoodProvider(apiClient: api, socketService: socket);
    market = MarketProvider(apiClient: api, socketService: socket);
    superapp = SuperappProvider(apiClient: api);
    orders = OrderProvider(apiClient: api, socketService: socket);
    notifications = NotificationsProvider(apiClient: api);
  });

  Future<void> pumpAt(WidgetTester tester, Size size, Widget home, {double textScale = 1.3}) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<FoodProvider>.value(value: food),
          ChangeNotifierProvider<MarketProvider>.value(value: market),
          ChangeNotifierProvider<SuperappProvider>.value(value: superapp),
          ChangeNotifierProvider<OrderProvider>.value(value: orders),
          ChangeNotifierProvider<NotificationsProvider>.value(value: notifications),
        ],
        child: MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          routes: {'/passenger/home': (_) => const Scaffold(body: Text('taxi'))},
          home: home,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1500));
  }

  final screens = <String, Widget Function()>{
    'home tab': () => const Scaffold(body: HomeTab()),
    'food list + deals': () => const FoodListScreen(),
    'restaurant menu grid': () => const RestaurantDetailScreen(restaurantId: 'rest-1'),
    'market': () => const MarketScreen(),
    'orders': () => const OrdersScreen(),
    'cart': () => const CartScreen(),
    'checkout (promo + address details)': () => CheckoutScreen(locationService: _NoLocation()),
    'order status + cancel': () => const OrderStatusScreen(orderId: 'o1-abcdef', paidOnline: false, kind: 'food'),
    'vendor order detail': () => const VendorOrderDetailScreen(kind: 'food', orderId: 'o1-abcdef'),
  };

  for (final size in _sizes.entries) {
    for (final screen in screens.entries) {
      testWidgets('${screen.key} — ${size.key}, matn 1.3x: toshish yo\'q', (tester) async {
        food.debugSetOrderHistory([FoodOrder.fromJson(_foodOrder('new'))]);
        superapp
          ..setActiveContext('food', 'rest-1')
          ..addToCart(const CartItem(
            id: 'd1', name: 'Osh juda uzun nom bilan ikki qatorga', price: 25600, qty: 2,
            icon: Icons.restaurant, color: Colors.orange,
          ));
        // Layout xatosi (toshish) bo'lsa flutter_test testni o'zi yiqitadi
        // va qaysi vidjet toshganini to'liq ko'rsatadi.
        await pumpAt(tester, size.value, screen.value());
        // Pastga aylantirib, ekran ostidagi qismlar ham quriladi.
        final scrollable = find.byType(Scrollable);
        if (scrollable.evaluate().isNotEmpty) {
          await tester.drag(scrollable.first, const Offset(0, -2000));
          await tester.pump(const Duration(milliseconds: 500));
        }
      });
    }
  }

  group('restoran menyusi', () {
    testWidgets('360dp: taomlar 2 ustunda, kategoriyalar alohida bo\'limlar', (tester) async {
      await pumpAt(tester, const Size(360, 640), const RestaurantDetailScreen(restaurantId: 'rest-1'),
          textScale: 1);

      final tiles = find.byType(DishTile);
      expect(tiles, findsWidgets);
      final first = tester.getRect(tiles.at(0));
      final second = tester.getRect(tiles.at(1));
      // Bir qatorda yonma-yon — bitta ustun EMAS.
      expect(second.top, closeTo(first.top, 0.5));
      expect(second.left, greaterThan(first.right));
      // Ikkalasi ham ekran kengligining yarmidan kichik.
      expect(first.width, lessThan(180));

      // Chiplar va bo'lim sarlavhalari.
      expect(find.byKey(const ValueKey('menu-category-chips')), findsOneWidget);
      expect(find.byKey(const ValueKey('menu-chip-c2')), findsOneWidget);
      expect(find.text('Milliy taomlar'), findsNWidgets(2)); // chip + sarlavha

      // Chegirmali taom: yangi narx va eski (chizilgan) narx.
      expect(find.byKey(const ValueKey('price-old')), findsWidgets);
    });

    testWidgets('chip bosilsa o\'sha bo\'limga aylanadi, chiplar tepada qoladi', (tester) async {
      await pumpAt(tester, const Size(360, 640), const RestaurantDetailScreen(restaurantId: 'rest-1'),
          textScale: 1);

      await tester.tap(find.byKey(const ValueKey('menu-chip-c2')));
      await tester.pumpAndSettle();

      final header = find.text('Salatlar');
      // Chip + bo'lim sarlavhasi — ikkalasi ham ko'rinmoqda.
      expect(header, findsNWidgets(2));
      final chipsBottom = tester.getRect(find.byKey(const ValueKey('menu-category-chips'))).bottom;
      final sectionTop = tester.getRect(header.last).top;
      expect(sectionTop, greaterThanOrEqualTo(chipsBottom - 1));
      expect(sectionTop, lessThan(chipsBottom + 80));
      expect(tester.getRect(find.byKey(const ValueKey('menu-category-chips'))).top, lessThan(100));
    });

    testWidgets('planshetda (900dp) 3+ ustun', (tester) async {
      await pumpAt(tester, const Size(900, 1200), const RestaurantDetailScreen(restaurantId: 'rest-1'),
          textScale: 1);
      final tiles = find.byType(DishTile);
      final tops = [for (var i = 0; i < 3; i++) tester.getRect(tiles.at(i)).top];
      expect(tops.toSet(), hasLength(1));
    });
  });

  testWidgets('food list: "Chegirmalar" lentasi eng tepada, restoran kartasida chegirma belgisi',
      (tester) async {
    await pumpAt(tester, const Size(393, 852), const FoodListScreen(), textScale: 1);
    final carousel = find.byKey(const ValueKey('deals-carousel'));
    expect(carousel, findsOneWidget);
    final firstCard = find.textContaining('Osh Markazi juda uzun nomli restoran rest-1');
    expect(tester.getRect(carousel).top, lessThan(tester.getRect(firstCard).top));
    expect(find.text('−20%'), findsWidgets);
  });

  group('qora chaqnash regressiyasi (sahifa o\'tishi)', () {
    testWidgets('o\'tishning hech bir kadrida ikkala sahifa birdaniga shaffof emas', (tester) async {
      final navKey = GlobalKey<NavigatorState>();
      await tester.pumpWidget(MaterialApp(
        navigatorKey: navKey,
        theme: ThemeData(platform: TargetPlatform.android, pageTransitionsTheme: kAppPageTransitions),
        home: const Scaffold(body: Text('A-page')),
      ));
      navKey.currentState!.push(MaterialPageRoute<void>(builder: (_) => const Scaffold(body: Text('B-page'))));
      await tester.pump();

      double visibility(String text) {
        var opacity = 1.0;
        for (final fade in tester.widgetList<FadeTransition>(
          find.ancestor(of: find.text(text), matching: find.byType(FadeTransition)),
        )) {
          opacity *= fade.opacity.value;
        }
        return opacity;
      }

      for (var ms = 0; ms <= 300; ms += 15) {
        await tester.pump(const Duration(milliseconds: 15));
        if (find.text('A-page').evaluate().isEmpty) break;
        final a = visibility('A-page');
        final b = visibility('B-page');
        // Ostidagi sahifa o'tish davomida to'liq ko'rinadi; ustidagisi esa
        // birinchi kadrlardanoq paydo bo'la boshlaydi — bo'sh (qora) kadr yo'q.
        expect(a, 1.0, reason: 'chiquvchi sahifa ${ms}ms da shaffoflashdi');
        if (ms >= 60) expect(b, greaterThan(0), reason: 'kiruvchi sahifa ${ms}ms da hali ko\'rinmaydi');
      }
      await tester.pumpAndSettle();
      expect(find.text('B-page'), findsOneWidget);
    });
  });
}
