// Bosh sahifadagi "Trenddagi mahsulotlar" lentasi: sahifalab yuklash,
// takrorni tashlash, xatoda mavjud ro'yxatni saqlash.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/state/product_feed_controller.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

Map<String, dynamic> _product(String id, {String store = 's1'}) => {
      'id': id,
      'categoryId': null,
      'name': 'Mahsulot $id',
      'price': 5000,
      'stock': 3,
      'unit': 'dona',
      'status': 'active',
      'storeId': store,
      'store': {'id': store, 'name': "Do'kon $store"},
    };

Response<dynamic> _page(List<Map<String, dynamic>> items, {required bool hasMore}) => Response(
      requestOptions: RequestOptions(path: ApiEndpoints.marketTrending),
      statusCode: 200,
      data: {
        'success': true,
        'data': {'items': items, 'page': 1, 'limit': 2, 'hasMore': hasMore},
      },
    );

void main() {
  late _MockApiClient api;
  late ProductFeedController controller;

  setUp(() {
    api = _MockApiClient();
    controller = ProductFeedController(api, pageSize: 2);
  });

  void answerPage(int page, List<Map<String, dynamic>> items, {required bool hasMore}) {
    when(() => api.get(ApiEndpoints.marketTrending, params: {'page': page, 'limit': 2}))
        .thenAnswer((_) async => _page(items, hasMore: hasMore));
  }

  test("do'kon nomi modelga o'qiladi", () {
    final p = MarketProduct.fromJson(_product('a', store: 's9'));
    expect(p.storeId, 's9');
    expect(p.storeName, "Do'kon s9");
  });

  test('sahifalar ketma-ket qo\'shiladi; oxirida boshqa so\'rov yo\'q', () async {
    answerPage(1, [_product('a'), _product('b')], hasMore: true);
    answerPage(2, [_product('c')], hasMore: false);

    await controller.loadMore();
    await controller.loadMore();
    await controller.loadMore();

    expect(controller.items.map((p) => p.id), ['a', 'b', 'c']);
    expect(controller.hasMore, isFalse);
    verify(() => api.get(ApiEndpoints.marketTrending, params: any(named: 'params'))).called(2);
  });

  test('bir vaqtda ikki loadMore — bitta so\'rov', () async {
    answerPage(1, [_product('a')], hasMore: true);
    await Future.wait([controller.loadMore(), controller.loadMore()]);
    verify(() => api.get(ApiEndpoints.marketTrending, params: any(named: 'params'))).called(1);
  });

  test('takroriy mahsulot (sahifalar orasida tartib o\'zgargan) tashlanadi', () async {
    answerPage(1, [_product('a'), _product('b')], hasMore: true);
    answerPage(2, [_product('b'), _product('c')], hasMore: false);
    await controller.loadMore();
    await controller.loadMore();
    expect(controller.items.map((p) => p.id), ['a', 'b', 'c']);
  });

  test('xato — ro\'yxat saqlanadi, xato ko\'rsatiladi, keyingi urinish o\'sha sahifani so\'raydi', () async {
    answerPage(1, [_product('a')], hasMore: true);
    await controller.loadMore();
    when(() => api.get(ApiEndpoints.marketTrending, params: {'page': 2, 'limit': 2}))
        .thenThrow(DioException(requestOptions: RequestOptions(path: ApiEndpoints.marketTrending)));
    await controller.loadMore();

    expect(controller.items.map((p) => p.id), ['a']);
    expect(controller.hasError, isTrue);

    answerPage(2, [_product('b')], hasMore: false);
    await controller.loadMore();
    expect(controller.items.map((p) => p.id), ['a', 'b']);
    expect(controller.hasError, isFalse);
  });

  test('refresh — boshidan', () async {
    answerPage(1, [_product('a')], hasMore: false);
    await controller.loadMore();
    await controller.refresh();
    expect(controller.items.map((p) => p.id), ['a']);
    verify(() => api.get(ApiEndpoints.marketTrending, params: {'page': 1, 'limit': 2})).called(2);
  });
}
