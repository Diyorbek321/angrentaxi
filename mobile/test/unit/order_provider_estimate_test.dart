// Regression test for a second cause of the "tariff selection doesn't do
// anything" bug report: OrderProvider.estimatePrice() called a client-only
// path ('/orders/estimate') with a pickup/dropoff lat-lng body, but the real
// backend endpoint is POST /orders/calculate-price, taking
// {tariffId, distanceKm, durationMin} and returning {..., price} (see
// backend/src/modules/orders/dto/calculate-price.dto.ts and
// orders.service.ts#calculatePrice). The mismatch 404'd, was swallowed
// silently, and the price never appeared on the order button.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient apiClient;
  late OrderProvider provider;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() {
    apiClient = MockApiClient();
    provider = OrderProvider(apiClient: apiClient, socketService: SocketService());
  });

  test('estimatePrice posts to /orders/calculate-price with distanceKm/durationMin', () async {
    when(() => apiClient.post(any(), data: any(named: 'data'))).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.estimatePrice),
        data: {
          'success': true,
          'data': {
            'price': 12500,
            'tariffId': 'tariff-1',
            'distanceKm': 5.2,
            'durationMin': 12,
          },
        },
      ),
    );

    await provider.estimatePrice(
      distanceKm: 5.2,
      durationMin: 12,
      tariffId: 'tariff-1',
    );

    final captured = verify(
      () => apiClient.post(ApiEndpoints.estimatePrice, data: captureAny(named: 'data')),
    ).captured.single as Map<String, dynamic>;

    expect(captured['tariffId'], 'tariff-1');
    expect(captured['distanceKm'], 5.2);
    expect(captured['durationMin'], 12);
    expect(ApiEndpoints.estimatePrice, '/orders/calculate-price');
    expect(provider.estimatedPrice, 12500.0);
  });

  test('a failed estimate leaves estimatedPrice unset instead of throwing', () async {
    when(() => apiClient.post(any(), data: any(named: 'data')))
        .thenThrow(DioException(requestOptions: RequestOptions(path: ApiEndpoints.estimatePrice)));

    await provider.estimatePrice(distanceKm: 1, durationMin: 1, tariffId: 't');

    expect(provider.estimatedPrice, isNull);
  });
}
