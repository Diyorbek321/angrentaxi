import 'package:angren_taxi/features/driver/readiness/driver_readiness.dart';
import 'package:flutter_test/flutter_test.dart';

DriverReadiness only(Set<ReadinessItem> ok) =>
    DriverReadiness({for (final i in ReadinessItem.values) i: ok.contains(i)});

void main() {
  test('everything granted — online, and nothing to show', () {
    final r = only(ReadinessItem.values.toSet());
    expect(r.canGoOnline, isTrue);
    expect(r.isComplete, isTrue);
  });

  test('battery and drawing over other apps are only recommendations', () {
    for (final item in [ReadinessItem.battery, ReadinessItem.overlay]) {
      final r = only(ReadinessItem.values.toSet()..remove(item));
      expect(r.canGoOnline, isTrue, reason: '$item');
      expect(r.isComplete, isFalse, reason: '$item');
    }
  });

  test('each blocking item alone stops going online', () {
    for (final missing in DriverReadiness.blocking) {
      final r = only(ReadinessItem.values.toSet()..remove(missing));
      expect(r.canGoOnline, isFalse, reason: '$missing');
    }
  });

  test('steps that depend on an earlier one cannot be fixed before it', () {
    final noGps = only({ReadinessItem.notifications});
    expect(noGps.canFix(ReadinessItem.gps), isTrue);
    expect(noGps.canFix(ReadinessItem.location), isFalse);
    expect(noGps.canFix(ReadinessItem.preciseLocation), isFalse);
    expect(noGps.canFix(ReadinessItem.notifications), isTrue);

    final gpsOnly = only({ReadinessItem.gps});
    expect(gpsOnly.canFix(ReadinessItem.location), isTrue);
    expect(gpsOnly.canFix(ReadinessItem.preciseLocation), isFalse);
  });
}
