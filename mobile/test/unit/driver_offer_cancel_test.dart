// `order:cancelled` faqat O'SHA buyurtmaga tegadi va rad etilgan qabul
// eskirgan taklif kartasini yopadi.
//
// Server endi taklif paytida ham `order:cancelled {orderId}` yuboradi
// (qidiruv vaqti tugadi, yo'lovchi bekor qildi, boshqa haydovchi oldi).
// Ilgari ilova `orderId` ga qaramay FAOL buyurtmani ham "bekor" deb
// belgilardi — haydovchi yo'lovchini olib ketayotgan safar ekrandan
// yo'qolib qolishi mumkin edi.
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

Order _order(String id, String status) => Order.fromJson({
      'id': id,
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Bobur 10', 'lat': 41.0167, 'lng': 70.1436},
      'dropoff': {'address': 'Markaz', 'lat': 41.02, 'lng': 70.15},
      'status': status,
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-16T10:00:00.000Z',
    });

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

  test('taklif bekor qilinsa faqat taklif yopiladi, faol safar tegilmaydi', () {
    driver.debugSetActiveOrderForTest(_order('active-1', 'in_progress'));
    driver.debugSetPendingOfferForTest(_order('offer-2', 'searching'));

    driver.applyOrderCancelled({'orderId': 'offer-2', 'reason': 'No drivers available'});

    expect(driver.pendingOffer, isNull);
    expect(driver.activeOrder!.status, OrderStatus.inProgress);
  });

  test('faol buyurtmaning o\'zi bekor qilinsa — u bekor deb belgilanadi', () {
    driver.debugSetActiveOrderForTest(_order('active-1', 'accepted'));

    driver.applyOrderCancelled({'orderId': 'active-1'});

    expect(driver.activeOrder!.status, OrderStatus.cancelled);
  });

  test('boshqa buyurtma haqidagi xabar hech narsaga tegmaydi', () {
    driver.debugSetActiveOrderForTest(_order('active-1', 'accepted'));
    driver.debugSetPendingOfferForTest(_order('offer-2', 'searching'));

    driver.applyOrderCancelled({'orderId': 'other-9'});

    expect(driver.pendingOffer, isNotNull);
    expect(driver.activeOrder!.status, OrderStatus.driverAssigned);
  });

  test('orderId siz eski xabar — avvalgi xulq (hammasi yopiladi)', () {
    driver.debugSetActiveOrderForTest(_order('active-1', 'accepted'));
    driver.debugSetPendingOfferForTest(_order('offer-2', 'searching'));

    driver.applyOrderCancelled(null);

    expect(driver.pendingOffer, isNull);
    expect(driver.activeOrder!.status, OrderStatus.cancelled);
  });

  test('qabul qilish 409 bilan rad etilsa eskirgan taklif kartasi yopiladi', () async {
    driver.debugSetPendingOfferForTest(_order('offer-2', 'searching'));
    when(() => api.patch(ApiEndpoints.acceptOrder('offer-2'))).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ''),
        type: DioExceptionType.badResponse,
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: ''),
          statusCode: 409,
          data: {'success': false, 'statusCode': 409, 'message': 'Order is not offered to you'},
        ),
      ),
    );

    await driver.acceptOrder('offer-2');

    expect(driver.pendingOffer, isNull);
  });
}
