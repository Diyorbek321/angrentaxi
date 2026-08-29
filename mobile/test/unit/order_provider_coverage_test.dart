// `OrderProvider` ning xizmat qamrovi bilan bog'liq xulq-atvori.
//
// Shahar OLISH NUQTASIDAN aniqlanadi — foydalanuvchi qo'lda tanlamaydi,
// chunki qo'lda tanlash yana bir xato manbai bo'lardi (odam Angrenni
// tanlab Toshkentdan buyurtma berishi mumkin).
//
// Bu yerdagi testlar ikki tomonni ham qamraydi:
//   · DARVOZA  — qamrov tashqarisidagi buyurtma tarmoqqa umuman chiqmaydi;
//   · HIMOYA   — qamrov ma'lumoti bo'lmasa (bo'sh ro'yxat yoki yiqilgan
//                so'rov) HECH NARSA bloklanmaydi.
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

const Map<String, dynamic> _angrenCityJson = {
  'id': 'city-angren',
  'name': 'Angren',
  'centerLat': 40.0956,
  'centerLng': 70.9432,
  'radiusKm': 25,
};

// Angren doirasi ichidagi nuqta.
const double _insideLat = 40.1050;
const double _insideLng = 70.9500;

// Toshkent — Angren doirasidan ancha uzoq.
const double _outsideLat = 41.2995;
const double _outsideLng = 69.2401;

const Map<String, dynamic> _createdOrderJson = {
  'id': 'order-1',
  'passengerId': 'passenger-1',
  'pickup': {'address': 'Olish', 'lat': _insideLat, 'lng': _insideLng},
  'dropoff': {'address': 'Tushish', 'lat': 40.1100, 'lng': 70.9600},
  'status': 'searching',
  'estimatedPrice': 20000.0,
  'createdAt': '2026-07-13T10:00:00.000Z',
};

const _tariff = Tariff(
  id: 'tariff-1',
  name: 'Standart',
  description: '',
  baseFare: 5000,
  perKmRate: 1500,
  minFare: 8000,
);

