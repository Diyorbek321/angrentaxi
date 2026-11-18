import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/trip_rules/cancel_fee_service.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _NoGpsLocation extends LocationService {
  @override
  Future<Never?> getCurrentPosition() async => null;
}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Order _order({String serviceType = 'taxi', String status = 'arrived'}) => Order.fromJson({
      'id': 'o-1',
      'passengerId': 'p-1',
      'pickup': const {'address': 'A', 'lat': 41.0, 'lng': 70.1},
      'dropoff': const {'address': 'B', 'lat': 41.02, 'lng': 70.15},
      'status': status,
      'serviceType': serviceType,
      'estimatedPrice': 18000,
      'createdAt': '2026-10-10T10:00:00.000Z',
    });

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Bekor qilish narxi (INCIDENT-POLICY §5)', () {
    test('javob o\'qiladi: jarima va bepul oyna', () {
      final paid = CancelFeeQuote.fromJson(const {'fee': 3000, 'reason': 'after_free_window', 'freeUntil': null});
      expect(paid.fee, 3000);
      expect(paid.isFree, isFalse);
      final free = CancelFeeQuote.fromJson(const {'fee': 0, 'freeUntil': '2026-11-04T10:02:00.000Z'});
      expect(free.isFree, isTrue);
      expect(free.freeUntil, isNotNull);
      expect(CancelFeeQuote.fromJson(const {'fee': -5}).fee, 0);
    });

    test("server so'raladi; xato — null (server 409 bilan qayta so'raydi)", () async {
      final api = _MockApiClient();
      when(() => api.get(ApiEndpoints.cancelFee('o-1'))).thenAnswer((_) async => _ok({'fee': 3000}));
      expect((await CancelFeeService(api).quote('o-1'))?.fee, 3000);
      when(() => api.get(ApiEndpoints.cancelFee('o-2'))).thenThrow(Exception('offline'));
      expect(await CancelFeeService(api).quote('o-2'), isNull);
    });

    test('jarima faqat taksi va yukda', () {
      expect(_order().taxiPenaltiesApply, isTrue);
      expect(_order(serviceType: 'cargo').taxiPenaltiesApply, isTrue);
      expect(_order(serviceType: 'food').taxiPenaltiesApply, isFalse);
      expect(_order(serviceType: 'parcel').taxiPenaltiesApply, isFalse);
    });
  });

  group('Haydovchi: kelmaslik va uzilish', () {
    late _MockApiClient api;
    late DriverProvider driver;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await sl.reset();
      api = _MockApiClient();
      driver = DriverProvider(
        apiClient: api,
        socketService: SocketService(),
        locationService: _NoGpsLocation(),
        localStorage: LocalStorage(await SharedPreferences.getInstance()),
      );
    });

    tearDown(() async => sl.reset());

    test("'yo'lovchi chiqmadi' — server endpointi, safar yopiladi", () async {
      when(() => api.patch(ApiEndpoints.noShow('o-1'))).thenAnswer((_) async => _ok({'status': 'cancelled'}));
      driver.debugSetActiveOrderForTest(_order());
      await driver.markNoShow();
      expect(driver.state, DriverProviderState.success);
      expect(driver.activeOrder, isNull);
    });

    test('erta bosilsa — server xabari, safar qoladi', () async {
      when(() => api.patch(ApiEndpoints.noShow('o-1'))).thenThrow(DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 400,
          data: {'message': "Yo'lovchini yana biroz kuting", 'code': 'NO_SHOW_NOT_ALLOWED'},
        ),
      ));
      driver.debugSetActiveOrderForTest(_order());
      await driver.markNoShow();
      expect(driver.state, DriverProviderState.error);
      expect(driver.error, contains('kuting'));
      expect(driver.activeOrder, isNotNull);
    });

    test('safar uzildi — sabab va izoh yuboriladi, undirilgan summa qaytadi', () async {
      when(() => api.patch(ApiEndpoints.interruptTrip('o-1'), data: any(named: 'data')))
          .thenAnswer((_) async => _ok({'finalPrice': 7200, 'tripOutcome': 'interrupted'}));
      driver.debugSetActiveOrderForTest(_order(status: 'in_progress'));
      final price = await driver.interruptTrip(reason: 'breakdown', note: ' shina ');
      expect(price, 7200);
      final sent = verify(() => api.patch(ApiEndpoints.interruptTrip('o-1'), data: captureAny(named: 'data'))).captured.single
          as Map<String, dynamic>;
      expect(sent, {'reason': 'breakdown', 'note': 'shina'});
      expect(driver.activeOrder, isNull);
    });
  });
}
