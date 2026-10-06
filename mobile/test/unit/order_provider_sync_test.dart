// Socket event'i yo'qolganda (ekran o'chgan, tarmoq uzilgan) yo'lovchi
// ekrani "Haydovchi keldi" holatida qotib qolmasligi kerak: provider faol
// safar holatini serverdan davriy tekshiradi.
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

const _pickup = {'address': 'Angren, Bobur 10', 'lat': 41.0167, 'lng': 70.1436};
const _dropoff = {'address': 'Angren, Mustaqillik', 'lat': 41.02, 'lng': 70.15};

Map<String, dynamic> _order(String status, {double? finalPrice}) => {
      'id': 'order-1',
      'passengerId': 'passenger-1',
      'pickup': _pickup,
      'dropoff': _dropoff,
      'status': status,
      'estimatedPrice': 20000.0,
      if (finalPrice != null) 'finalPrice': finalPrice,
      'createdAt': '2026-10-06T10:00:00.000Z',
    };

Response<dynamic> _ok(String path, Map<String, dynamic> data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

void main() {
  late MockApiClient api;
  late OrderProvider provider;
  var serverStatus = 'arrived';

  setUp(() async {
    api = MockApiClient();
    serverStatus = 'arrived';
    provider = OrderProvider(
      apiClient: api,
      socketService: SocketService(),
      syncInterval: const Duration(milliseconds: 20),
    );
    when(() => api.post(any(), data: any(named: 'data'))).thenAnswer(
      (_) async => _ok(ApiEndpoints.createOrder, _order('searching')),
    );
    when(() => api.get(ApiEndpoints.orderById('order-1'))).thenAnswer(
      (_) async => _ok(
        ApiEndpoints.orderById('order-1'),
        _order(serverStatus, finalPrice: serverStatus == 'completed' ? 43500 : null),
      ),
    );
    when(() => api.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _ok(ApiEndpoints.orderHistory, {'orders': <dynamic>[], 'total': 0}),
    );

    provider.setPendingPickup(OrderLocation.fromJson(_pickup));
    provider.setPendingDropoff(OrderLocation.fromJson(_dropoff));
    provider.selectTariff(const Tariff(
      id: 'tariff-1', name: 'Standart', description: '',
      baseFare: 5000, perKmRate: 1500, minFare: 8000,
    ));
    expect(await provider.createOrder(), isTrue);
  });

  tearDown(() => provider.dispose());

  Future<void> waitFor(bool Function() done) async {
    for (var i = 0; i < 50 && !done(); i++) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
  }

  test('socket jim bo\'lsa ham server holati qo\'llanadi: keldi → safarda', () async {
    serverStatus = 'in_progress';
    await waitFor(() => provider.activeOrder?.status == OrderStatus.inProgress);
    expect(provider.activeOrder?.status, OrderStatus.inProgress);
  });

  test('yakunlangan safar reytingga o\'tadi va tekshiruv to\'xtaydi', () async {
    serverStatus = 'completed';
    await waitFor(() => provider.activeOrder?.status == OrderStatus.completed);
    expect(provider.activeOrder?.status, OrderStatus.completed);
    expect(provider.pendingRatingOrderId, 'order-1');

    clearInteractions(api);
    await Future<void>.delayed(const Duration(milliseconds: 100));
    verifyNever(() => api.get(ApiEndpoints.orderById('order-1')));
  });
}
