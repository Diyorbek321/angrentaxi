// Unit test for OrderProvider.cancelOrder(reason: ...): the cancel-order
// reason picker added to PassengerHomeScreen (see
// mobile/lib/features/passenger/screens/home_screen.dart#_confirmCancel)
// needs the provider to forward the chosen reason to the backend's
// PATCH /orders/:id/cancel, whose CancelOrderDto (see
// backend/src/modules/orders/dto/cancel-order.dto.ts) accepts an optional
// `reason` string in the request body.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

const Map<String, dynamic> _pickupJson = {
  'address': "Angren, Bobur ko'chasi, 10",
  'lat': 41.0167,
  'lng': 70.1436,
};

const Map<String, dynamic> _dropoffJson = {
  'address': 'Angren, Mustaqillik maydoni',
  'lat': 41.0200,
  'lng': 70.1500,
};

const Map<String, dynamic> _createdOrderJson = {
  'id': 'order-1',
  'passengerId': 'passenger-1',
  'pickup': _pickupJson,
  'dropoff': _dropoffJson,
  'status': 'searching',
  'estimatedPrice': 20000.0,
  'createdAt': '2026-07-13T10:00:00.000Z',
};

Response<dynamic> _jsonResponse(String path, Map<String, dynamic> data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

void main() {
  late MockApiClient apiClient;
  late OrderProvider provider;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() async {
    apiClient = MockApiClient();
    provider = OrderProvider(apiClient: apiClient, socketService: SocketService());

    when(() => apiClient.post(any(), data: any(named: 'data'))).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.createOrder, _createdOrderJson),
    );

    provider.setPendingPickup(OrderLocation.fromJson(_pickupJson));
    provider.setPendingDropoff(OrderLocation.fromJson(_dropoffJson));
    provider.selectTariff(
      const Tariff(
        id: 'tariff-1',
        name: 'Standart',
        description: '',
        baseFare: 5000,
        perKmRate: 1500,
        minFare: 8000,
      ),
    );

    final created = await provider.createOrder();
    expect(created, isTrue);
    expect(provider.activeOrder, isNotNull);
  });

  test('cancelOrder sends {reason} in the PATCH body when a reason is given', () async {
    when(() => apiClient.patch(any(), data: any(named: 'data'))).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.cancelOrder('order-1'), <String, dynamic>{}),
    );

    await provider.cancelOrder(reason: 'Juda uzoq kutdim');

    final captured = verify(
      () => apiClient.patch(
        ApiEndpoints.cancelOrder('order-1'),
        data: captureAny(named: 'data'),
      ),
    ).captured.single;

    expect(captured, {'reason': 'Juda uzoq kutdim'});
    expect(provider.activeOrder, isNull);
  });

  test('cancelOrder omits the reason key entirely when none is given', () async {
    when(() => apiClient.patch(any(), data: any(named: 'data'))).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.cancelOrder('order-1'), <String, dynamic>{}),
    );

    await provider.cancelOrder();

    final captured = verify(
      () => apiClient.patch(
        ApiEndpoints.cancelOrder('order-1'),
        data: captureAny(named: 'data'),
      ),
    ).captured.single;

    expect(captured, isNull);
  });
}
