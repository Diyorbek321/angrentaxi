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
}
