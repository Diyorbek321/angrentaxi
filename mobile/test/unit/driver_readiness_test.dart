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

  test('battery, overlay, full-screen and autostart are only recommendations', () {
    for (final item in [
      ReadinessItem.battery,
      ReadinessItem.overlay,
      ReadinessItem.fullScreen,
      ReadinessItem.autostart,
    ]) {
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

  test('muted offer channel blocks going online (offers in background would be silent)', () {
    final r = only(ReadinessItem.values.toSet()..remove(ReadinessItem.offerAlerts));
    expect(DriverReadiness.blocking, contains(ReadinessItem.offerAlerts));
    expect(r.canGoOnline, isFalse);
  });

  test('offer channel can be fixed only once app notifications are on', () {
    final noNotifications = only(ReadinessItem.values.toSet()
      ..remove(ReadinessItem.notifications)
      ..remove(ReadinessItem.offerAlerts));
    expect(noNotifications.canFix(ReadinessItem.offerAlerts), isFalse);

    final mutedOnly = only(ReadinessItem.values.toSet()..remove(ReadinessItem.offerAlerts));
    expect(mutedOnly.canFix(ReadinessItem.offerAlerts), isTrue);
  });

  test('hidden items count as done and are not shown', () {
    final r = DriverReadiness(
      {for (final i in ReadinessItem.values) i: i != ReadinessItem.autostart},
      hidden: const {ReadinessItem.autostart},
    );
    expect(r.isOk(ReadinessItem.autostart), isTrue);
    expect(r.isVisible(ReadinessItem.autostart), isFalse);
    expect(r.isComplete, isTrue);
  });

  group('autostart', () {
    test('status parsing — unknown/missing value hides the item', () {
      expect(AutostartStatus.parse('allowed'), AutostartStatus.allowed);
      expect(AutostartStatus.parse('denied'), AutostartStatus.denied);
      expect(AutostartStatus.parse('unknown'), AutostartStatus.unknown);
      expect(AutostartStatus.parse(null), AutostartStatus.notApplicable);
      expect(AutostartStatus.parse('weird'), AutostartStatus.notApplicable);
    });

    test('verified states ignore whether the page was visited', () {
      expect(autostartOk(AutostartStatus.allowed, visited: false), isTrue);
      expect(autostartOk(AutostartStatus.notApplicable, visited: false), isTrue);
      expect(autostartOk(AutostartStatus.denied, visited: true), isFalse);
    });

    test('unverifiable phones — done after the driver opened the page once', () {
      expect(autostartOk(AutostartStatus.unknown, visited: false), isFalse);
      expect(autostartOk(AutostartStatus.unknown, visited: true), isTrue);
    });
  });
}
