// Push bosilganda qaysi ekran ochiladi (lib/core/push/push_tap_router.dart).
import 'package:angren_taxi/core/push/push_tap_router.dart';
import 'package:flutter_test/flutter_test.dart';

PushTapTarget? driverTarget(String event) => pushTapTarget({'event': event}, driver: true);
PushTapTarget? passengerTarget(String event) => pushTapTarget({'event': event}, driver: false);

void main() {
  group('Haydovchi', () {
    test("yangi so'rov — doska", () {
      expect(driverTarget('intercity_request_created'), PushTapTarget.intercityRequestBoard);
    });
    test('band, bekor va jo\'nash eslatmasi — qatnovlarim', () {
      for (final e in ['intercity_booking_created', 'intercity_booking_cancelled', 'intercity_departure_reminder']) {
        expect(driverTarget(e), PushTapTarget.intercityDriverTrips, reason: e);
      }
    });
    test('chat, buyum, tekshiruv, bonus', () {
      expect(driverTarget('support_reply'), PushTapTarget.supportChat);
      expect(driverTarget('lost_item_reported'), PushTapTarget.lostItems);
      expect(driverTarget('verification_due'), PushTapTarget.driverVerification);
      expect(driverTarget('bonus_awarded'), PushTapTarget.driverEarnings);
    });
    test("taksi zakazi va hamyon — yo'naltirilmaydi (bosh ekran / hamyon shinasi)", () {
      for (final e in ['new_order_offer', 'order_cancelled', 'wallet_topup_paid', 'intercity_request_accepted']) {
        expect(driverTarget(e), isNull, reason: e);
      }
    });
  });

  group("Yo'lovchi", () {
    test('haydovchi topildi va qatnov hodisalari — bandlarim', () {
      for (final e in [
        'intercity_request_accepted',
        'intercity_booking_cancelled_by_dispatcher',
        'intercity_boarding_started',
        'intercity_departure_reminder',
        'intercity_trip_cancelled',
      ]) {
        expect(passengerTarget(e), PushTapTarget.intercityBookings, reason: e);
      }
    });
    test("muddat tugadi — so'rovlarim", () {
      expect(passengerTarget('intercity_request_expired'), PushTapTarget.intercityRequests);
    });
    test('chat va topilgan buyum', () {
      expect(passengerTarget('support_reply'), PushTapTarget.supportChat);
      expect(passengerTarget('lost_item_answered'), PushTapTarget.lostItems);
    });
    test("taksi pushlari, haydovchi hodisalari va noma'lum — yo'q", () {
      for (final e in ['order_accepted', 'driver_arrived', 'trip_completed', 'intercity_request_created', 'nima']) {
        expect(passengerTarget(e), isNull, reason: e);
      }
      expect(pushTapTarget(const {}, driver: false), isNull);
    });
  });

  group('PushTapRouter navbati', () {
    test('bosh ekran tayyor bo\'lguncha oxirgi bosish kutadi', () async {
      final router = PushTapRouter(driver: false);
      final opened = <PushTapTarget>[];
      router.targets.listen(opened.add);

      router.handle({'event': 'intercity_request_expired'});
      router.handle({'event': 'intercity_request_accepted'});
      await Future<void>.delayed(Duration.zero);
      expect(opened, isEmpty);
      expect(router.pendingForTest, PushTapTarget.intercityBookings);

      router.markReady();
      await Future<void>.delayed(Duration.zero);
      expect(opened, [PushTapTarget.intercityBookings]);

      router.handle({'event': 'support_reply'});
      await Future<void>.delayed(Duration.zero);
      expect(opened.last, PushTapTarget.supportChat);
    });

    test('ekransiz hodisa navbatni buzmaydi; chiqishdan keyin yana kutadi', () async {
      final router = PushTapRouter(driver: true)..markReady();
      final opened = <PushTapTarget>[];
      router.targets.listen(opened.add);

      router.handle({'event': 'new_order_offer'});
      router.markNotReady();
      router.handle({'event': 'intercity_request_created'});
      await Future<void>.delayed(Duration.zero);
      expect(opened, isEmpty);

      router.markReady();
      await Future<void>.delayed(Duration.zero);
      expect(opened, [PushTapTarget.intercityRequestBoard]);
    });
  });
}