Response<dynamic> _jsonResponse(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

void main() {
  late MockApiClient apiClient;
  late OrderProvider provider;

  setUp(() {
    apiClient = MockApiClient();
    provider =
        OrderProvider(apiClient: apiClient, socketService: SocketService());

    when(() => apiClient.post(ApiEndpoints.createOrder, data: any(named: 'data')))
        .thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.createOrder, _createdOrderJson),
    );
  });

  void stubCities(dynamic cities) {
    when(() => apiClient.get(ApiEndpoints.cities)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.cities, cities),
    );
  }

  void setPendingTrip({required double lat, required double lng}) {
    provider.setPendingPickup(
      OrderLocation(address: 'Olish', lat: lat, lng: lng),
    );
    provider.setPendingDropoff(
      const OrderLocation(address: 'Tushish', lat: 40.1100, lng: 70.9600),
    );
    provider.selectTariff(_tariff);
  }

  group('qamrov ro\'yxati', () {
    test('GET /cities dan faol shaharlarni o\'qiydi', () async {
      stubCities([_angrenCityJson]);

      await provider.loadCities();

      expect(provider.coverage.cities.single.name, 'Angren');
    });

    test('bir sessiyada ikki marta so\'ralmaydi', () async {
      stubCities([_angrenCityJson]);

      await provider.loadCities();
      await provider.loadCities();

      verify(() => apiClient.get(ApiEndpoints.cities)).called(1);
    });

    test('bir vaqtda ikki chaqiruv bitta so\'rovga birlashadi', () async {
      stubCities([_angrenCityJson]);

      await Future.wait([provider.loadCities(), provider.loadCities()]);

      verify(() => apiClient.get(ApiEndpoints.cities)).called(1);
    });
  });

  group('ogohlantirish matni', () {
    test('hudud tashqarisida eng yaqin shahar nomi bilan tushuntiriladi',
        () async {
      stubCities([_angrenCityJson]);
      await provider.loadCities();

      final warning = provider.coverageWarningFor(_outsideLat, _outsideLng);

      // Xabar ikki qismdan iborat: NIMA bo'lgani va NIMA qilish mumkinligi.
      expect(warning, isNotNull);
      expect(warning, contains("Bu hududda hozircha xizmat ko'rsatilmaymiz"));
      expect(warning, contains('Eng yaqin xizmat hududi: Angren'));
      expect(provider.nearestServiceCity(_outsideLat, _outsideLng)?.name,
          'Angren');
    });

    test('hudud ichida ogohlantirish yo\'q', () async {
      stubCities([_angrenCityJson]);
      await provider.loadCities();

      expect(provider.coverageWarningFor(_insideLat, _insideLng), isNull);
    });

    test('ogohlantirish OLISH nuqtasidan hisoblanadi', () async {
      stubCities([_angrenCityJson]);
      await provider.loadCities();

      // Tushish nuqtasi hudud tashqarisida bo'lishi mumkin — shahardan
      // chiqib ketadigan safar taqiqlanmaydi. Faqat olish nuqtasi muhim.
      setPendingTrip(lat: _insideLat, lng: _insideLng);
      provider.setPendingDropoff(
        const OrderLocation(
          address: 'Toshkent',
          lat: _outsideLat,
          lng: _outsideLng,
        ),
      );
      expect(provider.isPickupOutsideCoverage, isFalse);

      provider.setPendingPickup(
        const OrderLocation(
          address: 'Toshkent',
          lat: _outsideLat,
          lng: _outsideLng,
        ),
      );
      expect(provider.isPickupOutsideCoverage, isTrue);
    });

    test('olish nuqtasi tanlanmagan bo\'lsa ogohlantirish yo\'q', () async {
      stubCities([_angrenCityJson]);
      await provider.loadCities();

      expect(provider.coverageWarning, isNull);
      expect(provider.isPickupOutsideCoverage, isFalse);
    });
  });

  group('HIMOYA — qamrov ma\'lumoti yo\'q', () {
    test('bo\'sh ro\'yxat buyurtmani bloklamaydi', () async {
      stubCities(<dynamic>[]);
      await provider.loadCities();

      setPendingTrip(lat: _outsideLat, lng: _outsideLng);

      expect(provider.coverageWarning, isNull);
      expect(await provider.createOrder(), isTrue);
      verify(() => apiClient.post(ApiEndpoints.createOrder,
          data: any(named: 'data'))).called(1);
    });

    test('so\'rov yiqilsa ham buyurtma o\'tadi', () async {
      when(() => apiClient.get(ApiEndpoints.cities)).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: ApiEndpoints.cities),
          type: DioExceptionType.connectionError,
        ),
      );

      // Xato JIMGINA yutiladi: qamrov yuklanmagani buyurtma oqimini
      // buzmasligi kerak, shuning uchun umumiy holat ham o'zgarmaydi.
      await provider.loadCities();
      expect(provider.state, OrderProviderState.idle);
      expect(provider.error, isNull);

      setPendingTrip(lat: _outsideLat, lng: _outsideLng);

      expect(provider.coverageWarning, isNull);
      expect(await provider.createOrder(), isTrue);
    });

    test('yiqilgan so\'rovdan keyin qayta urinishga yo\'l ochiq', () async {
      when(() => apiClient.get(ApiEndpoints.cities)).thenThrow(
        DioException(requestOptions: RequestOptions(path: ApiEndpoints.cities)),
      );
      await provider.loadCities();

      stubCities([_angrenCityJson]);
      await provider.loadCities();

      expect(provider.coverage.cities.single.name, 'Angren');
    });

    test('qamrov umuman so\'ralmagan bo\'lsa ham buyurtma o\'tadi', () async {
      setPendingTrip(lat: _outsideLat, lng: _outsideLng);

      expect(provider.coverageWarning, isNull);
      expect(await provider.createOrder(), isTrue);
    });
  });

  group('DARVOZA — createOrder', () {
    test('hudud tashqarisidagi buyurtma tarmoqqa CHIQMAYDI', () async {
      stubCities([_angrenCityJson]);
      await provider.loadCities();
      setPendingTrip(lat: _outsideLat, lng: _outsideLng);

      final created = await provider.createOrder();

      expect(created, isFalse);
      expect(provider.state, OrderProviderState.error);
      expect(provider.error, contains('Eng yaqin xizmat hududi: Angren'));
      verifyNever(() => apiClient.post(ApiEndpoints.createOrder,
          data: any(named: 'data')));
    });

    test('hudud ichidagi buyurtma odatdagidek yaratiladi', () async {
      stubCities([_angrenCityJson]);
      await provider.loadCities();
      setPendingTrip(lat: _insideLat, lng: _insideLng);

      expect(await provider.createOrder(), isTrue);
      expect(provider.activeOrder?.id, 'order-1');
    });

    test('serverning 400 xabari foydalanuvchiga ko\'rsatiladi', () async {
      // Ikki qatlamli himoya: mobil oldindan tekshiradi, oxirgi so'zni
      // esa server aytadi (masalan qamrov ilova bilganidan keyin
      // o'zgargan bo'lsa).
      stubCities(<dynamic>[]);
      await provider.loadCities();
      setPendingTrip(lat: _outsideLat, lng: _outsideLng);

      when(() => apiClient.post(ApiEndpoints.createOrder,
          data: any(named: 'data'))).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
            statusCode: 400,
            data: {
              'message': "Bu hududda hozircha xizmat ko'rsatilmaymiz",
            },
          ),
        ),
      );

      expect(await provider.createOrder(), isFalse);
      expect(provider.state, OrderProviderState.error);
      expect(provider.error, "Bu hududda hozircha xizmat ko'rsatilmaymiz");
    });
  });
}
