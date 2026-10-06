import 'package:angren_taxi/core/platform/driver_overlay.dart';
import 'package:angren_taxi/features/driver/background/driver_background_bridge.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

class _RecordingOverlay extends DriverOverlay {
  final calls = <String>[];

  @override
  Future<bool> showBubble() async {
    calls.add('showBubble');
    return true;
  }

  @override
  Future<void> hideBubble() async => calls.add('hideBubble');

  @override
  Future<bool> bringToFront() async {
    calls.add('bringToFront');
    return true;
  }

  @override
  Future<void> showOfferNotification({
    required String title,
    required String text,
    required String channel,
  }) async =>
      calls.add('notify:$text');

  @override
  Future<void> cancelOfferNotification() async => calls.add('cancelNotification');
}

Order _offer(String id) => Order(
      id: id,
      passengerId: 'p',
      pickup: const OrderLocation(address: 'Markaz', lat: 41, lng: 70),
      dropoff: const OrderLocation(address: 'Bozor', lat: 41.01, lng: 70.01),
      status: OrderStatus.searching,
      estimatedPrice: 12000,
      createdAt: DateTime(2026, 10, 6),
    );

void main() {
  late _RecordingOverlay overlay;
  late bool online;
  Order? offer;
  late DriverBackgroundBridge bridge;

  setUp(() {
    overlay = _RecordingOverlay();
    online = true;
    offer = null;
    bridge = DriverBackgroundBridge(
      overlay: overlay,
      isOnline: () => online,
      pendingOffer: () => offer,
      noticeFor: (o) => (title: 'Yangi buyurtma', text: o.pickup.address, channel: 'c'),
    );
  });

  test('online driver leaves the app — floating button appears', () async {
    await bridge.onLifecycle(AppLifecycleState.paused);
    expect(overlay.calls, ['showBubble']);
  });

  test('offline driver leaves the app — nothing on screen', () async {
    online = false;
    await bridge.onLifecycle(AppLifecycleState.paused);
    expect(overlay.calls, isEmpty);
  });

  test('an offer in the background opens the app AND rings', () async {
    await bridge.onLifecycle(AppLifecycleState.paused);
    offer = _offer('o-1');
    await bridge.onDriverChanged();
    expect(overlay.calls, ['showBubble', 'showBubble', 'bringToFront', 'notify:Markaz']);
  });

  test('the same offer is announced once even if the provider notifies again', () async {
    await bridge.onLifecycle(AppLifecycleState.paused);
    offer = _offer('o-1');
    await bridge.onDriverChanged();
    await bridge.onDriverChanged();
    expect(overlay.calls.where((c) => c == 'bringToFront'), hasLength(1));

    // A different offer later is a new announcement.
    offer = null;
    await bridge.onDriverChanged();
    offer = _offer('o-2');
    await bridge.onDriverChanged();
    expect(overlay.calls.where((c) => c == 'bringToFront'), hasLength(2));
  });

  test('an offer while the app is on screen is left to the offer screen', () async {
    offer = _offer('o-1');
    await bridge.onDriverChanged();
    expect(overlay.calls, isNot(contains('bringToFront')));
  });

  test('coming back clears the button and the notification', () async {
    await bridge.onLifecycle(AppLifecycleState.paused);
    await bridge.onLifecycle(AppLifecycleState.resumed);
    expect(overlay.calls, ['showBubble', 'hideBubble', 'cancelNotification']);
  });

  test('going offline from the background removes the button', () async {
    await bridge.onLifecycle(AppLifecycleState.paused);
    online = false;
    await bridge.onDriverChanged();
    expect(overlay.calls.last, 'hideBubble');
  });

  test('pulling the notification shade (inactive) does nothing', () async {
    await bridge.onLifecycle(AppLifecycleState.inactive);
    expect(overlay.calls, isEmpty);
    expect(bridge.inBackground, isFalse);
  });
}
