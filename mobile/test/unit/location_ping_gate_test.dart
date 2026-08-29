import 'package:angren_taxi/core/location/location_ping_gate.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final t0 = DateTime(2026, 8, 10, 12, 0, 0);

  LocationPingGate gate() => LocationPingGate(
        movingInterval: const Duration(seconds: 4),
        idleInterval: const Duration(seconds: 15),
        idleSpeedThreshold: 1.5,
      );

  group('LocationPingGate', () {
    test('sends the very first fix immediately', () {
      expect(
        gate().shouldEmit(speedMetersPerSecond: 0, now: t0),
        isTrue,
      );
    });

    test('a moving driver reports every 4 seconds', () {
      final g = gate();
      g.shouldEmit(speedMetersPerSecond: 10, now: t0);

      expect(
        g.shouldEmit(
          speedMetersPerSecond: 10,
          now: t0.add(const Duration(seconds: 3)),
        ),
        isFalse,
        reason: 'too soon — this is the rate limit doing its job',
      );
      expect(
        g.shouldEmit(
          speedMetersPerSecond: 10,
          now: t0.add(const Duration(seconds: 4)),
        ),
        isTrue,
      );
    });

    test('a stopped driver drops to the slow heartbeat', () {
      final g = gate();
      g.shouldEmit(speedMetersPerSecond: 0, now: t0);

      // 4 s would have been enough while moving; standing still it is not.
      expect(
        g.shouldEmit(
          speedMetersPerSecond: 0,
          now: t0.add(const Duration(seconds: 5)),
        ),
        isFalse,
      );
      expect(
        g.shouldEmit(
          speedMetersPerSecond: 0,
          now: t0.add(const Duration(seconds: 15)),
        ),
        isTrue,
      );
    });

    test('a car crawling in traffic still counts as stopped', () {
      final g = gate();
      g.shouldEmit(speedMetersPerSecond: 0, now: t0);

      // 1.0 m/s ≈ 3.6 km/h — below the threshold.
      expect(
        g.shouldEmit(
          speedMetersPerSecond: 1.0,
          now: t0.add(const Duration(seconds: 5)),
        ),
        isFalse,
      );
    });

    test('treats a negative speed reading as its magnitude', () {
      final g = gate();
      g.shouldEmit(speedMetersPerSecond: 0, now: t0);

      // Some devices report speed as a signed value; -10 m/s is still moving,
      // so the fast cadence must apply.
      expect(
        g.shouldEmit(
          speedMetersPerSecond: -10,
          now: t0.add(const Duration(seconds: 4)),
        ),
        isTrue,
      );
    });

    test('the clock restarts from the last SENT fix, not the last checked one', () {
      final g = gate();
      g.shouldEmit(speedMetersPerSecond: 10, now: t0);

      // Rejected at 3 s — must not reset the window.
      g.shouldEmit(
        speedMetersPerSecond: 10,
        now: t0.add(const Duration(seconds: 3)),
      );

      expect(
        g.shouldEmit(
          speedMetersPerSecond: 10,
          now: t0.add(const Duration(seconds: 4)),
        ),
        isTrue,
      );
    });

    test('after going offline the next fix is sent immediately', () {
      final g = gate();
      g.shouldEmit(speedMetersPerSecond: 10, now: t0);
      g.reset();

      expect(
        g.shouldEmit(
          speedMetersPerSecond: 10,
          now: t0.add(const Duration(seconds: 1)),
        ),
        isTrue,
      );
    });
  });
}
