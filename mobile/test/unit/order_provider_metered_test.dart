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

const _tariff = Tariff(
  id: 'tariff-1',
  name: 'Standart',
  description: '',
  baseFare: 3000,
  perKmRate: 1500,
  minFare: 5000,
);

const _pickup = OrderLocation(address: 'Markaz', lat: 41.011, lng: 70.142);

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Map<String, dynamic> _created({bool metered = true}) => {
      'id': 'order-1',
      'passengerId': 'p-1',
      'pickup': {'address': 'Markaz', 'lat': 41.011, 'lng': 70.142},
      'dropoff': {'address': null, 'lat': 41.011, 'lng': 70.142},
      'status': 'searching',
      'estimatedPrice': 5000,
      'createdAt': '2026-10-06T10:00:00.000Z',
      'isMetered': metered,
    };

void main() {
  late MockApiClient api;
  late OrderProvider provider;

  setUp(() {
    api = MockApiClient();
    provider = OrderProvider(apiClient: api, socketService: SocketService());
    when(() => api.post(ApiEndpoints.createOrder, data: any(named: 'data')))
        .thenAnswer((_) async => _ok(_created()));
    when(() => api.get(any(), params: any(named: 'params')))
        .thenAnswer((_) async => _ok(<dynamic>[]));
    provider.setPendingPickup(_pickup);
    provider.selectTariff(_tariff);
  });

  Map<String, dynamic> sentBody() =>
      verify(() => api.post(ApiEndpoints.createOrder, data: captureAny(named: 'data')))
          .captured
          .single as Map<String, dynamic>;

  test('a metered order is sent without any destination', () async {
    provider.chooseMetered();
    expect(provider.isMetered, isTrue);

    expect(await provider.createOrder(), isTrue);

    final body = sentBody();
    expect(body.containsKey('dropoffLat'), isFalse);
    expect(body.containsKey('dropoffLng'), isFalse);
    expect(body.containsKey('dropoffAddress'), isFalse);
    expect(body['pickupLat'], 41.011);
    // The choice belongs to this order only.
    expect(provider.isMetered, isFalse);
  });

  test('without metered and without a destination nothing is sent', () async {
    expect(await provider.createOrder(), isFalse);
    verifyNever(() => api.post(ApiEndpoints.createOrder, data: any(named: 'data')));
  });

  test('picking a destination afterwards cancels the metered choice', () {
    provider.chooseMetered();
    provider.setPendingDropoff(const OrderLocation(address: 'Bozor', lat: 41.02, lng: 70.15));
    expect(provider.isMetered, isFalse);
  });

  test('only a plain taxi without stops can go metered', () {
    provider.setServiceType('cargo');
    expect(provider.canChooseMetered, isFalse);
    provider.chooseMetered();
    expect(provider.isMetered, isFalse);

    provider.setServiceType('taxi');
    provider.addWaypoint(const OrderLocation(address: 'Bekat', lat: 41.015, lng: 70.145));
    expect(provider.canChooseMetered, isFalse);
  });

  test('the order model reads the flag and labels the missing destination', () {
    final order = Order.fromJson(_created());
    expect(order.isMetered, isTrue);
    expect(order.dropoffLabel, isNot(isEmpty));
    expect(order.dropoffLabel, isNot(order.pickup.address));
    expect(Order.fromJson(_created(metered: false)).isMetered, isFalse);
  });
}
