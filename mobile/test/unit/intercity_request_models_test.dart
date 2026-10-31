// Yo'lovchi so'rovlari — server qoidalari bilan bir xil bo'lishi kerak
// (backend/src/modules/intercity/intercity-request-policy.ts).
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/models/intercity_request_models.dart';
import 'package:flutter_test/flutter_test.dart';

final _now = DateTime.utc(2026, 10, 18, 9); // Toshkentda 14:00

Map<String, dynamic> _requestJson({
  String kind = 'seat',
  int seats = 2,
  String tripClass = 'start',
  DateTime? start,
  DateTime? end,
  num bonus = 0,
}) =>
    {
      'id': 'q1',
      'status': 'open',
      'routeId': 'r-a-r',
      'originName': 'Angren',
      'destinationName': 'Rohat krugi',
      'tripClass': tripClass,
      'kind': kind,
      'seats': seats,
      'pickup': {'lat': 41.02, 'lng': 70.14, 'address': 'Angren, Navoiy 12'},
      'dropoff': {'lat': 41.35, 'lng': 69.3, 'address': 'Yunusobod 4'},
      'windowStart': (start ?? _now.add(const Duration(hours: 1))).toIso8601String(),
      'windowEnd': (end ?? _now.add(const Duration(hours: 3))).toIso8601String(),
      'basePrice': 72000,
      'extensions': [
        {'side': 'dropoff', 'pointName': 'Rohat krugi', 'km': 11, 'pricePerKm': 2000, 'fare': 22000},
      ],
      'bonus': bonus,
      'total': 72000 + bonus,
      'maxBonus': 72000,
      'bonusStep': 1000,
      'tripId': null,
      'orderId': null,
      'createdAt': _now.toIso8601String(),
    };

IntercityTrip _trip({
  String id = 't1',
  String status = 'open',
  String tripClass = 'start',
  String routeId = 'r-a-r',
  required DateTime departureAt,
  int seatsLeft = 3,
  bool wholeCar = false,
}) =>
    IntercityTrip.fromJson({
      'id': id,
      'route': {
        'id': routeId,
        'origin': const {'id': 'p-a', 'name': 'Angren'},
        'destination': const {'id': 'p-r', 'name': 'Rohat krugi'},
      },
      'tripClass': tripClass,
      'departureAt': departureAt.toIso8601String(),
      'status': status,
      'seatsTotal': 4,
      'seatsLeft': seatsLeft,
      'wholeCarAvailable': wholeCar,
      'seatPrice': 25000,
      'wholeCarPrice': 100000,
    });

