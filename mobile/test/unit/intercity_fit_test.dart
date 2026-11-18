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

void main() {
  group('tumanlar va moslik modellari', () {
    test("nuqta tumanlari `zones` dan o'qiladi", () {
      final point = IntercityPoint.fromJson({
        'id': 'p',
        'name': 'Rohat krugi',
        'centerLat': 41.268,
        'centerLng': 69.367,
        'radiusKm': 1.5,
        'extension': {'maxKm': 30, 'pricePerKm': 2000, 'comfortPricePerKm': 2500},
        'zones': [
          {'id': 'z1', 'name': 'Yunusobod', 'centerLat': 41.365, 'centerLng': 69.288, 'radiusKm': 4},
        ],
      });
      expect(point.districts.single.name, 'Yunusobod');
      expect(point.districts.single.contains(41.366, 69.289), isTrue);
      expect(point.districts.single.contains(41.227, 69.219), isFalse);
    });

    test("qatnov: tumanlar va qidiruv belgisi (fit)", () {
      final trip = IntercityTrip.fromJson({
        'id': 't1',
        'route': {'id': 'r1', 'origin': {'name': 'Angren'}, 'destination': {'name': 'Rohat krugi'}},
        'tripClass': 'start',
        'departureAt': '2026-10-18T02:00:00.000Z',
        'status': 'open',
        'seatsTotal': 4,
        'seatsLeft': 3,
        'wholeCarAvailable': false,
        'seatPrice': 25000,
        'wholeCarPrice': 100000,
        'zones': {
          'origin': [],
          'destination': [
            {'id': 'z1', 'name': 'Yunusobod'},
          ],
        },
        'fit': {'fit': 'detour', 'addedMinutes': 22, 'detourChecked': true, 'zoneNames': []},
      });
      expect(trip.destinationDistricts.single.name, 'Yunusobod');
      expect(trip.originDistricts, isEmpty);
      expect(trip.fit?.isDetour, isTrue);
      expect(trip.fit?.addedMinutes, 22);
    });

    test("eski server (zones/fit yo'q) — bo'sh va null", () {
      final trip = IntercityTrip.fromJson({
        'id': 't1',
        'departureAt': '2026-10-18T02:00:00.000Z',
        'seatsTotal': 4,
        'seatsLeft': 4,
        'seatPrice': 1,
        'wholeCarPrice': 1,
      });
      expect(trip.destinationDistricts, isEmpty);
      expect(trip.fit, isNull);
    });

    test("quote: tumandan tashqari va aylanma — band qilish to'sib qo'yiladi", () {
      final quote = IntercityQuote.fromJson({
        'basePrice': 25000,
        'extensions': [],
        'total': 25000,
        'zoneOk': false,
        'outOfZone': {
          'side': 'destination',
          'zoneNames': ['Yunusobod'],
        },
        'detourMinutes': null,
        'detourChecked': true,
        'detourTooLong': false,
        'maxDetourMinutes': 15,
      });
      expect(quote.fit.zoneOk, isFalse);
      expect(quote.fit.zoneNames, ['Yunusobod']);
      expect(quote.fit.blocksBooking, isTrue);

      final detour = IntercityQuote.fromJson({'basePrice': 1, 'total': 1, 'detourMinutes': 22, 'detourTooLong': true});
      expect(detour.fit.blocksBooking, isTrue);
      final old = IntercityQuote.fromJson({'basePrice': 1, 'total': 1});
      expect(old.fit, IntercityQuoteFit.ok);
      expect(old.fit.blocksBooking, isFalse);
    });

    test('bekatlar rejasi', () {
      final plan = IntercityRoutePlan.fromJson({
        'phase': 'dropoff',
        'point': {'name': 'Rohat krugi', 'lat': 41.2, 'lng': 69.3},
        'stops': [
          {'sequence': 1, 'orderId': 'o2', 'kind': 'dropoff', 'address': 'Mirzo Ulug‘bek', 'lat': 41.33, 'lng': 69.33, 'etaMinutesFromPrev': 9},
          {'sequence': 2, 'orderId': 'o1', 'kind': 'dropoff', 'lat': 41.36, 'lng': 69.29, 'etaMinutesFromPrev': null},
        ],
        'terminalEtaMinutes': null,
        'totalMinutes': 15,
        'optimized': true,
      });
      expect(plan.stops.map((s) => s.orderId), ['o2', 'o1']);
      expect(plan.byOrderId['o1']?.sequence, 2);
      expect(plan.stops.last.etaMinutesFromPrev, isNull);
      expect(plan.totalMinutes, 15);
    });

    test("ochiq sozlamada aylanma chegarasi (yo'q bo'lsa 15)", () {
      expect(IntercityPublicSettings.fromJson({'intercityMaxDetourMinutes': 0}).maxDetourMinutes, 0);
      expect(IntercityPublicSettings.fromJson(const {}).maxDetourMinutes, 15);
    });
  });

  group('IntercityRepository — tumanlar', () {
    late _MockApiClient api;
    late IntercityRepository repo;

    setUp(() {
      api = _MockApiClient();
      repo = IntercityRepository(apiClient: api);
    });

    test("qidiruvga yo'lovchi manzili qo'shiladi", () async {
      when(() => api.get(ApiEndpoints.intercityTrips, params: any(named: 'params')))
          .thenAnswer((_) async => _ok(ApiEndpoints.intercityTrips, []));
      await repo.searchTrips(
        routeId: 'r1',
        date: '2026-10-18',
        dropoff: const IntercityPlace(lat: 41.36, lng: 69.29, address: 'Yunusobod'),
      );
      verify(() => api.get(ApiEndpoints.intercityTrips, params: {
            'routeId': 'r1',
            'date': '2026-10-18',
            'dropoffLat': 41.36,
            'dropoffLng': 69.29,
          })).called(1);
    });

    test("e'londa tumanlar faqat tanlangan bo'lsa yuboriladi", () async {
      when(() => api.post(ApiEndpoints.intercityTrips, data: any(named: 'data'))).thenAnswer(
        (_) async => _ok(ApiEndpoints.intercityTrips, {
          'id': 't1',
          'departureAt': '2026-10-18T02:00:00.000Z',
          'seatsTotal': 4,
          'seatsLeft': 4,
          'seatPrice': 1,
          'wholeCarPrice': 1,
        }),
      );
      final departure = DateTime.utc(2026, 10, 18, 2);
      await repo.publishTrip(
        routeId: 'r1',
        departureAt: departure,
        tripClass: 'start',
        destinationDistrictIds: const ['z1', 'z2'],
      );
      final body = verify(() => api.post(ApiEndpoints.intercityTrips, data: captureAny(named: 'data')))
          .captured
          .single as Map<String, dynamic>;
      expect(body['destinationZoneIds'], ['z1', 'z2']);
      expect(body.containsKey('originZoneIds'), isFalse);
    });

    test('bekatlar rejasi haydovchi joyi bilan so‘raladi', () async {
      when(() => api.get(ApiEndpoints.intercityTripRoutePlan('t1'), params: any(named: 'params'))).thenAnswer(
        (_) async => _ok('/x', {'phase': 'pickup', 'point': {'name': 'Angren'}, 'stops': [], 'optimized': false}),
      );
      final plan = await repo.routePlan('t1', fromLat: 40.1, fromLng: 70.9);
      expect(plan.phase, 'pickup');
      expect(plan.optimized, isFalse);
      verify(() => api.get(ApiEndpoints.intercityTripRoutePlan('t1'), params: {'fromLat': 40.1, 'fromLng': 70.9}))
          .called(1);
    });
  });
}
