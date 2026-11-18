// Savat bitta do'konga bog'langan: bosh sahifa lentasidan boshqa do'kon
// mahsuloti qo'shilganda savat JIM tozalanmaydi va buyurtma noto'g'ri
// do'konga ketmaydi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/market_cart_flow.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

MarketProduct _product(String id, String storeId) => MarketProduct.fromJson({
      'id': id,
      'categoryId': null,
      'name': 'Mahsulot $id',
      'price': 5000,
      'stock': 5,
      'status': 'active',
      'storeId': storeId,
      'store': {'id': storeId, 'name': "Do'kon $storeId"},
    });

Response<dynamic> _storeDetail(String storeId) => Response(
      requestOptions: RequestOptions(path: ApiEndpoints.marketStore(storeId)),
      statusCode: 200,
      data: {
        'success': true,
        'data': {
          'store': {'id': storeId, 'name': "Do'kon $storeId", 'status': 'active'},
          'categories': <dynamic>[],
          'products': <dynamic>[],
        },
      },
    );

void main() {
  late _MockApiClient api;
  late SuperappProvider superapp;
  late MarketProvider market;
  late bool? result;

  setUp(() {
    api = _MockApiClient();
    superapp = SuperappProvider(apiClient: api);
    market = MarketProvider(apiClient: api, socketService: SocketService());
    result = null;
  });

  Future<void> pumpAndAdd(WidgetTester tester, MarketProduct product) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: superapp),
          ChangeNotifierProvider.value(value: market),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('uz'),
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async => result = await addMarketProductToCart(context, product),
                child: const Text('add'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('add'));
    await tester.pumpAndSettle();
  }

  CartItem item(String id) => CartItem(
        id: id, name: id, price: 1, qty: 1, icon: Icons.add, color: Colors.green);

  testWidgets("bo'sh savat — do'kon yuklanadi, savat shu do'konga bog'lanadi", (tester) async {
    when(() => api.get(ApiEndpoints.marketStore('s2'))).thenAnswer((_) async => _storeDetail('s2'));

    await pumpAndAdd(tester, _product('milk', 's2'));

    expect(result, isTrue);
    expect(superapp.activeEntityId, 's2');
    expect(market.store?.id, 's2');
    expect(superapp.cart.map((c) => c.id), ['milk']);
  });

  testWidgets("boshqa do'kon savati — so'raladi; bekor qilinsa savat tegilmaydi", (tester) async {
    superapp.setActiveContext('market', 's1');
    superapp.addToCart(item('bread'));

    await pumpAndAdd(tester, _product('milk', 's2'));
    expect(find.byType(AlertDialog), findsOneWidget);
    await tester.tap(find.text('Bekor qilish'));
    await tester.pumpAndSettle();

    expect(result, isFalse);
    expect(superapp.cart.map((c) => c.id), ['bread']);
    expect(superapp.activeEntityId, 's1');
    verifyNever(() => api.get(any()));
  });

  testWidgets("rozi bo'lsa — savat tozalanib, yangi do'kondan qo'shiladi", (tester) async {
    superapp.setActiveContext('market', 's1');
    superapp.addToCart(item('bread'));
    when(() => api.get(ApiEndpoints.marketStore('s2'))).thenAnswer((_) async => _storeDetail('s2'));

    await pumpAndAdd(tester, _product('milk', 's2'));
    await tester.tap(find.text("Tozalab qo'shish"));
    await tester.pumpAndSettle();

    expect(result, isTrue);
    expect(superapp.cart.map((c) => c.id), ['milk']);
    expect(superapp.activeEntityId, 's2');
  });

  testWidgets("o'sha do'kon — so'rovsiz, dialogsiz qo'shiladi", (tester) async {
    superapp.setActiveContext('market', 's1');
    superapp.addToCart(item('bread'));

    await pumpAndAdd(tester, _product('milk', 's1'));

    expect(find.byType(AlertDialog), findsNothing);
    expect(superapp.cart.map((c) => c.id), ['bread', 'milk']);
    verifyNever(() => api.get(any()));
  });

  testWidgets("do'kon yuklanmasa (boshqasiga qaytdi) — qo'shilmaydi, xabar", (tester) async {
    when(() => api.get(ApiEndpoints.marketStore('s2'))).thenThrow(
      DioException(requestOptions: RequestOptions(path: ApiEndpoints.marketStore('s2'))),
    );
    when(() => api.get(ApiEndpoints.marketStores)).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: ApiEndpoints.marketStores),
        statusCode: 200,
        data: {
          'success': true,
          'data': [
            {'id': 's1'},
          ],
        },
      ),
    );
    when(() => api.get(ApiEndpoints.marketStore('s1'))).thenAnswer((_) async => _storeDetail('s1'));

    await pumpAndAdd(tester, _product('milk', 's2'));

    expect(result, isFalse);
    expect(superapp.cart, isEmpty);
    expect(find.text('Bu do\'kon hozir buyurtma qabul qilmayapti'), findsOneWidget);
  });
}