void main() {
  group('IntercityRequest.fromJson', () {
    test("maydonlar, davomsiz tarif va oshirish chegarasi", () {
      final r = IntercityRequest.fromJson(_requestJson(bonus: 5000));
      expect(r.isOpen, isTrue);
      expect(r.seats, 2);
      expect(r.pickup.address, 'Angren, Navoiy 12');
      expect(r.total, 77000);
      expect(r.tariffPrice, 50000);
      expect(r.extensions.single.fare, 22000);
      expect(r.canRaise, isTrue);
    });

    test("chegaraga yetgan so'rovni oshirib bo'lmaydi", () {
      final r = IntercityRequest.fromJson(_requestJson(bonus: 72000));
      expect(r.canRaise, isFalse);
    });

    test('qabul javobi', () {
      final a = IntercityRequestAcceptance.fromJson({
        'request': {..._requestJson(), 'status': 'accepted', 'tripId': 't9', 'orderId': 'o9'},
        'tripId': 't9',
        'orderId': 'o9',
        'tripCreated': true,
      });
      expect(a.request.isAccepted, isTrue);
      expect(a.tripCreated, isTrue);
    });
  });

  group('intercityWindowProblem', () {
    IntercityWindowProblem? check(Duration from, Duration length, {int days = 7}) => intercityWindowProblem(
          start: _now.add(from),
          end: _now.add(from + length),
          now: _now,
          maxAheadDays: days,
        );

    test('yaxshi oraliq', () => expect(check(const Duration(hours: 1), const Duration(hours: 2)), isNull));
    test('oxiri boshidan oldin', () {
      expect(check(const Duration(hours: 1), Duration.zero), IntercityWindowProblem.invalid);
    });
    test('30 daqiqadan qisqa', () {
      expect(check(const Duration(hours: 1), const Duration(minutes: 29)), IntercityWindowProblem.tooShort);
    });
    test('12 soatdan uzun', () {
      expect(check(const Duration(hours: 1), const Duration(hours: 13)), IntercityWindowProblem.tooLong);
    });
    test('oxirigacha 30 daqiqadan kam qolgan', () {
      expect(check(const Duration(minutes: -40), const Duration(minutes: 60)), IntercityWindowProblem.tooSoon);
    });
    test("boshlangan, lekin hali vaqt bor — ruxsat (server boshini hozirga suradi)", () {
      expect(check(const Duration(minutes: -30), const Duration(hours: 2)), isNull);
    });
    test('juda uzoq kelajak', () {
      expect(check(const Duration(days: 8), const Duration(hours: 2)), IntercityWindowProblem.tooFar);
    });
  });

  group("Jo'nash vaqti (server departureFitsWindow)", () {
    test("eng erta — oraliq boshi yoki hozir + 10 daqiqa", () {
      final future = IntercityRequest.fromJson(_requestJson());
      expect(future.earliestDeparture(_now), _now.add(const Duration(hours: 1)));
      final started = IntercityRequest.fromJson(_requestJson(start: _now.subtract(const Duration(minutes: 20))));
      expect(started.earliestDeparture(_now), _now.add(const Duration(minutes: 10)));
    });

    test('mos qatnovlar: yo\'nalish, klass, holat, vaqt va joy', () {
      final r = IntercityRequest.fromJson(_requestJson());
      final inWindow = _now.add(const Duration(hours: 2));
      final trips = [
        _trip(id: 'ok', departureAt: inWindow),
        _trip(id: 'late', departureAt: _now.add(const Duration(hours: 4))),
        _trip(id: 'comfort', tripClass: 'comfort', departureAt: inWindow),
        _trip(id: 'other-route', routeId: 'r-x', departureAt: inWindow),
        _trip(id: 'full', status: 'full', departureAt: inWindow),
        _trip(id: 'one-seat', seatsLeft: 1, departureAt: inWindow),
      ];
      // Joyi yetmagani ham "mos" — server ham joyni tekshirmasdan tanlaydi.
      expect(intercityTripsForRequest(r, trips, _now).map((t) => t.id), ['ok', 'one-seat']);
      expect(intercityTripHasRoomFor(r, trips.first), isTrue);
      expect(intercityTripHasRoomFor(r, trips.last), isFalse);
    });

    test('butun mashina so\'rovi uchun joy — faqat bo\'sh mashina', () {
      final r = IntercityRequest.fromJson(_requestJson(kind: 'whole_car'));
      final at = _now.add(const Duration(hours: 2));
      expect(intercityTripHasRoomFor(r, _trip(id: 'busy', departureAt: at)), isFalse);
      expect(intercityTripHasRoomFor(r, _trip(id: 'free', wholeCar: true, departureAt: at)), isTrue);
    });

    test('boshqa qatnovdan ±3 soat ichidagi vaqt taklif qilinmaydi', () {
      final r = IntercityRequest.fromJson(_requestJson());
      // Oraliq 10:00–12:00 UTC; boshqa qatnov 07:30 — 10:30 gacha band.
      final slots = intercityDepartureSlots(r, _now, busy: [DateTime.utc(2026, 10, 18, 7, 30)]);
      expect(slots.first, DateTime.utc(2026, 10, 18, 10, 30));
      expect(slots.last, DateTime.utc(2026, 10, 18, 12));
      final none = intercityDepartureSlots(r, _now, busy: [DateTime.utc(2026, 10, 18, 11)]);
      expect(none, isEmpty);
    });

    test('vaqt variantlari 15 daqiqalik, oraliq ichida', () {
      final r = IntercityRequest.fromJson(_requestJson());
      final slots = intercityDepartureSlots(r, _now);
      expect(slots.first, _now.add(const Duration(hours: 1)));
      expect(slots.last, _now.add(const Duration(hours: 3)));
      expect(slots, hasLength(9));
      expect(slots.every((s) => r.departureFits(s, _now)), isTrue);
    });

    test('boshlangan oraliq: birinchi variant hozir + 10 daq dan keyin yaxlitlanadi', () {
      final now = DateTime.utc(2026, 10, 18, 9, 7);
      final r = IntercityRequest.fromJson(_requestJson(start: now.subtract(const Duration(hours: 1)), end: now.add(const Duration(hours: 1))));
      final slots = intercityDepartureSlots(r, now);
      expect(slots.first, DateTime.utc(2026, 10, 18, 9, 30));
      expect(slots.every((s) => r.departureFits(s, now)), isTrue);
    });

    test("tor oraliq: yaxlitlangan vaqt sig'masa — eng erta daqiqa", () {
      final now = DateTime.utc(2026, 10, 18, 9, 1);
      final r = IntercityRequest.fromJson(_requestJson(start: now, end: now.add(const Duration(minutes: 13))));
      final slots = intercityDepartureSlots(r, now);
      expect(slots, [DateTime.utc(2026, 10, 18, 9, 11)]);
    });
  });

  group('Vaqt yordamchilari', () {
    test('Toshkent vaqtidan UTC', () {
      expect(tashkentInstant('2026-10-18', 14, 30), DateTime.utc(2026, 10, 18, 9, 30));
    });
    test('yuqoriga yaxlitlash', () {
      expect(ceilToMinutes(DateTime.utc(2026, 1, 1, 10, 0), 30), DateTime.utc(2026, 1, 1, 10, 0));
      expect(ceilToMinutes(DateTime.utc(2026, 1, 1, 10, 0, 5), 30), DateTime.utc(2026, 1, 1, 10, 30));
      expect(ceilToMinutes(DateTime.utc(2026, 1, 1, 10, 31), 30), DateTime.utc(2026, 1, 1, 11, 0));
    });
  });
}
