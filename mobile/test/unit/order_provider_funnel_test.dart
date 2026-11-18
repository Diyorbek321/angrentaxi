// Anonim voronka: yo'lovchi oqimining bosqichlari faqat TAKSI zakazida
// belgilanadi (yuk tashish boshqa voronka — aralashib ketmasin).
import 'package:angren_taxi/core/analytics/funnel_tracker.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _RecordingTracker extends FunnelTracker {
  _RecordingTracker(ApiClient api) : super(api: api, flushDelay: null);

  final marks = <FunnelStep>[];

  @override
  void mark(FunnelStep step) => marks.add(step);
}

const _pickup = {'address': 'Angren, Bobur 10', 'lat': 41.0167, 'lng': 70.1436};
const _dropoff = {'address': 'Angren, Mustaqillik', 'lat': 41.02, 'lng': 70.15};

Response<dynamic> _ok(Map<String, dynamic> data) => Response<dynamic>(
      requestOptions: RequestOptions(path: ''),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

void main() {
  late _MockApiClient api;
  late _RecordingTracker funnel;
  late OrderProvider provider;

  setUp(() {
    api = _MockApiClient();
    funnel = _RecordingTracker(api);
    provider = OrderProvider(apiClient: api, socketService: SocketService(), funnel: funnel);
    when(() => api.post(ApiEndpoints.estimatePrice, data: any(named: 'data')))
        .thenAnswer((_) async => _ok({'price': 15000, 'distanceKm': 3.2}));
    when(() => api.post(ApiEndpoints.createOrder, data: any(named: 'data'), headers: any(named: 'headers')))
        .thenAnswer((_) async => _ok({
              'id': 'order-1',
              'passengerId': 'p',
              'pickup': _pickup,
              'dropoff': _dropoff,
              'status': 'searching',
              'estimatedPrice': 15000.0,
              'createdAt': '2026-10-27T10:00:00.000Z',
            }));
    when(() => api.get(any())).thenAnswer((_) async => _ok({}));
  });

  tearDown(() => provider.dispose());

  Future<void> walkTheFlow() async {
    provider.setPendingPickup(OrderLocation.fromJson(_pickup));
    provider.setPendingDropoff(OrderLocation.fromJson(_dropoff));
    provider.selectTariff(const Tariff(
      id: 'tariff-1', name: 'Standart', description: '',
      baseFare: 5000, perKmRate: 1500, minFare: 8000,
    ));
    await provider.estimatePrice(distanceKm: 3, durationMin: 8, tariffId: 'tariff-1');
    expect(await provider.createOrder(), isTrue);
  }

  test('taksi: manzil → narx → zakaz belgilanadi', () async {
    await walkTheFlow();
    expect(funnel.marks, [
      FunnelStep.destinationSelected,
      FunnelStep.priceShown,
      FunnelStep.orderRequested,
    ]);
  });

  test('yuk tashish voronkaga kirmaydi', () async {
    provider.setServiceType('cargo');
    await walkTheFlow();
    expect(funnel.marks, isEmpty);
  });

  test('narx hisoblanmasa — price_shown yo\'q', () async {
    when(() => api.post(ApiEndpoints.estimatePrice, data: any(named: 'data')))
        .thenThrow(DioException(requestOptions: RequestOptions(path: '')));
    provider.setPendingDropoff(OrderLocation.fromJson(_dropoff));
    await provider.estimatePrice(distanceKm: 3, durationMin: 8, tariffId: 'tariff-1');
    expect(funnel.marks, [FunnelStep.destinationSelected]);
  });
}
