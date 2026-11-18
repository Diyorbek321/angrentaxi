// Mijoz tomoni — yetkazish hodisalari (docs/INCIDENT-POLICY.md §2):
//   * ovqat/market: topshirish kodi, "Kuryer eshik oldida", qaytarish kartasi
//     (to'lov + foiz izohi + kartaga qaytariladigan summa);
//   * provayder socket hodisalarini (returning/returned, dropoff_arrived) qo'llaydi;
//   * posilka formasi: qiymat va taqiqlangan narsalar tasdig'i majburiy;
//   * posilka yuboruvchisi: qaytarish kartasi va "Posilka qaytib keldi".
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/widgets/parcel_return_card.dart';
import 'package:angren_taxi/features/superapp/screens/cargo_screen.dart';
import 'package:angren_taxi/features/superapp/screens/parcel_screen.dart';
import 'package:angren_taxi/features/superapp/screens/vendor_order_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

Map<String, dynamic> _food(String status, {Map<String, dynamic>? delivery, Map<String, dynamic> extra = const {}}) => {
      'id': 'o1-abc',
      'restaurantId': 'r1',
      'status': status,
      'items': [
        {'dishId': 'd1', 'name': 'Osh', 'qty': 2, 'price': 25000},
      ],
      'deliveryAddress': "Navoiy ko'chasi 12",
      'totalPrice': 57000,
      'createdAt': '2026-11-03T10:00:00.000Z',
      if (delivery != null) 'delivery': delivery,
      ...extra,
    };

