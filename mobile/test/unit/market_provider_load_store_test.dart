import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Reklama banneri aniq do'konni ochadi; banner do'kondan uzoq yashashi
/// mumkin, shuning uchun do'kon yo'q bo'lsa birinchi do'konga qaytadi.
void main() {
  Map<String, dynamic> store(String id) => {
        'id': id,
        'name': 'Do\'kon $id',
        'address': 'Angren',
        'deliveryMode': 'platform',
        'workingHoursStart': '08:00',
        'workingHoursEnd': '22:00',
      };

  Response<dynamic> ok(String path, Object data) => Response<dynamic>(
        requestOptions: RequestOptions(path: path),
        data: {'success': true, 'data': data},
        statusCode: 200,
      );

  Response<dynamic> detail(String id) => ok('/market/stores/$id', {
        'store': store(id),
        'categories': <dynamic>[],
        'products': <dynamic>[],
      });

  late MockApiClient api;
  late MarketProvider market;

  setUp(() {
    api = MockApiClient();
    market = MarketProvider(apiClient: api, socketService: SocketService());
    when(() => api.get('/market/stores')).thenAnswer(
      (_) async => ok('/market/stores', [store('first'), store('second')]),
    );
    when(() => api.get('/market/stores/first'))
        .thenAnswer((_) async => detail('first'));
    when(() => api.get('/market/stores/second'))
        .thenAnswer((_) async => detail('second'));
  });

  test('storeId berilmasa birinchi do\'kon ochiladi', () async {
    await market.loadStore();
    expect(market.state, MarketProviderState.success);
    expect(market.store?.id, 'first');
  });

  test('banner do\'koni ro\'yxatsiz, to\'g\'ridan-to\'g\'ri ochiladi', () async {
    await market.loadStore(storeId: 'second');
    expect(market.state, MarketProviderState.success);
    expect(market.store?.id, 'second');
    verifyNever(() => api.get('/market/stores'));
  });

  test('banner do\'koni yo\'q bo\'lsa birinchi do\'konga qaytadi', () async {
    when(() => api.get('/market/stores/gone')).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/market/stores/gone'),
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: '/market/stores/gone'),
          statusCode: 404,
        ),
      ),
    );
    await market.loadStore(storeId: 'gone');
    expect(market.state, MarketProviderState.success);
    expect(market.store?.id, 'first');
  });
}
