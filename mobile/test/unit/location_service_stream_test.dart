import 'dart:async';

import 'package:angren_taxi/core/location/location_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

/// geolocator_android BITTA umumiy oqim beradi va keyingi chaqiruvlarning
/// sozlamasini e'tiborsiz qoldiradi. Shuning uchun haydovchi oflayn bo'lsa
/// ham, navigatsiya ekrani tinglab turgani uchun "siz onlaynsiz" fon
/// xizmati o'chmay qolardi. Bu testlar [LocationService] manba oqimni
/// tinglovchilarga qarab to'g'ri sozlama bilan qayta ochishini qo'riqlaydi.
class _FakeGeolocator extends GeolocatorPlatform with MockPlatformInterfaceMixin {
  /// Har bir ochilgan manba oqim: sozlamasi va hali tinglanayaptimi.
  final List<({LocationSettings? settings, StreamController<Position> ctrl})>
      opened = [];

  @override
  Stream<Position> getPositionStream({LocationSettings? locationSettings}) {
    // ignore: close_sinks — testda opened ro'yxati orqali kuzatiladi.
    final ctrl = StreamController<Position>();
    opened.add((settings: locationSettings, ctrl: ctrl));
    return ctrl.stream;
  }

  List<StreamController<Position>> get live =>
      [for (final o in opened) if (o.ctrl.hasListener) o.ctrl];

  bool isForeground(LocationSettings? s) =>
      s is AndroidSettings && s.foregroundNotificationConfig != null;
}

Position _fix(double lat) => Position(
      latitude: lat,
      longitude: 70.1,
      timestamp: DateTime(2026, 10, 6),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

const _notice = BackgroundNotice(title: 'onlayn', text: 't', channelName: 'c');

Future<void> _settle() => Future<void>.delayed(Duration.zero);

void main() {
  late _FakeGeolocator platform;
  late LocationService service;

  setUp(() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    platform = _FakeGeolocator();
    GeolocatorPlatform.instance = platform;
    service = LocationService();
  });

  tearDown(() => debugDefaultTargetPlatformOverride = null);

  test('oflayn bo\'lganda fon xizmati o\'chadi, ekran oqimi davom etadi', () async {
    final driverSeen = <double>[];
    final screenSeen = <double>[];
    final driver = service
        .getPositionStream(background: _notice)
        .listen((p) => driverSeen.add(p.latitude));
    await _settle();
    final screen = service
        .getPositionStream(distanceFilter: 5)
        .listen((p) => screenSeen.add(p.latitude));
    await _settle();

    expect(platform.live, hasLength(1));
    expect(platform.isForeground(platform.opened.last.settings), isTrue);
    platform.live.single.add(_fix(1));
    await _settle();
    expect(driverSeen, [1]);
    expect(screenSeen, [1]);

    // Haydovchi oflayn.
    await driver.cancel();
    await _settle();

    expect(platform.live, hasLength(1), reason: 'ekran hali tinglayapti');
    expect(
      platform.isForeground(platform.opened.last.settings),
      isFalse,
      reason: '"siz onlaynsiz" bildirishnomasi qolmasligi kerak',
    );
    platform.live.single.add(_fix(2));
    await _settle();
    expect(screenSeen, [1, 2]);

    await screen.cancel();
    await _settle();
    expect(platform.live, isEmpty);
  });

  test('ekran oldin ochilgan bo\'lsa ham onlayn bo\'lganda fon xizmati yoqiladi', () async {
    final screen = service.getPositionStream(distanceFilter: 5).listen((_) {});
    await _settle();
    expect(platform.isForeground(platform.opened.last.settings), isFalse);

    final driver = service.getPositionStream(background: _notice).listen((_) {});
    await _settle();

    expect(platform.live, hasLength(1));
    expect(platform.isForeground(platform.opened.last.settings), isTrue);

    await driver.cancel();
    await screen.cancel();
    await _settle();
    expect(platform.live, isEmpty);
  });

  test('eng kichik masofa filtri qo\'llanadi', () async {
    final a = service.getPositionStream(distanceFilter: 10).listen((_) {});
    final b = service.getPositionStream(distanceFilter: 5).listen((_) {});
    await _settle();
    expect(platform.opened.last.settings?.distanceFilter, 5);
    await a.cancel();
    await b.cancel();
  });
}
