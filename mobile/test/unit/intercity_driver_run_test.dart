// Shaharlararo — haydovchi qatnovini boshqarish: band modeli va sof
// qoidalar (eng yaqindan tartib, jo'nash sharti, naqd jami).
import 'package:angren_taxi/features/intercity/intercity_driver_policy.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:flutter_test/flutter_test.dart';

IntercityDriverBooking _b(
  String id, {
  String status = 'accepted',
  double? lat,
  double? lng,
  double price = 25000,
}) =>
    IntercityDriverBooking.fromJson({
      'orderId': id,
      'status': status,
      'seats': 1,
      'bookingKind': 'seat',
      'price': price,
      'passenger': {'name': 'Yo\'lovchi $id', 'phone': null},
      'pickupAddress': 'manzil $id',
      'pickupLat': lat,
      'pickupLng': lng,
      'dropoffAddress': 'Rohat krugi',
      'dropoffLat': 41.3,
      'dropoffLng': 69.3,
      'createdAt': '2026-10-17T05:00:00.000Z',
    });

void main() {
  group('IntercityDriverBooking.fromJson', () {
    test("barcha maydonlar; raqam satr bo'lib kelsa ham o'qiladi", () {
      final b = IntercityDriverBooking.fromJson(const {
        'orderId': 'o1',
        'status': 'arrived',
        'seats': 2,
        'bookingKind': 'whole_car',
        'price': '50000',
        'passenger': {'name': 'Ali', 'phone': '+998901112233'},
        'pickupAddress': 'Angren',
        'pickupLat': 40.1,
        'pickupLng': '70.9',
        'dropoffAddress': 'Rohat krugi',
        'dropoffLat': null,
        'dropoffLng': null,
        'createdAt': '2026-10-17T05:00:00.000Z',
      });
      expect(b.orderId, 'o1');
      expect(b.status, 'arrived');
      expect(b.seats, 2);
      expect(b.isWholeCar, isTrue);
      expect(b.price, 50000);
      expect(b.passengerName, 'Ali');
      expect(b.passengerPhone, '+998901112233');
      expect(b.pickupLat, 40.1);
      expect(b.pickupLng, 70.9);
      expect(b.dropoffLat, isNull);
    });

    test('tirik holatlar: scheduled/accepted/arrived/in_progress', () {
      expect(_b('a', status: 'scheduled').isLive, isTrue);
      expect(_b('a', status: 'accepted').isLive, isTrue);
      expect(_b('a', status: 'arrived').isLive, isTrue);
      expect(_b('a', status: 'in_progress').isLive, isTrue);
      expect(_b('a', status: 'completed').isLive, isFalse);
      expect(_b('a', status: 'cancelled').isLive, isFalse);
    });
  });

  group('orderBookingsNearestFirst', () {
    test('haydovchiga eng yaqin olish nuqtasi birinchi', () {
      final far = _b('far', lat: 40.20, lng: 70.90);
      final near = _b('near', lat: 40.10, lng: 70.90);
      final mid = _b('mid', lat: 40.15, lng: 70.90);
      final ordered = orderBookingsNearestFirst(
        [far, near, mid],
        fromLat: 40.09,
        fromLng: 70.90,
      );
      expect(ordered.map((b) => b.orderId), ['near', 'mid', 'far']);
    });

    test("tirik bandlar oldin, yakunlangan/bekor — oxirida; koordinatasizlar tiriklar oxirida", () {
      final done = _b('done', status: 'completed', lat: 40.10, lng: 70.90);
      final noCoords = _b('nocoords');
      final live = _b('live', lat: 40.20, lng: 70.90);
      final ordered = orderBookingsNearestFirst(
        [done, noCoords, live],
        fromLat: 40.10,
        fromLng: 70.90,
      );
      expect(ordered.map((b) => b.orderId), ['live', 'nocoords', 'done']);
    });

    test("joylashuv noma'lum — asl tartib saqlanadi (faqat tiriklar oldinga)", () {
      final a = _b('a', lat: 40.2, lng: 70.9);
      final b = _b('b', lat: 40.1, lng: 70.9);
      final ordered = orderBookingsNearestFirst([a, b]);
      expect(ordered.map((x) => x.orderId), ['a', 'b']);
    });

    test("kirish ro'yxati o'zgarmaydi", () {
      final input = [_b('x', lat: 40.2, lng: 70.9), _b('y', lat: 40.1, lng: 70.9)];
      orderBookingsNearestFirst(input, fromLat: 40.1, fromLng: 70.9);
      expect(input.map((b) => b.orderId), ['x', 'y']);
    });
  });

  group('canDepart', () {
    test("boarding va har bir tirik yo'lovchi olingan — ruxsat", () {
      expect(
        canDepart(IntercityTripStatus.boarding,
            [_b('a', status: 'arrived'), _b('b', status: 'cancelled')]),
        isTrue,
      );
    });

    test("kimdir hali olinmagan — yo'q", () {
      expect(
        canDepart(IntercityTripStatus.boarding,
            [_b('a', status: 'arrived'), _b('b', status: 'accepted')]),
        isFalse,
      );
    });

    test("tirik band umuman yo'q — yo'q", () {
      expect(canDepart(IntercityTripStatus.boarding, [_b('a', status: 'cancelled')]), isFalse);
    });

    test("boarding emas — yo'q", () {
      expect(canDepart(IntercityTripStatus.open, [_b('a', status: 'arrived')]), isFalse);
    });
  });

  test("intercityCashTotal faqat yakunlangan bandlarni qo'shadi", () {
    expect(
      intercityCashTotal([
        _b('a', status: 'completed', price: 25000),
        _b('b', status: 'completed', price: 50000),
        _b('c', status: 'cancelled', price: 25000),
        _b('d', status: 'in_progress', price: 25000),
      ]),
      75000,
    );
  });
}