Response<dynamic> _ok(String path, Object data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Map<String, dynamic> _parcelRide({String status = 'in_progress', Map<String, dynamic> extra = const {}}) => {
      'id': 'ride-1',
      'passengerId': 'p-1',
      'pickup': const {'address': 'Uy', 'lat': 41.0, 'lng': 70.0},
      'dropoff': const {'address': 'Ish', 'lat': 41.1, 'lng': 70.1},
      'status': status,
      'estimatedPrice': 15000,
      'createdAt': '2026-11-03T10:00:00.000Z',
      'serviceType': 'parcel',
      'details': const {'recipientPhone': '+998901112233', 'itemDescription': 'Kalit', 'size': 'small'},
      ...extra,
    };

void main() {
  late _MockApiClient api;
  late FoodProvider food;

  setUpAll(() async {
    registerFallbackValue(<String, dynamic>{});
    await initializeDateFormatting('uz');
  });

  setUp(() {
    api = _MockApiClient();
    food = FoodProvider(apiClient: api, socketService: SocketService());
  });

  Future<void> pumpDetail(WidgetTester tester, Map<String, dynamic> json) async {
    food.debugSetOrderHistory([FoodOrder.fromJson(json)]);
    await tester.binding.setSurfaceSize(const Size(420, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<FoodProvider>.value(value: food),
          ChangeNotifierProvider<MarketProvider>(
            create: (_) => MarketProvider(apiClient: api, socketService: SocketService()),
          ),
        ],
        child: const MaterialApp(
          home: VendorOrderDetailScreen(kind: 'food', orderId: 'o1-abc'),
        ),
      ),
    );
    await tester.pump();
  }

  group('Ovqat/market tafsiloti', () {
    testWidgets('kuryer yo\'lda — "Kuryerga ayting" va kod', (tester) async {
      await pumpDetail(
        tester,
        _food('ready', delivery: {'orderId': 'ride-1', 'status': 'in_progress', 'handoverCode': '0427'}),
      );
      expect(find.text('Kuryerga ayting'), findsOneWidget);
      expect(find.text('0 4 2 7'), findsOneWidget);
      expect(find.text('Kuryer eshik oldida'), findsNothing);
    });

    testWidgets('kuryer manzilda — "Kuryer eshik oldida" + bepul kutish', (tester) async {
      await pumpDetail(
        tester,
        _food('ready', delivery: {
          'orderId': 'ride-1',
          'status': 'in_progress',
          'handoverCode': '0427',
          'dropoffArrivedAt': '2026-11-03T10:20:00.000Z',
        }),
      );
      expect(find.text('Kuryer eshik oldida'), findsOneWidget);
      expect(find.textContaining('5 daqiqa bepul'), findsOneWidget);
    });

    testWidgets('qaytarildi: to\'lov, foiz izohi, kartaga qaytariladigan summa', (tester) async {
      await pumpDetail(
        tester,
        _food('returned', extra: {'returnCharge': 10500, 'refundDue': 46500, 'refundStatus': 'pending'}),
      );
      expect(find.text('Buyurtma qaytarildi'), findsOneWidget);
      expect(find.textContaining("To'lanadi:"), findsOneWidget);
      expect(find.textContaining('yetkazish haqining 50%'), findsOneWidget);
      expect(find.byKey(const ValueKey('vendor_refund_line')), findsOneWidget);
      expect(find.textContaining('qaytariladi'), findsOneWidget);
      // Kod va bekor qilish yo'q.
      expect(find.text('Kuryerga ayting'), findsNothing);
      expect(find.byKey(const ValueKey('vendor-cancel-button')), findsNothing);
    });

    testWidgets('qaytarilmoqda — izoh va sabab', (tester) async {
      await pumpDetail(
        tester,
        _food('returning', delivery: {
          'orderId': 'ride-1',
          'status': 'in_progress',
          'deliveryFailedAt': '2026-11-03T10:26:00.000Z',
          'deliveryFailureReason': 'customer_absent',
        }),
      );
      expect(find.text('Buyurtma qaytarilmoqda'), findsOneWidget);
      expect(find.text("Mijoz yo'q"), findsOneWidget);
      expect(find.text('Qaytarilmoqda'), findsOneWidget);
    });
  });

  group('FoodProvider socket hodisalari', () {
    test('returning → returned: summa qo\'llanadi, buyurtma qayta olinadi', () async {
      when(() => api.get(ApiEndpoints.foodOrderById('o1-abc'))).thenAnswer(
        (_) async => _ok(
          ApiEndpoints.foodOrderById('o1-abc'),
          _food('returned', extra: {'returnCharge': 10500, 'refundDue': 46500, 'refundStatus': 'pending'}),
        ),
      );
      food.debugSetOrderHistory([FoodOrder.fromJson(_food('ready'))]);

      food.applyStatusEvent({'orderId': 'o1-abc', 'status': 'returning', 'reason': 'customer_absent'});
      expect(food.orderHistory.single.status, FoodOrderStatus.returning);

      food.applyStatusEvent({'orderId': 'o1-abc', 'status': 'returned', 'returnCharge': 10500, 'refundDue': 46500});
      expect(food.orderHistory.single.status, FoodOrderStatus.returned);
      expect(food.orderHistory.single.returnCharge, 10500);
      await Future<void>.delayed(Duration.zero);
      expect(food.orderHistory.single.refundStatus, 'pending');
    });

    test('noma\'lum buyurtma hodisasi e\'tiborsiz', () {
      food.debugSetOrderHistory([FoodOrder.fromJson(_food('ready'))]);
      food.applyStatusEvent({'orderId': 'other', 'status': 'returned'});
      expect(food.orderHistory.single.status, FoodOrderStatus.ready);
      verifyNever(() => api.get(any()));
    });

    test('kuryer bosqichi dropoff_arrived — "eshik oldida"', () async {
      when(() => api.get(ApiEndpoints.foodOrderById('o1-abc'))).thenThrow(Exception('offline'));
      food.debugSetOrderHistory([
        FoodOrder.fromJson(_food('ready', delivery: {'orderId': 'ride-1', 'status': 'in_progress'})),
      ]);
      food.applyCourierEvent({'orderId': 'o1-abc', 'stage': 'dropoff_arrived'});
      expect(food.orderHistory.single.delivery!.isAtDoor, isTrue);
      await Future<void>.delayed(Duration.zero);
      // Tarmoq xatosi holatni buzmaydi.
      expect(food.orderHistory.single.delivery!.isAtDoor, isTrue);
    });
  });

  group('Posilka formasi', () {
    late OrderProvider orders;

    Future<void> pumpParcel(WidgetTester tester) async {
      orders = OrderProvider(apiClient: api, socketService: SocketService());
      await tester.binding.setSurfaceSize(const Size(420, 1800));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        ChangeNotifierProvider<OrderProvider>.value(
          value: orders,
          child: MaterialApp(
            routes: {'/passenger/home': (_) => const Scaffold(body: Text('HOME'))},
            home: const ParcelScreen(),
          ),
        ),
      );
      await tester.pump();
    }

    Future<void> fillBasics(WidgetTester tester) async {
      await tester.enterText(find.widgetWithText(TextFormField, '+998'), '+998901112233');
      await tester.enterText(find.byType(TextFormField).at(2), 'Kitob');
    }

    testWidgets('qiymat va tasdiqsiz davom etib bo\'lmaydi', (tester) async {
      await pumpParcel(tester);
      await fillBasics(tester);
      expect(find.text('Pul'), findsOneWidget);
      expect(find.text('Giyohvand moddalar'), findsOneWidget);

      await tester.tap(find.text('Manzilni tanlash'));
      await tester.pump();

      expect(find.text('Posilka qiymatini kiriting'), findsOneWidget);
      expect(find.text('Davom etish uchun tasdiqlang'), findsOneWidget);
      expect(find.text('HOME'), findsNothing);
    });

    testWidgets('qiymat chegaradan oshsa — xato', (tester) async {
      await pumpParcel(tester);
      await fillBasics(tester);
      await tester.enterText(find.byKey(const ValueKey('parcel_declared_value')), '2000000');
      await tester.tap(find.byKey(const ValueKey('parcel_prohibited_confirm')));
      await tester.tap(find.text('Manzilni tanlash'));
      await tester.pump();
      expect(find.textContaining("so'mgacha bo'lishi kerak"), findsOneWidget);
    });

    testWidgets('to\'g\'ri to\'ldirilsa details ga qiymat va tasdiq ketadi', (tester) async {
      await pumpParcel(tester);
      await fillBasics(tester);
      await tester.enterText(find.byKey(const ValueKey('parcel_declared_value')), '150000');
      await tester.tap(find.byKey(const ValueKey('parcel_prohibited_confirm')));
      await tester.pump();
      await tester.tap(find.text('Manzilni tanlash'));
      await tester.pumpAndSettle();

      expect(find.text('HOME'), findsOneWidget);
      expect(orders.serviceType, kServiceTypeParcel);
      expect(orders.serviceDetails?['declaredValue'], 150000);
      expect(orders.serviceDetails?['prohibitedItemsAccepted'], isTrue);
    });
  });

  group('Cargo formasi', () {
    Future<OrderProvider> pumpCargo(WidgetTester tester) async {
      final orders = OrderProvider(apiClient: api, socketService: SocketService());
      await tester.binding.setSurfaceSize(const Size(420, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        ChangeNotifierProvider<OrderProvider>.value(
          value: orders,
          child: MaterialApp(
            routes: {'/passenger/home': (_) => const Scaffold(body: Text('HOME'))},
            home: const CargoScreen(),
          ),
        ),
      );
      await tester.pump();
      return orders;
    }

    testWidgets('og\'irlik va yuk ortuvchilar details ga ketadi', (tester) async {
      final orders = await pumpCargo(tester);
      await tester.enterText(find.byKey(const ValueKey('cargo_weight')), '500');
      await tester.enterText(find.byKey(const ValueKey('cargo_loaders')), '2');
      await tester.tap(find.text('Kuryer chaqirish'));
      await tester.pumpAndSettle();
      expect(find.text('HOME'), findsOneWidget);
      expect(orders.serviceDetails, {'vehicle': 'Kuryer', 'weightKg': 500, 'loaders': 2});
    });

    testWidgets('bo\'sh qoldirilsa faqat transport turi; chegaradan oshsa — xato', (tester) async {
      final orders = await pumpCargo(tester);
      await tester.enterText(find.byKey(const ValueKey('cargo_loaders')), '11');
      await tester.tap(find.text('Kuryer chaqirish'));
      await tester.pump();
      expect(find.text('0 dan 10 tagacha'), findsWidgets);
      expect(find.text('HOME'), findsNothing);

      await tester.enterText(find.byKey(const ValueKey('cargo_loaders')), '');
      await tester.tap(find.text('Kuryer chaqirish'));
      await tester.pumpAndSettle();
      expect(orders.serviceDetails, {'vehicle': 'Kuryer'});
    });
  });

  group('Posilka yuboruvchisi — qaytarish', () {
    testWidgets('qaytarish kartasi: izoh, foiz, tugma chaqiradi', (tester) async {
      var confirmed = 0;
      final order = Order.fromJson(_parcelRide(extra: {
        'deliveryFailedAt': '2026-11-03T10:26:00.000Z',
        'deliveryFailureReason': 'customer_refused',
      }));
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: ParcelReturnCard(
            order: order,
            returnFeePercent: 50,
            busy: false,
            onConfirm: () => confirmed++,
          ),
        ),
      ));
      expect(find.text('Posilka qaytarilmoqda'), findsOneWidget);
      expect(find.text('Mijoz rad etdi'), findsOneWidget);
      expect(find.textContaining('yetkazish haqining 50%'), findsOneWidget);
      await tester.tap(find.text('Posilka qaytib keldi'));
      expect(confirmed, 1);
    });

    test('confirmParcelReturned: PATCH va safar yopiladi', () async {
      final orders = OrderProvider(apiClient: api, socketService: SocketService());
      final returning = _parcelRide(extra: {'deliveryFailedAt': '2026-11-03T10:26:00.000Z'});
      when(() => api.get(ApiEndpoints.orderHistory)).thenAnswer(
        (_) async => Response<dynamic>(
          requestOptions: RequestOptions(path: ApiEndpoints.orderHistory),
          data: {
            'success': true,
            'data': {'orders': [returning]},
          },
        ),
      );
      when(() => api.get(ApiEndpoints.orderById('ride-1')))
          .thenAnswer((_) async => _ok(ApiEndpoints.orderById('ride-1'), returning));
      when(() => api.patch(ApiEndpoints.confirmReturned('ride-1'))).thenAnswer(
        (_) async => _ok(
          ApiEndpoints.confirmReturned('ride-1'),
          _parcelRide(status: 'completed', extra: {
            'deliveryOutcome': 'returned',
            'finalPrice': 22500,
            'fareBreakdown': {'total': 22500, 'returnFare': 7500},
          }),
        ),
      );
      await orders.checkActiveOrder();
      expect(orders.activeOrder!.isReturning, isTrue);

      final ok = await orders.confirmParcelReturned();

      expect(ok, isTrue);
      verify(() => api.patch(ApiEndpoints.confirmReturned('ride-1'))).called(1);
      expect(orders.activeOrder!.isReturned, isTrue);
      expect(orders.activeOrder!.returnFare, 7500);
    });
  });
}
