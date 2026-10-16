// Haydovchining "joriy buyurtma" tiklanishi shaharlararo bandlarini
// O'TKAZIB YUBORADI.
//
// Yig'ish boshlangach (start-boarding) har bir band ACCEPTED bo'ladi —
// ya'ni `Order.isActive`. Filtr bo'lmasa `checkActiveOrder` birinchisini
// shahar safari deb oladi va bosh ekran haydovchini taksi oqimiga
// (yetib keldim → safar → yakunlash) qulflab qo'yadi — u yerda esa
// `/orders/:id/start` intercity uchun 400 qaytaradi.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

Map<String, dynamic> _order(String id, String status, {String? serviceType}) => {
      'id': id,
      'passengerId': 'p-$id',
      'pickup': {'address': 'Angren', 'lat': 41.01, 'lng': 70.14},
      'dropoff': {'address': 'Rohat krugi', 'lat': 41.31, 'lng': 69.28},
      'status': status,
      'estimatedPrice': 25000.0,
      'createdAt': '2026-10-17T05:00:00.000Z',
      if (serviceType != null) 'serviceType': serviceType,
    };

void main() {
  late _MockApiClient api;
  late DriverProvider provider;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    api = _MockApiClient();
    provider = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: LocalStorage(await SharedPreferences.getInstance()),
    );
  });

  void stubHistory(List<Map<String, dynamic>> orders) {
    when(() => api.get(ApiEndpoints.driverOrderHistory)).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.driverOrderHistory),
        data: {
          'success': true,
          'data': {'orders': orders},
        },
      ),
    );
  }

  test("faol intercity band shahar safari deb tiklanmaydi", () async {
    stubHistory([_order('ic-1', 'accepted', serviceType: 'intercity')]);

    await provider.checkActiveOrder();

    expect(provider.activeOrder, isNull);
    expect(provider.hasActiveOrder, isFalse);
    expect(provider.hasIntercityInFlight, isTrue);
  });

  test("intercity band bilan birga turgan shahar safari tiklanadi", () async {
    stubHistory([
      _order('ic-1', 'in_progress', serviceType: 'intercity'),
      _order('taxi-1', 'arrived', serviceType: 'taxi'),
    ]);

    await provider.checkActiveOrder();

    expect(provider.activeOrder?.id, 'taxi-1');
  });

  test("tugagan intercity band 'yo'lda' deb hisoblanmaydi", () async {
    stubHistory([_order('ic-1', 'completed', serviceType: 'intercity')]);

    await provider.checkActiveOrder();

    expect(provider.hasIntercityInFlight, isFalse);
  });
}
