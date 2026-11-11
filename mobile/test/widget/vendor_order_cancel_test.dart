// Ovqat/market buyurtmasini bekor qilish (docs/specs/food-market-ux-v5.md §1):
// tugma ko'rinadi, tasdiq varag'i sabab chiplari bilan, `canCancel` false
// bo'lsa o'chiq + sababi, 409 ORDER_CANCEL_NOT_ALLOWED aniq xabar beradi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/screens/vendor_order_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

Map<String, dynamic> _order(String status, {bool? canCancel}) => {
      'id': 'o1-abc',
      'restaurantId': 'r1',
      'status': status,
      'items': [
        {'dishId': 'd1', 'name': 'Osh', 'qty': 2, 'price': 25000},
      ],
      'deliveryAddress': "Navoiy ko'chasi 12",
      'totalPrice': 57000,
      'createdAt': '2026-10-16T10:00:00.000Z',
      if (canCancel != null) 'canCancel': canCancel,
      'addressDetails': {'entrance': '2', 'floor': '4', 'landmark': 'Maktab yonida'},
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
    when(() => api.get(ApiEndpoints.foodOrders)).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.foodOrders),
        data: {'success': true, 'data': [_order('preparing', canCancel: false)]},
      ),
    );
  });

  Future<void> pump(WidgetTester tester, Map<String, dynamic> json) async {
    food.debugSetOrderHistory([FoodOrder.fromJson(json)]);
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

  testWidgets('yangi buyurtma: bekor qilish tugmasi faol, manzil tafsilotlari ko\'rinadi',
      (tester) async {
    await pump(tester, _order('new'));

    final button = tester.widget<ButtonStyleButton>(find.byKey(const ValueKey('vendor-cancel-button')));
    expect(button.onPressed, isNotNull);
    expect(find.byKey(const ValueKey('vendor-cancel-hint')), findsNothing);
    expect(find.textContaining('Podyezd 2'), findsOneWidget);
    expect(find.textContaining('Maktab yonida'), findsOneWidget);
  });

  testWidgets('restoran qabul qilgan (canCancel=false): tugma o\'chiq va sababi yozilgan',
      (tester) async {
    await pump(tester, _order('preparing', canCancel: false));

    final button = tester.widget<ButtonStyleButton>(find.byKey(const ValueKey('vendor-cancel-button')));
    expect(button.onPressed, isNull);
    expect(find.byKey(const ValueKey('vendor-cancel-hint')), findsOneWidget);
    expect(find.text("Qo'llab-quvvatlashga yozish"), findsOneWidget);
  });

  testWidgets('tasdiq varag\'i: sabab tanlanadi va POST /food/orders/:id/cancel yuboriladi',
      (tester) async {
    when(() => api.post(ApiEndpoints.foodOrderCancel('o1-abc'), data: any(named: 'data'))).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ''),
        data: {
          'success': true,
          'data': {..._order('cancelled'), 'cancelledBy': 'customer', 'cancelReason': 'Manzil noto\'g\'ri'},
        },
      ),
    );
    await pump(tester, _order('new'));

    await tester.tap(find.byKey(const ValueKey('vendor-cancel-button')));
    await tester.pumpAndSettle();
    expect(find.text('Buyurtmani bekor qilasizmi?'), findsOneWidget);

    await tester.tap(find.text("Manzil noto'g'ri"));
    await tester.pump();
    await tester.tap(find.text('Ha, bekor qilish'));
    await tester.pumpAndSettle();

    final body = verify(
      () => api.post(ApiEndpoints.foodOrderCancel('o1-abc'), data: captureAny(named: 'data')),
    ).captured.single;
    expect(body, {'reason': "Manzil noto'g'ri"});
    expect(find.text('Buyurtma bekor qilindi'), findsOneWidget);
    // Bekor qilingan buyurtmada amal endi ko'rinmaydi.
    expect(find.byKey(const ValueKey('vendor-cancel-button')), findsNothing);
  });

  testWidgets('409 ORDER_CANCEL_NOT_ALLOWED — aniq xabar, buyurtma qayta yuklanadi',
      (tester) async {
    when(() => api.post(ApiEndpoints.foodOrderCancel('o1-abc'), data: any(named: 'data'))).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ''),
        type: DioExceptionType.badResponse,
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: ''),
          statusCode: 409,
          data: {
            'success': false,
            'code': 'ORDER_CANCEL_NOT_ALLOWED',
            'message': 'Restoran buyurtmani qabul qildi',
          },
        ),
      ),
    );
    await pump(tester, _order('new'));

    await tester.tap(find.byKey(const ValueKey('vendor-cancel-button')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ha, bekor qilish'));
    await tester.pumpAndSettle();

    expect(find.text('Restoran buyurtmani qabul qildi'), findsOneWidget);
    // Yangilangan holat (canCancel=false) — tugma o'chiq, sababi bilan.
    expect(find.byKey(const ValueKey('vendor-cancel-hint')), findsOneWidget);
  });
}
