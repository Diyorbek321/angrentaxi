// Taklif faqat socket orqali keladi; socket uzilgan paytdagi hodisa
// yo'qoladi. Qayta ulanganda / ilova fondan qaytganda haydovchi taklifni
// `GET /orders/offer/current` dan tiklaydi (docs/CONTINGENCY-PLAN.md §5).
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

Map<String, dynamic> _offerJson(String id, {int? timeoutSeconds}) => {
      'id': id,
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Bobur 10', 'lat': 41.0167, 'lng': 70.1436},
      'dropoff': {'address': 'Markaz', 'lat': 41.02, 'lng': 70.15},
      'status': 'searching',
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-16T10:00:00.000Z',
      if (timeoutSeconds != null) 'timeoutSeconds': timeoutSeconds,
    };

Response<dynamic> _ok(Object? data) => Response(
      requestOptions: RequestOptions(path: ApiEndpoints.currentOffer),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

void main() {
  late _MockApiClient api;
  late DriverProvider driver;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    api = _MockApiClient();
    driver = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: LocalStorage(prefs),
    );
  });

  test('timeoutSeconds — taklifning QOLGAN soniyalari modelga o\'qiladi', () {
    expect(Order.fromJson(_offerJson('o', timeoutSeconds: 9)).offerTimeoutSeconds, 9);
    expect(Order.fromJson(_offerJson('o')).offerTimeoutSeconds, isNull);
  });

  test("o'tkazib yuborilgan taklif tiklanadi", () async {
    when(() => api.get(ApiEndpoints.currentOffer))
        .thenAnswer((_) async => _ok(_offerJson('offer-1', timeoutSeconds: 9)));

    await driver.resyncPendingOffer();

    expect(driver.pendingOffer?.id, 'offer-1');
    expect(driver.pendingOffer?.offerTimeoutSeconds, 9);
  });

  test("server taklif yo'q desa — eskirgan karta yopiladi", () async {
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('stale-1')));
    when(() => api.get(ApiEndpoints.currentOffer)).thenAnswer((_) async => _ok(null));

    await driver.resyncPendingOffer();

    expect(driver.pendingOffer, isNull);
  });

  test("so'rov xato bersa — hech narsa o'zgarmaydi (socket kutilaveradi)", () async {
    driver.debugSetPendingOfferForTest(Order.fromJson(_offerJson('offer-1')));
    when(() => api.get(ApiEndpoints.currentOffer)).thenThrow(
      DioException(requestOptions: RequestOptions(path: ApiEndpoints.currentOffer)),
    );

    await driver.resyncPendingOffer();

    expect(driver.pendingOffer?.id, 'offer-1');
  });

  test("faol safar bor — taklif so'ralmaydi", () async {
    driver.debugSetActiveOrderForTest(
      Order.fromJson({..._offerJson('active-1'), 'status': 'in_progress'}),
    );

    await driver.resyncPendingOffer();

    verifyNever(() => api.get(ApiEndpoints.currentOffer));
  });
}
