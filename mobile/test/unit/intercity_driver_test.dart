import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_driver_policy.dart';
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

Map<String, dynamic> _tripJson({
  String id = 't1',
  String status = 'open',
  String departureAt = '2026-10-18T02:00:00.000Z',
  int seatsTotal = 4,
  int seatsLeft = 4,
  bool wholeCarBooked = false,
}) =>
    {
      'id': id,
      'route': const {
        'id': 'r1',
        'origin': {'id': 'p-a', 'name': 'Angren'},
        'destination': {'id': 'p-r', 'name': 'Rohat krugi'},
      },
      'tripClass': 'start',
      'departureAt': departureAt,
      'status': status,
      'seatsTotal': seatsTotal,
      'seatsLeft': seatsLeft,
      'wholeCarAvailable': seatsLeft == seatsTotal && !wholeCarBooked,
      'wholeCarBooked': wholeCarBooked,
      'seatPrice': 25000,
      'wholeCarPrice': 100000,
      'driver': null,
      'cancelReason': null,
    };

IntercityTrip _trip({
  String id = 't1',
  String status = 'open',
  DateTime? departureAt,
  int seatsLeft = 4,
  bool wholeCarBooked = false,
}) =>
    IntercityTrip.fromJson(_tripJson(
      id: id,
      status: status,
      departureAt: (departureAt ?? DateTime.utc(2026, 10, 18, 2)).toIso8601String(),
      seatsLeft: seatsLeft,
      wholeCarBooked: wholeCarBooked,
    ));

