// Haydovchi bekatlar rejasi bo'yicha yo'lovchi kartalari tartibi.
import 'package:angren_taxi/features/intercity/intercity_driver_policy.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:flutter_test/flutter_test.dart';

IntercityDriverBooking _b(String id, {String status = 'accepted', double lat = 41.3, double lng = 69.3}) =>
    IntercityDriverBooking.fromJson({
      'orderId': id,
      'status': status,
      'seats': 1,
      'bookingKind': 'seat',
      'price': 25000,
      'passenger': {'name': id},
      'pickupLat': lat,
      'pickupLng': lng,
      'createdAt': '2026-10-17T05:00:00.000Z',
    });

IntercityRoutePlan _plan(List<String> ids) => IntercityRoutePlan(
      phase: 'pickup',
      pointName: 'Rohat krugi',
      stops: [
        for (var i = 0; i < ids.length; i++)
          IntercityRouteStop(sequence: i + 1, orderId: ids[i], kind: 'pickup', lat: 41, lng: 69, etaMinutesFromPrev: 5),
      ],
    );

void main() {
  group('orderBookingsByPlan', () {
    test('reja tartibi, rejada yo‘q tirik band keyin, tugaganlar oxirida', () {
      final bookings = [
        _b('a'),
        _b('done', status: 'cancelled'),
        _b('b'),
        _b('c'),
        _b('new'),
      ];
      final ordered = orderBookingsByPlan(bookings, _plan(['c', 'a', 'b']));
      expect(ordered.map((b) => b.orderId), ['c', 'a', 'b', 'new', 'done']);
    });

    test("reja yo'q yoki bo'sh — eng yaqindan tartibga qaytadi", () {
      final bookings = [_b('far', lat: 41.4), _b('near', lat: 41.27)];
      expect(
        orderBookingsByPlan(bookings, null, fromLat: 41.26, fromLng: 69.3).map((b) => b.orderId),
        ['near', 'far'],
      );
      expect(
        orderBookingsByPlan(bookings, _plan(const []), fromLat: 41.26, fromLng: 69.3).map((b) => b.orderId),
        ['near', 'far'],
      );
    });

    test('keyingi bekat — rejadagi birinchi tirik band', () {
      final bookings = [_b('a', status: 'arrived'), _b('b')];
      final plan = _plan(['a', 'b']);
      // Olish bosqichida "arrived" — allaqachon mashinada, keyingi bekat emas.
      expect(nextPlannedStop(plan, bookings, onTheRoad: false)?.orderId, 'b');
      expect(nextPlannedStop(null, bookings, onTheRoad: false), isNull);
    });
  });
}
