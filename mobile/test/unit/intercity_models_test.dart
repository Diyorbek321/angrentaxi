import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
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

DioException _coded(String code, {List<Map<String, String>>? reasons}) =>
    DioException(
      requestOptions: RequestOptions(path: '/x'),
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: 409,
        data: {'code': code, 'message': 'server: $code', 'reasons': reasons},
      ),
    );

void main() {
  group('Toshkent kuni', () {
    test('UTC 19:00 dan keyin Toshkentda ertangi kun boshlanadi', () {
      expect(tashkentDateKey(DateTime.utc(2026, 10, 17, 18, 59)), '2026-10-17');
      expect(tashkentDateKey(DateTime.utc(2026, 10, 17, 19)), '2026-10-18');
    });

    test('7 ta ketma-ket kun, oy chegarasidan o\'tadi', () {
      final days = upcomingTashkentDays(DateTime.utc(2026, 10, 28, 12));
      expect(days.first, '2026-10-28');
      expect(days.last, '2026-11-03');
      expect(days, hasLength(7));
    });
  });

  group('IntercityPoint', () {
    const angren = IntercityPoint(
      id: 'a',
      name: 'Angren',
      centerLat: 41.0167,
      centerLng: 70.1436,
      radiusKm: 12,
    );

    test('radius ichidagi nuqta — ichkarida, Toshkent — tashqarida', () {
      expect(angren.contains(41.02, 70.14), isTrue);
      expect(angren.contains(41.3111, 69.2797), isFalse);
    });

    test("2 km gacha radius — qat'iy to'xtash joyi", () {
      expect(angren.isFixedStand, isFalse);
      const rohat = IntercityPoint(
        id: 'r',
        name: 'Rohat',
        centerLat: 41.3,
        centerLng: 69.2,
        radiusKm: 1.5,
      );
      expect(rohat.isFixedStand, isTrue);
    });
  });

  group('JSON', () {
    test("yo'nalish: comfort bo'lmasa null", () {
      final route = IntercityRoute.fromJson(const {
        'id': 'r1',
        'origin': {'id': 'a', 'name': 'A', 'centerLat': 1, 'centerLng': 2, 'radiusKm': 3},
        'destination': {'id': 'b', 'name': 'B', 'centerLat': 1, 'centerLng': 2, 'radiusKm': 3},
        'seatPrice': '15000.00',
        'wholeCarPrice': 60000,
        'comfort': null,
        'seatsDefault': 4,
      });
      expect(route.seatPrice, 15000);
      expect(route.hasComfort, isFalse);
    });

    test('band: faqat SCHEDULED va open|full qatnovda bekor qilinadi', () {
      Map<String, dynamic> booking(String status, String tripStatus) => {
            'orderId': 'o1',
            'status': status,
            'bookingKind': 'whole_car',
            'seats': null,
            'price': 100000,
            'trip': {
              'id': 't1',
              'route': {'id': 'r1'},
              'departureAt': '2026-10-18T02:00:00.000Z',
              'status': tripStatus,
            },
          };
      expect(IntercityBooking.fromJson(booking('scheduled', 'full')).isCancellable,
          isTrue);
      expect(
          IntercityBooking.fromJson(booking('accepted', 'boarding')).isCancellable,
          isFalse);
      expect(IntercityBooking.fromJson(booking('scheduled', 'open')).isWholeCar,
          isTrue);
    });

    test("sozlamalar: maydon yo'q bo'lsa o'chiq va standartlar", () {
      final s = IntercityPublicSettings.fromJson(const {});
      expect(s.enabled, isFalse);
      expect(s.freeCancelMinutes, 60);
      expect(s.maxSeatsPerBooking, 4);
    });
  });

  group('IntercityRepository', () {
    late _MockApiClient api;
    late IntercityRepository repo;

    setUp(() {
      api = _MockApiClient();
      repo = IntercityRepository(apiClient: api);
    });

    test("bandlar sahifasi `items` ichidan o'qiladi", () async {
      when(() => api.get(ApiEndpoints.intercityMyBookings)).thenAnswer(
        (_) async => _ok(ApiEndpoints.intercityMyBookings, {
          'items': [
            {'orderId': 'o1', 'status': 'scheduled', 'price': 50000},
          ],
          'total': 1,
          'page': 1,
          'limit': 20,
        }),
      );
      final items = await repo.myBookings();
      expect(items.single.orderId, 'o1');
    });

    test("qidiruv routeId va date bilan so'raydi", () async {
      when(() => api.get(ApiEndpoints.intercityTrips,
              params: any(named: 'params')))
          .thenAnswer((_) async => _ok(ApiEndpoints.intercityTrips, []));
      await repo.searchTrips(routeId: 'r1', date: '2026-10-18');
      verify(() => api.get(ApiEndpoints.intercityTrips,
          params: {'routeId': 'r1', 'date': '2026-10-18'})).called(1);
    });

    test("butun mashinada `seats` yuborilmaydi, to'lov naqd", () async {
      when(() => api.post(any(), data: any(named: 'data'))).thenAnswer(
        (_) async => _ok('/x', {'orderId': 'o1', 'status': 'scheduled', 'price': 1}),
      );
      await repo.book(
        tripId: 't1',
        kind: IntercityBookingKind.wholeCar,
        seats: 3,
        pickup: const IntercityPlace(lat: 1, lng: 2, address: 'A'),
        dropoff: const IntercityPlace(lat: 3, lng: 4, address: 'B'),
      );
      final data = verify(() => api.post(
            ApiEndpoints.intercityTripBookings('t1'),
            data: captureAny(named: 'data'),
          )).captured.single as Map;
      expect(data.containsKey('seats'), isFalse);
      expect(data['paymentMethod'], 'cash');
      expect(data['kind'], 'whole_car');
    });
  });

  group('Xato matnlari', () {
    test('ma\'lum kod — ilova tilida', () {
      expect(intercityErrorMessage(_coded('INTERCITY_ALREADY_BOOKED')),
          'Siz bu qatnovda allaqachon joy band qilgansiz');
      expect(isSeatsUnavailable(_coded('INTERCITY_SEATS_UNAVAILABLE')), isTrue);
    });

    test('BOOKING_INVALID — server sabablari qatorlab', () {
      final message = intercityErrorMessage(_coded(
        'INTERCITY_BOOKING_INVALID',
        reasons: [
          {'code': 'PICKUP_OUTSIDE_ORIGIN', 'message': 'Olish nuqtasi tashqarida'},
          {'code': 'TOO_MANY_SEATS', 'message': "Joy ko'p"},
        ],
      ));
      expect(message, "Olish nuqtasi tashqarida\nJoy ko'p");
    });

    test("noma'lum kod — server xabari", () {
      expect(intercityErrorMessage(_coded('SOMETHING_ELSE')),
          'server: SOMETHING_ELSE');
    });

    test('davomiylik', () {
      expect(formatIntercityDuration(const Duration(minutes: 135)),
          '2 soat 15 daq');
      expect(formatIntercityDuration(const Duration(minutes: 40)), '40 daq');
      expect(formatIntercityDuration(const Duration(minutes: -5)), '0 daq');
    });
  });
}
