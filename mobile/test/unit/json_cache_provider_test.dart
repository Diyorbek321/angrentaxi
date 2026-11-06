// "Avval keshdan, keyin tarmoqdan": restoranlar ro'yxati va do'kon katalogi
// oxirgi nusxa bilan darhol ochiladi, tarmoq javobi kelganda almashadi.
import 'dart:async';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/json_cache.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _ok(String path, Object data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

Map<String, dynamic> _restaurant(String id, String name) =>
    {'id': id, 'name': name, 'status': 'open'};

Map<String, dynamic> _storeDetail(String id, String name) => {
      'store': {'id': id, 'name': name},
      'categories': <dynamic>[],
      'products': <dynamic>[],
    };

void main() {
  late _MockApiClient api;
  late SharedPreferences prefs;
  var now = DateTime(2026, 10, 10, 12);

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    api = _MockApiClient();
    now = DateTime(2026, 10, 10, 12);
  });

  JsonCache cache() => JsonCache(prefs, now: () => now);

  group('JsonCache', () {
    test('yozilgan nusxa o\'qiladi', () async {
      await cache().write('k', {'a': 1});
      expect(cache().read('k'), {'a': 1});
    });

    test('maxAge dan eski nusxa qaytmaydi', () async {
      await cache().write('k', [1]);
      now = now.add(const Duration(days: 4));
      expect(cache().read('k'), isNull);
    });

    test('buzilgan yozuv xato emas, null', () async {
      await prefs.setString('json_cache.v1.k', '{buzuq');
      expect(cache().read('k'), isNull);
    });
  });

  group('FoodProvider', () {
    FoodProvider provider() =>
        FoodProvider(apiClient: api, socketService: SocketService(), cache: cache());

    test('kesh bo\'lsa ro\'yxat tarmoqdan OLDIN ko\'rinadi, keyin yangilanadi', () async {
      await cache().write('food.restaurants', [_restaurant('r1', 'Eski')]);
      final response = Completer<Response<dynamic>>();
      when(() => api.get(ApiEndpoints.foodRestaurants)).thenAnswer((_) => response.future);

      final food = provider();
      final loading = food.loadRestaurants();

      expect(food.state, FoodProviderState.success);
      expect(food.restaurants.single.name, 'Eski');

      response.complete(_ok(ApiEndpoints.foodRestaurants, [_restaurant('r1', 'Yangi')]));
      await loading;
      expect(food.restaurants.single.name, 'Yangi');
      expect(
        (cache().read('food.restaurants')! as List).single,
        containsPair('name', 'Yangi'),
      );
    });

    test('kesh ko\'rinib tursa tarmoq xatosi xato ekraniga aylantirmaydi', () async {
      await cache().write('food.restaurants', [_restaurant('r1', 'Eski')]);
      when(() => api.get(ApiEndpoints.foodRestaurants)).thenThrow(Exception('net'));

      final food = provider();
      await food.loadRestaurants();

      expect(food.state, FoodProviderState.success);
      expect(food.restaurants.single.name, 'Eski');
    });

    test('kesh yo\'q va tarmoq xatosi — avvalgidek xato holati', () async {
      when(() => api.get(ApiEndpoints.foodRestaurants)).thenThrow(Exception('net'));

      final food = provider();
      await food.loadRestaurants();

      expect(food.state, FoodProviderState.error);
    });
  });

  group('MarketProvider', () {
    MarketProvider provider() =>
        MarketProvider(apiClient: api, socketService: SocketService(), cache: cache());

    test('keshdagi katalog darhol ko\'rinadi', () async {
      await cache().write('market.store', _storeDetail('s1', 'Eski'));
      final response = Completer<Response<dynamic>>();
      when(() => api.get(ApiEndpoints.marketStores)).thenAnswer((_) => response.future);
      when(() => api.get(ApiEndpoints.marketStore('s1'))).thenAnswer(
        (_) async => _ok(ApiEndpoints.marketStore('s1'), _storeDetail('s1', 'Yangi')),
      );

      final market = provider();
      final loading = market.loadStore();

      expect(market.state, MarketProviderState.success);
      expect(market.store?.name, 'Eski');

      response.complete(_ok(ApiEndpoints.marketStores, [
        {'id': 's1', 'name': 'Yangi'},
      ]));
      await loading;
      expect(market.store?.name, 'Yangi');
    });

    test('boshqa do\'kon so\'ralsa keshdagisi ko\'rsatilmaydi', () async {
      await cache().write('market.store', _storeDetail('s1', 'Eski'));
      final response = Completer<Response<dynamic>>();
      when(() => api.get(ApiEndpoints.marketStore('s2'))).thenAnswer((_) => response.future);

      final market = provider();
      final loading = market.loadStore(storeId: 's2');

      expect(market.state, MarketProviderState.loading);
      expect(market.store, isNull);

      response.complete(_ok(ApiEndpoints.marketStore('s2'), _storeDetail('s2', 'Ikkinchi')));
      await loading;
      expect(market.store?.name, 'Ikkinchi');
    });
  });
}
