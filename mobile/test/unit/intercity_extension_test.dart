// Shaharlararo — "shahar ichiga davom" (backend intercity-extension.ts).
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _ok(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

// Egasi bergan Rohat krugi koordinatasi.
final _rohat = IntercityPoint.fromJson(const {
  'id': 'p-rohat',
  'name': 'Rohat krugi',
  'centerLat': 41.268028,
  'centerLng': 69.366806,
  'radiusKm': 1.5,
  'extension': {'maxKm': 30, 'pricePerKm': 2000, 'comfortPricePerKm': 2500},
});

const _extensionJson = {
  'side': 'dropoff',
  'pointName': 'Rohat krugi',
  'km': 12.4,
  'pricePerKm': 2000,
  'fare': 25000,
  'estimated': false,
};

void main() {
  group('IntercityPoint.extension', () {
    test("JSON dan o'qiladi; yo'q bo'lsa null", () {
      expect(_rohat.extension?.maxKm, 30);
      expect(_rohat.extension?.pricePerKm, 2000);
      expect(_rohat.extension?.comfortPricePerKm, 2500);
      final plain = IntercityPoint.fromJson(const {
        'id': 'a',
        'name': 'Angren',
        'centerLat': 41,
        'centerLng': 70,
        'radiusKm': 12,
      });
      expect(plain.extension, isNull);
    });

    test('zona: radius ichi, davom, tashqari — server bilan bir xil', () {
      // ~0.009° kenglik ≈ 1 km.
      expect(_rohat.zoneOf(_rohat.centerLat + 0.009, _rohat.centerLng),
          IntercityZone.inside);
      expect(_rohat.zoneOf(_rohat.centerLat + 0.09, _rohat.centerLng),
          IntercityZone.extension);
      expect(_rohat.zoneOf(_rohat.centerLat + 0.4, _rohat.centerLng),
          IntercityZone.outside);
    });

    test("davomsiz nuqtada radiusdan tashqari — outside", () {
      final noExt = IntercityPoint.fromJson(const {
        'id': 'r',
        'name': 'R',
        'centerLat': 41.268028,
        'centerLng': 69.366806,
        'radiusKm': 1.5,
        'extension': null,
      });
      expect(noExt.zoneOf(41.268028 + 0.09, 69.366806), IntercityZone.outside);
      expect(noExt.allows(41.268028 + 0.09, 69.366806), isFalse);
      expect(_rohat.allows(_rohat.centerLat + 0.09, _rohat.centerLng), isTrue);
    });
  });

  group('IntercityQuote', () {
    test('asosiy narx, davom qatorlari va jami', () {
      final quote = IntercityQuote.fromJson(const {
        'tripId': 't1',
        'kind': 'seat',
        'seats': 2,
        'basePrice': 50000,
        'extensions': [_extensionJson],
        'total': 75000,
      });
      expect(quote.basePrice, 50000);
      expect(quote.total, 75000);
      expect(quote.extensions.single.km, 12.4);
      expect(quote.extensions.single.isDropoff, isTrue);
      expect(quote.extensions.single.fare, 25000);
    });

    test('bandda va haydovchi bandida davom qatorlari; eski javobda bo\'sh', () {
      final booking = IntercityBooking.fromJson(const {
        'orderId': 'o1',
        'status': 'scheduled',
        'price': 75000,
        'basePrice': 50000,
        'extensions': [_extensionJson],
      });
      expect(booking.basePrice, 50000);
      expect(booking.extensions.single.pointName, 'Rohat krugi');

      final old = IntercityBooking.fromJson(
          const {'orderId': 'o1', 'status': 'scheduled', 'price': 50000});
      expect(old.extensions, isEmpty);
      expect(old.basePrice, 50000);

      final driverBooking = IntercityDriverBooking.fromJson(const {
        'orderId': 'o1',
        'status': 'in_progress',
        'price': 75000,
        'passenger': {'name': 'Jasur', 'phone': null},
        'extensions': [_extensionJson],
      });
      expect(driverBooking.extensions.single.km, 12.4);
    });
  });

  group('IntercityRepository.quote', () {
    test("quote endpointiga band bilan bir xil tana yuboradi", () async {
      final api = _MockApiClient();
      final repo = IntercityRepository(apiClient: api);
      when(() => api.post(any(), data: any(named: 'data'))).thenAnswer(
        (_) async => _ok('/x', const {
          'tripId': 't1',
          'kind': 'seat',
          'seats': 1,
          'basePrice': 25000,
          'extensions': <Map<String, dynamic>>[],
          'total': 25000,
        }),
      );

      final quote = await repo.quote(
        tripId: 't1',
        kind: IntercityBookingKind.seat,
        seats: 1,
        pickup: const IntercityPlace(lat: 1, lng: 2, address: 'A'),
        dropoff: const IntercityPlace(lat: 3, lng: 4, address: 'B'),
      );

      expect(quote.total, 25000);
      final data = verify(() => api.post(
            ApiEndpoints.intercityTripQuote('t1'),
            data: captureAny(named: 'data'),
          )).captured.single as Map;
      expect(data['kind'], 'seat');
      expect(data['seats'], 1);
      expect(data['paymentMethod'], 'cash');
      expect((data['dropoff'] as Map)['address'], 'B');
    });
  });
}