void main() {
  group('modellar', () {
    test('sozlamalar e\'lon oynasini o\'qiydi, standartlar saqlanadi', () {
      final s = IntercityPublicSettings.fromJson(const {
        'intercityEnabled': true,
        'intercityMinLeadMinutes': 45,
        'intercityMaxAheadDays': 3,
      });
      expect(s.minLeadMinutes, 45);
      expect(s.maxAheadDays, 3);
      expect(IntercityPublicSettings.disabled.minLeadMinutes, 30);
      expect(IntercityPublicSettings.disabled.maxAheadDays, 7);
    });

    test("band qilingan joylar: o'rindiq va butun mashina", () {
      expect(_trip(seatsLeft: 1).seatsTaken, 3);
      final whole = _trip(seatsLeft: 0, wholeCarBooked: true);
      expect(whole.wholeCarBooked, isTrue);
      expect(whole.seatsTaken, 4);
    });
  });

  group("e'lon oynasi", () {
    final now = DateTime.utc(2026, 10, 17, 5);
    const settings = IntercityPublicSettings(
      enabled: true,
      minLeadMinutes: 30,
      maxAheadDays: 7,
    );

    test('chegaralar: hozir+30 daq va hozir+7 kun', () {
      final w = IntercityPublishWindow.from(now, settings);
      expect(w.earliest, now.add(const Duration(minutes: 30)));
      expect(w.latest, now.add(const Duration(days: 7)));
    });

    test('oyna ichida — xato yo\'q, tashqarisida — sabab', () {
      final w = IntercityPublishWindow.from(now, settings);
      expect(w.check(now.add(const Duration(hours: 2))), isNull);
      expect(w.check(now.add(const Duration(minutes: 10))),
          IntercityDepartureIssue.tooSoon);
      expect(w.check(now.add(const Duration(days: 8))),
          IntercityDepartureIssue.tooFar);
    });
  });

  group("yig'ishni boshlash", () {
    final departure = DateTime.utc(2026, 10, 18, 2);

    test("jo'nashdan 60 daqiqa oldin ochiladi", () {
      final trip = _trip(departureAt: departure, seatsLeft: 2);
      expect(
          canStartBoarding(trip, departure.subtract(const Duration(minutes: 61))),
          isFalse);
      expect(
          canStartBoarding(trip, departure.subtract(const Duration(minutes: 60))),
          isTrue);
    });

    test("to'la qatnovda istalgan vaqtda, lekin kamida bitta band kerak", () {
      final early = departure.subtract(const Duration(hours: 5));
      expect(canStartBoarding(_trip(status: 'full', seatsLeft: 0), early), isTrue);
      expect(canStartBoarding(_trip(seatsLeft: 4), departure), isFalse);
    });

    test('bekor qilingan yoki yo\'ldagi qatnovda yo\'q', () {
      expect(canStartBoarding(_trip(status: 'cancelled', seatsLeft: 2), departure),
          isFalse);
      expect(canStartBoarding(_trip(status: 'boarding', seatsLeft: 2), departure),
          isFalse);
    });
  });

  group('qatnovlarim', () {
    final now = DateTime.utc(2026, 10, 17, 5);

    test('kelgusi (jo\'nash bo\'yicha) va o\'tgan (yangisi birinchi)', () {
      final trips = [
        _trip(id: 'done', status: 'completed', departureAt: now.subtract(const Duration(days: 1))),
        _trip(id: 'later', departureAt: now.add(const Duration(days: 2))),
        _trip(id: 'soon', status: 'full', seatsLeft: 0, departureAt: now.add(const Duration(hours: 3))),
        _trip(id: 'gone', status: 'cancelled', departureAt: now.add(const Duration(days: 1))),
        _trip(id: 'run', status: 'in_progress', departureAt: now.subtract(const Duration(hours: 1))),
      ];
      final split = IntercityDriverTrips.split(trips);
      expect(split.upcoming.map((t) => t.id), ['run', 'soon', 'later']);
      expect(split.past.map((t) => t.id), ['gone', 'done']);
      expect(split.next?.id, 'run');
    });

    test('bekor qilish faqat open/full/boarding', () {
      expect(canCancelTrip(_trip()), isTrue);
      expect(canCancelTrip(_trip(status: 'boarding', seatsLeft: 2)), isTrue);
      expect(canCancelTrip(_trip(status: 'in_progress', seatsLeft: 2)), isFalse);
      expect(canCancelTrip(_trip(status: 'completed', seatsLeft: 2)), isFalse);
    });
  });

  group('xatolar', () {
    DioException coded(String code, {List<Map<String, String>>? reasons}) =>
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          response: Response<dynamic>(
            requestOptions: RequestOptions(path: '/x'),
            statusCode: 409,
            data: {'code': code, 'message': 'srv', 'reasons': reasons},
          ),
        );

    test('kesishuv va xizmat yoqilmagan — o\'z matni', () {
      expect(intercityErrorMessage(coded('INTERCITY_TRIP_OVERLAP')),
          isNot('srv'));
      expect(intercityErrorMessage(coded('INTERCITY_SERVICE_NOT_ENABLED')),
          isNot('srv'));
    });

    test("INTERCITY_TRIP_INVALID — server sabablari qatorlab", () {
      final msg = intercityErrorMessage(coded('INTERCITY_TRIP_INVALID', reasons: [
        {'code': 'A', 'message': 'Birinchi'},
        {'code': 'B', 'message': 'Ikkinchi'},
      ]));
      expect(msg, 'Birinchi\nIkkinchi');
    });
  });

  group('repozitoriy', () {
    late _MockApiClient api;
    late IntercityRepository repo;

    setUp(() {
      api = _MockApiClient();
      repo = IntercityRepository(apiClient: api);
    });

    test("e'lon: tripClass va UTC vaqt yuboriladi", () async {
      when(() => api.post(ApiEndpoints.intercityTrips, data: any(named: 'data')))
          .thenAnswer((_) async => _ok(ApiEndpoints.intercityTrips, _tripJson()));

      await repo.publishTrip(
        routeId: 'r1',
        departureAt: DateTime.utc(2026, 10, 18, 2),
        seatsTotal: 3,
        tripClass: IntercityTripClass.comfort,
      );

      final body = verify(() => api.post(ApiEndpoints.intercityTrips,
          data: captureAny(named: 'data'))).captured.single as Map;
      expect(body, {
        'routeId': 'r1',
        'departureAt': '2026-10-18T02:00:00.000Z',
        'seatsTotal': 3,
        'tripClass': 'comfort',
      });
    });

    test('qatnovlarim sahifadan o\'qiladi', () async {
      when(() => api.get(ApiEndpoints.intercityMyTrips,
              params: any(named: 'params')))
          .thenAnswer((_) async => _ok(ApiEndpoints.intercityMyTrips, {
                'items': [_tripJson(id: 'a'), _tripJson(id: 'b')],
                'total': 2,
                'page': 1,
                'limit': 50,
              }));

      final trips = await repo.myTrips();
      expect(trips.map((t) => t.id), ['a', 'b']);
    });

    test('bekor qilish sabab bilan; yig\'ish va jo\'nash to\'g\'ri yo\'lga', () async {
      when(() => api.post(any(), data: any(named: 'data')))
          .thenAnswer((_) async => _ok('/x', _tripJson(status: 'cancelled')));
      when(() => api.post(any()))
          .thenAnswer((_) async => _ok('/x', _tripJson(status: 'boarding')));

      await repo.cancelTrip('t1', reason: 'Mashina buzildi');
      await repo.startBoarding('t1');
      await repo.depart('t1');

      final cancelBody = verify(() => api.post(
              ApiEndpoints.intercityTripCancel('t1'),
              data: captureAny(named: 'data')))
          .captured
          .single as Map;
      expect(cancelBody, {'reason': 'Mashina buzildi'});
      verify(() => api.post(ApiEndpoints.intercityTripStartBoarding('t1')))
          .called(1);
      verify(() => api.post(ApiEndpoints.intercityTripDepart('t1'))).called(1);
    });
  });
}
