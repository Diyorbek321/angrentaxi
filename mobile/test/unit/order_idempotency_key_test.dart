// Buyurtma timeout bilan tugasa, qayta bosish YANGI buyurtma ochmasligi
// uchun ilova o'sha `Idempotency-Key` ni qayta yuboradi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/idempotency_key.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

final _pickup = OrderLocation.fromJson(const {
  'address': 'Bobur 10',
  'lat': 41.0167,
  'lng': 70.1436,
});
final _dropoff = OrderLocation.fromJson(const {
  'address': 'Markaz',
  'lat': 41.02,
  'lng': 70.15,
});

Map<String, dynamic> _orderJson() => {
      'id': 'order-1',
      'passengerId': 'p-1',
      'pickup': {'address': 'Bobur 10', 'lat': 41.0167, 'lng': 70.1436},
      'dropoff': {'address': 'Markaz', 'lat': 41.02, 'lng': 70.15},
      'status': 'searching',
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-27T10:00:00.000Z',
    };

DioException _timeout() => DioException(
      requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
      type: DioExceptionType.receiveTimeout,
    );

DioException _rejected(int status) => DioException(
      requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
        statusCode: status,
        data: {'message': 'no'},
      ),
    );

void main() {
  late _MockApiClient api;
  late OrderProvider orders;
  late List<String?> sentKeys;
  late List<Object> outcomes;

  setUp(() {
    api = _MockApiClient();
    sentKeys = [];
    outcomes = [];
    when(
      () => api.post(
        ApiEndpoints.createOrder,
        data: any(named: 'data'),
        headers: any(named: 'headers'),
      ),
    ).thenAnswer((inv) async {
      final headers = inv.namedArguments[#headers] as Map<String, dynamic>?;
      sentKeys.add(headers?['Idempotency-Key'] as String?);
      final next = outcomes.removeAt(0);
      if (next is DioException) throw next;
      return Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
        statusCode: 201,
        data: {'success': true, 'data': _orderJson()},
      );
    });
    orders = OrderProvider(apiClient: api, socketService: SocketService())
      ..setPendingPickup(_pickup)
      ..setPendingDropoff(_dropoff)
      ..selectTariff(
        const Tariff(
          id: 't-1',
          name: 'Standart',
          description: '',
          baseFare: 5000,
          perKmRate: 1500,
          minFare: 8000,
        ),
      );
  });

  test('UUID v4 formatida', () {
    expect(
      newIdempotencyKey(),
      matches(RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')),
    );
    expect(newIdempotencyKey(), isNot(newIdempotencyKey()));
  });

  test('timeoutdan keyingi qayta urinish — o\'sha kalit', () async {
    outcomes.addAll([_timeout(), 'ok']);
    expect(await orders.createOrder(), isFalse);
    expect(await orders.createOrder(), isTrue);

    expect(sentKeys, hasLength(2));
    expect(sentKeys.first, isNotNull);
    expect(sentKeys[1], sentKeys.first);
  });

  test('409 (server hali bajaryapti) — o\'sha kalit', () async {
    outcomes.addAll([_rejected(409), 'ok']);
    await orders.createOrder();
    await orders.createOrder();
    expect(sentKeys[1], sentKeys.first);
  });

  test('server aniq rad etsa (400) — keyingi urinish yangi kalit', () async {
    outcomes.addAll([_rejected(400), 'ok']);
    await orders.createOrder();
    await orders.createOrder();
    expect(sentKeys[1], isNot(sentKeys.first));
  });
}
