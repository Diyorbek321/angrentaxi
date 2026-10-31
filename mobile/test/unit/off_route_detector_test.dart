import 'package:angren_taxi/core/location/off_route_detector.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

void main() {
  // An L-shaped route in Angren: ~550 m north, then ~420 m east.
  final route = [
    const LatLng(41.0100, 70.1400),
    const LatLng(41.0150, 70.1400),
    const LatLng(41.0150, 70.1450),
  ];
  final t0 = DateTime(2026, 10, 6, 10);

  test('on the line — never off route', () {
    final d = OffRouteDetector(route);
    for (var i = 0; i < 10; i++) {
      expect(d.update(LatLng(41.0100 + i * 0.0005, 70.1400), t0.add(Duration(seconds: i * 4))), isFalse);
    }
  });

  test('GPS noise near the line is tolerated', () {
    final d = OffRouteDetector(route);
    // ~25 m east of the north leg, repeatedly.
    for (var i = 0; i < 6; i++) {
      expect(d.update(LatLng(41.011 + i * 0.0003, 70.1403), t0.add(Duration(seconds: i * 4))), isFalse);
    }
  });

  test('one bad fix is not enough — it takes consecutive confirmations', () {
    final d = OffRouteDetector(route);
    expect(d.update(const LatLng(41.0120, 70.1420), t0), isFalse); // ~170 m off
    expect(d.update(const LatLng(41.0122, 70.1400), t0.add(const Duration(seconds: 4))), isFalse); // back on
    expect(d.update(const LatLng(41.0124, 70.1420), t0.add(const Duration(seconds: 8))), isFalse);
  });

  test('a real detour is reported once confirmed', () {
    final d = OffRouteDetector(route);
    final off = [
      const LatLng(41.0120, 70.1420),
      const LatLng(41.0122, 70.1425),
      const LatLng(41.0124, 70.1430),
    ];
    final results = [
      for (var i = 0; i < off.length; i++) d.update(off[i], t0.add(Duration(seconds: i * 4))),
    ];
    expect(results, [false, false, true]);
  });

  test('after a report it waits before reporting again (no reroute storm)', () {
    final d = OffRouteDetector(route);
    var now = t0;
    LatLng far(int i) => LatLng(41.0120 + i * 0.0001, 70.1430);
    for (var i = 0; i < 3; i++) {
      d.update(far(i), now = now.add(const Duration(seconds: 4)));
    }
    // Still off route, but within the cooldown.
    for (var i = 3; i < 6; i++) {
      expect(d.update(far(i), now = now.add(const Duration(seconds: 4))), isFalse);
    }
    // Cooldown over and still off — report again.
    now = now.add(OffRouteDetector.cooldown);
    var reported = false;
    for (var i = 6; i < 9; i++) {
      reported = d.update(far(i), now = now.add(const Duration(seconds: 4))) || reported;
    }
    expect(reported, isTrue);
  });

  test('without a route there is nothing to leave', () {
    final d = OffRouteDetector(const []);
    for (var i = 0; i < 5; i++) {
      expect(d.update(const LatLng(41.1, 70.2), t0.add(Duration(seconds: i))), isFalse);
    }
  });
}
