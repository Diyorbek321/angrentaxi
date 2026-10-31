import 'package:angren_taxi/core/location/marker_animation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

void main() {
  const start = LatLng(40.100, 69.100);
  const half = Duration(milliseconds: 600);
  const full = Duration(milliseconds: 1200);

  MarkerAnimation animation() => MarkerAnimation(start: start);

  group('MarkerAnimation', () {
    test('sits on the first fix, with no direction yet', () {
      final a = animation();

      expect(a.value, start);
      expect(a.bearing, isNull);
      expect(a.isAnimating, isFalse);
    });

    test('slides through the gap instead of jumping', () {
      final a = animation();
      // ~220 m north — a normal between-fix step.
      a.retarget(const LatLng(40.102, 69.100));

      a.advance(half);
      final midpoint = a.value;
      expect(midpoint.latitude, greaterThan(start.latitude));
      expect(midpoint.latitude, lessThan(40.102));

      a.advance(half);
      expect(a.value.latitude, closeTo(40.102, 1e-9));
      expect(a.isAnimating, isFalse);
    });

    test('reports the direction of travel so the car icon can rotate', () {
      final a = animation();

      a.retarget(const LatLng(40.102, 69.100)); // north
      expect(a.bearing, closeTo(0, 1));

      a.advance(full);
      a.retarget(const LatLng(40.102, 69.102)); // east
      expect(a.bearing, closeTo(90, 1));
    });

    test('jumps straight to a far-away fix rather than crawling there', () {
      final a = animation();
      // ~8 km: a reconnect or a driver swap, not real movement.
      const faraway = LatLng(40.170, 69.100);

      a.retarget(faraway);

      expect(a.value, faraway);
      expect(a.isAnimating, isFalse);
    });

    test('a fix arriving mid-slide continues from where it is', () {
      final a = animation();
      a.retarget(const LatLng(40.102, 69.100));
      a.advance(half);
      final midpoint = a.value;

      a.retarget(const LatLng(40.104, 69.100));

      // No backwards snap to the original point.
      expect(a.value.latitude, closeTo(midpoint.latitude, 1e-9));
    });

    test('ignores a repeated identical fix', () {
      final a = animation();

      a.retarget(start);

      expect(a.isAnimating, isFalse);
      expect(a.bearing, isNull);
    });

    test('keeps the last direction through GPS jitter', () {
      final a = animation();
      a.retarget(const LatLng(40.102, 69.100)); // north
      a.advance(full);
      final settled = a.bearing;

      // ~1 m wobble — under the 3 m floor, so the heading must not flip.
      a.retarget(const LatLng(40.102009, 69.100));

      expect(a.bearing, settled);
    });

    test('advance does nothing once the slide is over', () {
      final a = animation();
      a.retarget(const LatLng(40.102, 69.100));
      a.advance(full);

      expect(a.advance(half), isFalse);
    });
  });

  group('MarkerAnimation — silliqlik', () {
    test('davomiylik fikslar oralig\'iga moslashadi (to\'xtab-yurish yo\'q)',
        () {
      var now = DateTime(2026, 10, 27, 12);
      final a = MarkerAnimation(start: start, clock: () => now);
      var lat = 40.100;
      for (var i = 0; i < 12; i++) {
        now = now.add(const Duration(seconds: 4));
        lat += 0.0003; // ~33 m
        a.retarget(LatLng(lat, 69.100));
      }
      expect(a.duration.inMilliseconds, closeTo(4000, 300));
    });

    test('davomiylik chegaralangan: 0.6 s .. 5 s', () {
      var now = DateTime(2026, 10, 27, 12);
      final a = MarkerAnimation(start: start, clock: () => now);
      var lat = 40.100;
      for (var i = 0; i < 30; i++) {
        now = now.add(const Duration(seconds: 30));
        lat += 0.0003;
        a.retarget(LatLng(lat, 69.100));
      }
      expect(a.duration, const Duration(seconds: 5));
    });

    test('soatsiz — avvalgidek qat\'iy 1.2 s', () {
      final a = animation();
      a.retarget(const LatLng(40.102, 69.100));
      expect(a.duration, full);
    });

    test('ikona eng qisqa yoy bo\'ylab buriladi (350° → 10°, 340° emas)', () {
      final a = animation();
      // Shimoli-g'arbga (≈350°) harakat.
      a.retarget(const LatLng(40.102, 69.0995));
      a.advance(full);
      final before = a.displayBearing!;
      expect(before, greaterThan(340));

      // Endi shimoli-sharqqa (≈10°).
      a.retarget(const LatLng(40.104, 69.1000));
      expect(a.displayBearing, closeTo(before, 0.5)); // hali burilmagan

      a.advance(const Duration(milliseconds: 300));
      final mid = a.displayBearing!;
      // Yarim yo'lda ~0° atrofida — 180° orqali aylanmagan.
      expect(mid < 20 || mid > 340, isTrue, reason: '$mid');

      a.advance(const Duration(milliseconds: 600));
      expect(a.displayBearing, closeTo(a.bearing!, 0.5));
    });
  });
}
